import base64
import time
from io import BytesIO
import cv2
import numpy as np
from PIL import Image
from jdm_electron_flask import Printer
from app.core.image_processor import ImageProcessor
from app.core.omr_grid_service import OmrGridService
from app.core.box_config_service import BoxConfigService, MainConfigService


def _bytes_to_pil(image_bytes: bytes) -> Image.Image:
    return Image.open(BytesIO(image_bytes)).convert("RGB")


class ImageProcessorService:

    @staticmethod
    def _processor() -> ImageProcessor:
        return ImageProcessor()

    @staticmethod
    def _overlay_lines(img_array: np.ndarray, v_lines, h_lines) -> np.ndarray:
        overlay = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR).copy()
        for line in v_lines:
            x1, y1, x2, y2 = line[0]
            cv2.line(overlay, (x1, y1), (x2, y2), (0, 255, 0), 2)
        for line in h_lines:
            x1, y1, x2, y2 = line[0]
            cv2.line(overlay, (x1, y1), (x2, y2), (255, 0, 0), 2)
        return overlay

    @staticmethod
    def _pipeline_enhance(img: Image.Image) -> Image.Image:
        proc = ImageProcessorService._processor()
        return proc.enhance_for_detection(img)

    @staticmethod
    def _pipeline_detect_corners(img: Image.Image, padding: int = 40) -> Image.Image:
        proc = ImageProcessorService._processor()
        corners = proc.detect_document_corners(img, padding=padding)
        if corners is None:
            return img
        orig_w, orig_h = img.size
        orig_corners = corners.copy()
        orig_corners[0] = [corners[0][0] - padding, corners[0][1] - padding]
        orig_corners[1] = [corners[1][0] + padding, corners[1][1] - padding]
        orig_corners[2] = [corners[2][0] + padding, corners[2][1] + padding]
        orig_corners[3] = [corners[3][0] - padding, corners[3][1] + padding]
        orig_corners[:, 0] = np.clip(orig_corners[:, 0], 0, orig_w - 1)
        orig_corners[:, 1] = np.clip(orig_corners[:, 1], 0, orig_h - 1)
        return proc.deskew_by_corners(img, corners)

    @staticmethod
    def _pipeline_detect_borders(img: Image.Image) -> dict:
        proc = ImageProcessorService._processor()
        img_array = np.array(img)
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        thickened = cv2.dilate(binary, kernel, iterations=2)
        v_img, h_img = proc.detect_lines(thickened)
        v_lines = proc.hough_lines(v_img, vertical=True)
        h_lines = proc.hough_lines(h_img, vertical=False)
        h, w = gray.shape
        return {
            "left":   int(proc.find_vertical_border(v_lines, w, "left")),
            "right":  int(proc.find_vertical_border(v_lines, w, "right")),
            "top":    int(proc.find_horizontal_border(h_lines, h, "top")),
            "bottom": int(proc.find_horizontal_border(h_lines, h, "bottom")),
        }

    @staticmethod
    def _pipeline_detect_borders2(img: Image.Image, edge_margin: int = 50, min_span_ratio: float = 0.5) -> dict:
        proc = ImageProcessorService._processor()
        img_array = np.array(img)
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        h, w = gray.shape
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (3, 3))
        thickened = cv2.dilate(binary, kernel, iterations=2)
        v_img, h_img = proc.detect_lines(thickened)
        v_lines = proc.hough_lines(v_img, vertical=True)
        h_lines = proc.hough_lines(h_img, vertical=False)

        raw_left   = proc.find_vertical_border(v_lines, w, "left")
        raw_right  = proc.find_vertical_border(v_lines, w, "right")
        raw_top    = proc.find_horizontal_border(h_lines, h, "top")
        raw_bottom = proc.find_horizontal_border(h_lines, h, "bottom")

        min_v_span = h * min_span_ratio
        min_h_span = w * min_span_ratio

        def v_line_span(lines, side):
            side_lines = [l for l in lines if ((l[0][0] + l[0][2]) // 2 < w // 2) == (side == "left")]
            return max((abs(l[0][3] - l[0][1]) for l in side_lines), default=0)

        def h_line_span(lines, side):
            side_lines = [l for l in lines if ((l[0][1] + l[0][3]) // 2 < h // 2) == (side == "top")]
            return max((abs(l[0][2] - l[0][0]) for l in side_lines), default=0)

        left_valid   = raw_left   <= edge_margin     and v_line_span(v_lines, "left")   >= min_v_span
        right_valid  = raw_right  >= w - edge_margin and v_line_span(v_lines, "right")  >= min_v_span
        top_valid    = raw_top    <= edge_margin     and h_line_span(h_lines, "top")    >= min_h_span
        bottom_valid = raw_bottom >= h - edge_margin and h_line_span(h_lines, "bottom") >= min_h_span

        invalids = {k for k, v in {"left": left_valid, "right": right_valid, "top": top_valid, "bottom": bottom_valid}.items() if not v}
        if invalids:
            Printer.warn(f"[detect_borders2] invalid/fallback borders: {invalids}")

        return {
            "left":   int(raw_left   if left_valid   else 0),
            "right":  int(raw_right  if right_valid  else w),
            "top":    int(raw_top    if top_valid    else 0),
            "bottom": int(raw_bottom if bottom_valid else h),
        }

    @staticmethod
    def _pipeline_crop(img: Image.Image, borders: dict) -> Image.Image:
        proc = ImageProcessorService._processor()
        arr  = np.array(img)
        h, w = arr.shape[:2]
        left   = max(0, borders["left"]   + 5)
        right  = min(w, borders["right"]  - 5)
        top    = max(0, borders["top"]    + 5)
        bottom = min(h, borders["bottom"] - 5)
        cropped = img.crop((left, top, right, bottom))
        return cropped.resize((proc.fixed_width, proc.fixed_height), Image.LANCZOS)

    @staticmethod
    def run_full_pipeline_no_annotation(image_bytes: bytes) -> dict:
        total_start = time.time()

        cfg = MainConfigService(app_name="E-Assess").get()
        output_width  = cfg["OUTPUT_WIDTH"]
        output_height = cfg["OUTPUT_HEIGHT"]

        img = _bytes_to_pil(image_bytes)
        img = ImageProcessorService._pipeline_enhance(img)
        img = ImageProcessorService._pipeline_detect_corners(img)

        borders = ImageProcessorService._pipeline_detect_borders(img)
        img     = ImageProcessorService._pipeline_crop(img, borders)

        borders = ImageProcessorService._pipeline_detect_borders2(img)
        img     = ImageProcessorService._pipeline_crop(img, borders)

        img = img.resize((output_width, output_height), Image.LANCZOS)

        buf = BytesIO()
        img.save(buf, format="PNG")

        total_elapsed = round(time.time() - total_start, 4)
        Printer.success(f"[pipeline] completed in {total_elapsed}s")
        return {
            "total_elapsed": total_elapsed,
            "result": base64.b64encode(buf.getvalue()).decode("utf-8"),
        }

    @staticmethod
    def run_full_pipeline(image_bytes: bytes) -> dict:
        total_start = time.time()

        cfg = MainConfigService(app_name="E-Assess").get()
        output_width  = cfg["OUTPUT_WIDTH"]
        output_height = cfg["OUTPUT_HEIGHT"]

        img = _bytes_to_pil(image_bytes)
        img = ImageProcessorService._pipeline_enhance(img)
        img = ImageProcessorService._pipeline_detect_corners(img)

        borders = ImageProcessorService._pipeline_detect_borders(img)
        img     = ImageProcessorService._pipeline_crop(img, borders)

        borders = ImageProcessorService._pipeline_detect_borders2(img)
        img     = ImageProcessorService._pipeline_crop(img, borders)

        img = img.resize((output_width, output_height), Image.LANCZOS)

        buf = BytesIO()
        img.save(buf, format="PNG")
        processed_image_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")

        box_config = BoxConfigService(app_name="E-Assess")
        BOXES = box_config.get_all_for_pipeline()
        grid_result = OmrGridService.apply_grids(buf.getvalue(), BOXES, cfg)

        total_elapsed = round(time.time() - total_start, 4)
        Printer.success(f"[pipeline] completed in {total_elapsed}s")

        return {
            "total_elapsed": total_elapsed,
            "result":        processed_image_b64,
            "quads":         grid_result["quads"],
            "answers":       grid_result["answers"],
            "box_meta":      grid_result["box_meta"]
        }

    @staticmethod
    def pdf_to_image_bytes(pdf_bytes: bytes, page_num: int = 0) -> bytes:
        import fitz
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page_num = max(0, min(page_num, len(doc) - 1))
        page = doc[page_num]
        mat = fitz.Matrix(300 / 72, 300 / 72)
        pix = page.get_pixmap(matrix=mat)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        doc.close()
        buf = BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()