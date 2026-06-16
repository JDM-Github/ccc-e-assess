import cv2
import numpy as np
from PIL import Image
from typing import Optional, Tuple, List

class ImageProcessor:

    def __init__(
        self,
        fixed_width: int = 2480,
        fixed_height: int = 3508,
    ):
        self.fixed_width = fixed_width
        self.fixed_height = fixed_height

        self.edge_scan_ratio = 0.25
        self.min_line_length_ratio = 0.15
        self.hough_threshold = 220
        self.angle_tolerance = 15.0

    def enhance_for_detection(self, img: Image.Image) -> Image.Image:
        img_array = np.array(img)
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY) if img_array.ndim == 3 else img_array.copy()

        denoised = cv2.bilateralFilter(gray, 9, 75, 75)

        mask = denoised < 200
        enhanced = denoised.astype(np.float32)
        enhanced[mask] = enhanced[mask] / 1.5
        enhanced = np.clip(enhanced, 0, 255).astype(np.uint8)

        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(enhanced)

        kernel_sharpening = np.array([[-1, -1, -1],
                                       [-1,  9, -1],
                                       [-1, -1, -1]])
        sharpened = cv2.filter2D(enhanced, -1, kernel_sharpening)

        if img_array.ndim == 3:
            return Image.fromarray(cv2.cvtColor(sharpened, cv2.COLOR_GRAY2RGB))
        return Image.fromarray(sharpened)

    # -------------------------------------------------------------------------
    # Low-level helpers
    # -------------------------------------------------------------------------

    def detect_lines(self, binary: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        h, w = binary.shape
        v_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, h // 30))
        vertical = cv2.morphologyEx(binary, cv2.MORPH_OPEN, v_kernel)
        h_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (w // 30, 1))
        horizontal = cv2.morphologyEx(binary, cv2.MORPH_OPEN, h_kernel)
        return vertical, horizontal

    def hough_lines(self, img: np.ndarray, vertical: bool = True) -> List:
        lines = cv2.HoughLinesP(
            img,
            rho=1,
            theta=np.pi / 180,
            threshold=self.hough_threshold,
            minLineLength=int(img.shape[0 if vertical else 1] * self.min_line_length_ratio),
            maxLineGap=10,
        )
        if lines is None:
            return []

        filtered = []
        for line in lines:
            x1, y1, x2, y2 = line[0]
            angle = np.degrees(np.arctan2(y2 - y1, x2 - x1))
            if vertical:
                if abs(abs(angle) - 90) <= self.angle_tolerance:
                    filtered.append(line)
            else:
                if abs(angle) <= self.angle_tolerance or abs(abs(angle) - 180) <= self.angle_tolerance:
                    filtered.append(line)
        return filtered

    def find_vertical_border(self, lines: List, w: int, side: str) -> int:
        if not lines:
            return 0 if side == "left" else w
        xs = [(line[0][0] + line[0][2]) // 2 for line in lines]
        return min(xs) if side == "left" else max(xs)

    def find_horizontal_border(self, lines: List, h: int, side: str) -> int:
        if not lines:
            return 0 if side == "top" else h
        ys = [(line[0][1] + line[0][3]) // 2 for line in lines]
        return min(ys) if side == "top" else max(ys)

    # -------------------------------------------------------------------------
    # Corner detection & deskew
    # -------------------------------------------------------------------------

    def order_points(self, pts: np.ndarray) -> np.ndarray:
        sorted_pts = pts[np.argsort(pts[:, 1])]
        top_pts = sorted_pts[:2][np.argsort(sorted_pts[:2][:, 0])]
        bottom_pts = sorted_pts[2:][np.argsort(sorted_pts[2:][:, 0])]
        return np.array([top_pts[0], top_pts[1], bottom_pts[1], bottom_pts[0]], dtype=np.float32)

    def deskew_by_corners(self, img: Image.Image, corners: np.ndarray) -> Image.Image:
        img_array = np.array(img)
        tl, tr, br, bl = corners.astype(np.float32)

        width_top    = np.linalg.norm(tr - tl)
        width_bottom = np.linalg.norm(br - bl)
        height_left  = np.linalg.norm(bl - tl)
        height_right = np.linalg.norm(br - tr)

        out_w = int(max(width_top, width_bottom))
        out_h = int(max(height_left, height_right))

        dst = np.array([
            [0,         0        ],
            [out_w - 1, 0        ],
            [out_w - 1, out_h - 1],
            [0,         out_h - 1],
        ], dtype=np.float32)

        matrix = cv2.getPerspectiveTransform(corners.astype(np.float32), dst)
        warped = cv2.warpPerspective(
            img_array, matrix, (out_w, out_h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_CONSTANT,
            borderValue=(255, 255, 255),
        )
        return Image.fromarray(warped)

    def detect_document_corners(
        self,
        img: Image.Image,
        padding: int = 20,
        bg_border: int = 80,
    ) -> Optional[np.ndarray]:
        img_array = np.array(img)
        orig_h, orig_w = img_array.shape[:2]

        padded_array = cv2.copyMakeBorder(
            img_array,
            bg_border, bg_border, bg_border, bg_border,
            cv2.BORDER_CONSTANT,
            value=(255, 255, 255),
        ) if bg_border > 0 else img_array

        gray = cv2.cvtColor(padded_array, cv2.COLOR_RGB2GRAY) if padded_array.ndim == 3 else padded_array

        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        binary  = cv2.adaptiveThreshold(
            blurred, 255,
            cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
        )

        contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return None

        largest = max(contours, key=cv2.contourArea)
        epsilon = 0.02 * cv2.arcLength(largest, True)
        approx  = cv2.approxPolyDP(largest, epsilon, True)

        corners = (
            approx.reshape(4, 2)
            if len(approx) == 4
            else cv2.boxPoints(cv2.minAreaRect(largest)).astype(np.float32)
        )
        corners = self.order_points(corners)

        corners[:, 0] -= bg_border
        corners[:, 1] -= bg_border

        corners[0][0] -= padding;  corners[0][1] -= padding   # TL
        corners[1][0] += padding;  corners[1][1] -= padding   # TR
        corners[2][0] += padding;  corners[2][1] += padding   # BR
        corners[3][0] -= padding;  corners[3][1] += padding   # BL

        corners[:, 0] = np.clip(corners[:, 0], 0, orig_w - 1)
        corners[:, 1] = np.clip(corners[:, 1], 0, orig_h - 1)

        return corners