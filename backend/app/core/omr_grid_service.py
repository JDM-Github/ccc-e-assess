import math
import time
from io import BytesIO
from typing import Union

import cv2
import numpy as np
from PIL import Image, ImageDraw

try:
    from jdm_electron_flask import Printer
except ImportError:
    class Printer:
        @staticmethod
        def info(msg):    print(f"[INFO] {msg}")
        @staticmethod
        def warn(msg):    print(f"[WARN] {msg}")
        @staticmethod
        def success(msg): print(f"[OK]   {msg}")


EDGE_COLOR   = (80, 200, 120, 220)
GRID_COLOR   = (100, 100, 180, 140)
MARKED_COLOR = (255, 0, 0, 128)

BUBBLE_FILL_RATIO   = 0.50
MIN_CIRCULARITY     = 0.3

MIN_BUBBLE_FRACTION = 0.10
MAX_BUBBLE_FRACTION = 1.30
BORDER_SHRINK_PX    = 2
CELL_MARGIN_PX      = 20
FALLBACK_CELL_FILL_RATIO = 0.25

def _bytes_to_pil(image_bytes: bytes) -> Image.Image:
    return Image.open(BytesIO(image_bytes)).convert("RGB")


def _to_img_array(image_input: Union[bytes, np.ndarray], output_width: int, output_height: int) -> np.ndarray:
    if isinstance(image_input, (bytes, bytearray)):
        img = _bytes_to_pil(image_input)
        if img.size != (output_width, output_height):
            img = img.resize((output_width, output_height), Image.LANCZOS)
        return np.array(img)

    img_array = np.asarray(image_input)
    h, w = img_array.shape[:2]
    if (w, h) == (output_width, output_height):
        return img_array

    img = Image.fromarray(img_array)
    img = img.resize((output_width, output_height), Image.LANCZOS)
    return np.array(img)

def _scan_vertical_edge(img_array: np.ndarray, anchor_x: int, top_y: int, bottom_y: int,
                        scan_range: int, sample_pts: int, dark_thresh: int) -> int:
    h, w = img_array.shape[:2]
    ys = np.linspace(top_y, bottom_y, sample_pts, dtype=int)
    dxs = np.arange(-scan_range, scan_range + 1)
    xs = anchor_x + dxs

    valid_y = (ys >= 0) & (ys < h)
    valid_x = (xs >= 0) & (xs < w)
    valid = valid_x[:, None] & valid_y[None, :]

    xs_clipped = np.clip(xs, 0, w - 1)
    ys_clipped = np.clip(ys, 0, h - 1)

    pixels = img_array[ys_clipped[None, :], xs_clipped[:, None]]
    vals = pixels.astype(np.float64) if img_array.ndim == 2 else pixels[..., :3].mean(axis=-1)

    hits = ((vals < dark_thresh) & valid).sum(axis=1)

    best_hits = hits.min()
    candidate_dxs = dxs[hits == best_hits]
    min_abs = np.abs(candidate_dxs).min()
    chosen_dx = candidate_dxs[np.abs(candidate_dxs) == min_abs].min()
    return int(anchor_x + chosen_dx)


def _scan_horizontal_edge(img_array: np.ndarray, anchor_y: int, left_x: int, right_x: int,
        scan_range: int, sample_pts: int, dark_thresh: int) -> int:
    h, w = img_array.shape[:2]
    xs = np.linspace(left_x, right_x, sample_pts, dtype=int)
    dys = np.arange(-scan_range, scan_range + 1)
    ys = anchor_y + dys

    valid_x = (xs >= 0) & (xs < w)
    valid_y = (ys >= 0) & (ys < h)
    valid = valid_y[:, None] & valid_x[None, :]

    xs_clipped = np.clip(xs, 0, w - 1)
    ys_clipped = np.clip(ys, 0, h - 1)

    pixels = img_array[ys_clipped[:, None], xs_clipped[None, :]]
    vals = pixels.astype(np.float64) if img_array.ndim == 2 else pixels[..., :3].mean(axis=-1)

    hits = ((vals < dark_thresh) & valid).sum(axis=1)

    best_hits = hits.min()
    candidate_dys = dys[hits == best_hits]
    min_abs = np.abs(candidate_dys).min()
    chosen_dy = candidate_dys[np.abs(candidate_dys) == min_abs].min()
    return int(anchor_y + chosen_dy)


def _find_quad(img_array: np.ndarray, tl: tuple, tr: tuple, height: int,
        scan_range: int, sample_pts: int, dark_thresh: int) -> tuple:
    tl_x, tl_y = tl
    tr_x, tr_y = tr
    expected_bottom_y = tl_y + height

    bl_x = _scan_vertical_edge(img_array, tl_x, tl_y, expected_bottom_y, scan_range, sample_pts, dark_thresh)
    br_x = _scan_vertical_edge(img_array, tr_x, tr_y, expected_bottom_y, scan_range, sample_pts, dark_thresh)
    bl_y = _scan_horizontal_edge(img_array, expected_bottom_y, bl_x, br_x, scan_range, sample_pts, dark_thresh)
    br_y = bl_y

    return (tl_x, tl_y), (tr_x, tr_y), (bl_x, bl_y), (br_x, br_y)

def _lerp(a: float, b: float, t: float) -> float:
    return a + t * (b - a)


def _bilinear_point(tl, tr, bl, br, u, v) -> tuple:
    top_x = _lerp(tl[0], tr[0], u)
    top_y = _lerp(tl[1], tr[1], u)
    bot_x = _lerp(bl[0], br[0], u)
    bot_y = _lerp(bl[1], br[1], u)
    return (_lerp(top_x, bot_x, v), _lerp(top_y, bot_y, v))


def _cell_corners(tl, tr, bl, br, col: int, row: int, cols: int, rows: int):
    u0 = col       / cols;  u1 = (col + 1) / cols
    v0 = row       / rows;  v1 = (row + 1) / rows
    return (
        _bilinear_point(tl, tr, bl, br, u0, v0),
        _bilinear_point(tl, tr, bl, br, u1, v0),
        _bilinear_point(tl, tr, bl, br, u0, v1),
        _bilinear_point(tl, tr, bl, br, u1, v1),
    )


def _expand_quad(c_tl, c_tr, c_bl, c_br, margin_px: float):
    def _sub(a, b):
        return (a[0] - b[0], a[1] - b[1])

    def _norm(v):
        n = math.hypot(v[0], v[1])
        return (v[0] / n, v[1] / n) if n > 1e-6 else v

    u_top   = _norm(_sub(c_tr, c_tl))
    u_bot   = _norm(_sub(c_br, c_bl))
    v_left  = _norm(_sub(c_bl, c_tl))
    v_right = _norm(_sub(c_br, c_tr))

    def _expand(p, u, v, su, sv):
        return (
            p[0] + su * margin_px * u[0] + sv * margin_px * v[0],
            p[1] + su * margin_px * u[1] + sv * margin_px * v[1],
        )

    e_tl = _expand(c_tl, u_top, v_left,  -1, -1)
    e_tr = _expand(c_tr, u_top, v_right, +1, -1)
    e_bl = _expand(c_bl, u_bot, v_left,  -1, +1)
    e_br = _expand(c_br, u_bot, v_right, +1, +1)

    return e_tl, e_tr, e_bl, e_br

def _cell_quad_size(c_tl, c_tr, c_bl, c_br) -> tuple:
    """Width/height that _crop_cell would warp this quad into — same
    formula, but callable without doing the actual perspective warp.
    Lets callers that only need the size (not the pixels) skip the warp.
    """
    w = int((math.hypot(c_tr[0] - c_tl[0], c_tr[1] - c_tl[1]) +
        math.hypot(c_br[0] - c_bl[0], c_br[1] - c_bl[1])) / 2)
    h = int((math.hypot(c_bl[0] - c_tl[0], c_bl[1] - c_tl[1]) +
        math.hypot(c_br[0] - c_tr[0], c_br[1] - c_tr[1])) / 2)
    return max(w, 4), max(h, 4)


def _crop_cell(img_array: np.ndarray, c_tl, c_tr, c_bl, c_br):
    pts_src = np.array([c_tl, c_tr, c_br, c_bl], dtype=np.float32)
    w, h = _cell_quad_size(c_tl, c_tr, c_bl, c_br)
    pts_dst = np.array([[0, 0], [w, 0], [w, h], [0, h]], dtype=np.float32)

    xs = [c_tl[0], c_tr[0], c_bl[0], c_br[0]]
    ys = [c_tl[1], c_tr[1], c_bl[1], c_br[1]]
    x0 = max(0, int(min(xs)))
    y0 = max(0, int(min(ys)))
    x1 = min(img_array.shape[1], int(max(xs)) + 1)
    y1 = min(img_array.shape[0], int(max(ys)) + 1)

    patch = img_array[y0:y1, x0:x1]

    pts_src_local = pts_src - np.array([x0, y0], dtype=np.float32)
    M_local       = cv2.getPerspectiveTransform(pts_src_local, pts_dst)
    M_inv_full    = cv2.getPerspectiveTransform(pts_dst, pts_src)

    cell_img = cv2.warpPerspective(patch, M_local, (w, h))
    return cell_img, M_inv_full, x0, y0


def _find_bubble_contour(gray: np.ndarray, reference_area: float, dark_thresh: int):
    """Expects an already-grayscale image — callers that need the gray
    version for multiple checks should convert once and reuse it."""
    h, w = gray.shape

    if BORDER_SHRINK_PX > 0:
        inner = gray[
            BORDER_SHRINK_PX:h - BORDER_SHRINK_PX,
            BORDER_SHRINK_PX:w - BORDER_SHRINK_PX]
        offset = BORDER_SHRINK_PX
    else:
        inner = gray
        offset = 0

    binary = cv2.adaptiveThreshold(
        inner, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        blockSize=15, C=5,
    )

    contours, _ = cv2.findContours(binary, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    best       = None
    best_score = -1

    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < 1:
            continue

        frac = area / reference_area
        if not (MIN_BUBBLE_FRACTION <= frac <= MAX_BUBBLE_FRACTION):
            continue

        perimeter = cv2.arcLength(cnt, True)
        if perimeter < 1:
            continue
        circularity = (4 * np.pi * area) / (perimeter ** 2)
        if circularity < MIN_CIRCULARITY:
            continue

        score = circularity * area
        if score > best_score:
            best_score = score
            best = cnt + np.array([[[offset, offset]]], dtype=np.int32)

    return best


def _bubble_fill_ratio(gray: np.ndarray, contour: np.ndarray, dark_thresh: int) -> float:
    """Expects an already-grayscale image (see _find_bubble_contour)."""
    h, w = gray.shape[:2]

    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.drawContours(mask, [contour], -1, 255, thickness=cv2.FILLED)

    interior_pixels = gray[mask == 255]
    if len(interior_pixels) == 0:
        return 0.0

    dark_pixels = np.sum(interior_pixels < dark_thresh)
    return float(dark_pixels) / len(interior_pixels)


def _cell_fill_ratio(cell_img: np.ndarray, dark_thresh: int) -> float:
    gray = cv2.cvtColor(cell_img, cv2.COLOR_BGR2GRAY) \
           if cell_img.ndim == 3 else cell_img.copy()

    h, w = gray.shape
    if BORDER_SHRINK_PX > 0 and h > 2 * BORDER_SHRINK_PX and w > 2 * BORDER_SHRINK_PX:
        inner = gray[
            BORDER_SHRINK_PX:h - BORDER_SHRINK_PX,
            BORDER_SHRINK_PX:w - BORDER_SHRINK_PX]
    else:
        inner = gray

    if inner.size == 0:
        return 0.0

    dark_pixels = np.sum(inner < dark_thresh)
    return float(dark_pixels) / inner.size


def _contour_to_ellipse_bbox(contour: np.ndarray, M_inv, img_shape):
    (cx_c, cy_c), r_c = cv2.minEnclosingCircle(contour)

    pts = np.array([[[cx_c, cy_c]], [[cx_c + r_c, cy_c]]], dtype=np.float32)
    pts_out = cv2.perspectiveTransform(pts, M_inv)
    cx_o, cy_o = float(pts_out[0][0][0]), float(pts_out[0][0][1])
    edge_out = pts_out[1][0]

    r_o = math.hypot(float(edge_out[0]) - cx_o, float(edge_out[1]) - cy_o)

    h, w = img_shape[:2]
    x0 = max(0, cx_o - r_o)
    y0 = max(0, cy_o - r_o)
    x1 = min(w,  cx_o + r_o)
    y1 = min(h,  cy_o + r_o)
    return [x0, y0, x1, y1]

def _check_and_mark_cell(
        img_array: np.ndarray,
        draw: ImageDraw.Draw,
        c_tl, c_tr, c_bl, c_br,
        dark_thresh: int) -> int:
    cell_w, cell_h = _cell_quad_size(c_tl, c_tr, c_bl, c_br)
    reference_area = float(cell_h * cell_w)

    e_tl, e_tr, e_bl, e_br = _expand_quad(c_tl, c_tr, c_bl, c_br, CELL_MARGIN_PX)
    expanded_cell_img, expanded_M_inv, _, _ = _crop_cell(img_array, e_tl, e_tr, e_bl, e_br)

    expanded_gray = cv2.cvtColor(expanded_cell_img, cv2.COLOR_BGR2GRAY) \
        if expanded_cell_img.ndim == 3 else expanded_cell_img

    contour = _find_bubble_contour(expanded_gray, reference_area=reference_area, dark_thresh=dark_thresh)

    if contour is not None:
        ratio = _bubble_fill_ratio(expanded_gray, contour, dark_thresh=dark_thresh)
        if ratio >= BUBBLE_FILL_RATIO:
            bbox = _contour_to_ellipse_bbox(contour, expanded_M_inv, img_array.shape)
            draw.ellipse(bbox, fill=MARKED_COLOR)
            return 1
        return 0

    cell_img, _, _, _ = _crop_cell(img_array, c_tl, c_tr, c_bl, c_br)
    fallback_ratio = _cell_fill_ratio(cell_img, dark_thresh=dark_thresh)
    if fallback_ratio >= FALLBACK_CELL_FILL_RATIO:
        draw.polygon([c_tl, c_tr, c_br, c_bl], fill=MARKED_COLOR)
        return 1

    return 0


def _mark_answered_cells(img_array: np.ndarray,
        draw: ImageDraw.Draw,
        tl, tr, bl, br,
        cols: int, rows: int,
        dark_thresh: int,
        check_by_col: bool = False) -> list[list[bool]]:
    raw = []
    for row in range(rows):
        row_data = []
        for col in range(cols):
            c_tl, c_tr, c_bl, c_br = _cell_corners(tl, tr, bl, br, col, row, cols, rows)
            filled = bool(_check_and_mark_cell(img_array, draw, c_tl, c_tr, c_bl, c_br, dark_thresh=dark_thresh))
            row_data.append(filled)
        raw.append(row_data)

    if check_by_col:
        return [[raw[row][col] for row in range(rows)] for col in range(cols)]

    return raw

class OmrGridService:

    @staticmethod
    def apply_grids(image_input: Union[bytes, np.ndarray], boxes: list[dict], cfg: dict) -> dict:
        start = time.time()

        output_width  = cfg["OUTPUT_WIDTH"]
        output_height = cfg["OUTPUT_HEIGHT"]
        scan_range    = cfg["SCAN_RANGE"]
        sample_pts    = cfg["SAMPLE_PTS"]
        dark_thresh   = cfg["DARK_THRESH"]
        img_array = _to_img_array(image_input, output_width, output_height)
        dummy_layer = Image.new("RGBA", (output_width, output_height), (0, 0, 0, 0))
        draw = ImageDraw.Draw(dummy_layer)

        quads   = []
        answers = []
        box_meta = []

        for i, box in enumerate(boxes):
            tl     = tuple(box["tl"])
            tr     = tuple(box["tr"])
            height = int(box["height"])
            cols         = int(box.get("grid_cols", 4))
            rows         = int(box.get("grid_rows", 40))
            check_by_col = bool(box.get("check_by_col", False))

            tl_pt, tr_pt, bl_pt, br_pt = _find_quad(
                img_array, tl, tr, height,
                scan_range=scan_range,
                sample_pts=sample_pts,
                dark_thresh=dark_thresh,
            )
            quads.append({"tl": tl_pt, "tr": tr_pt, "bl": bl_pt, "br": br_pt})
            box_answers = _mark_answered_cells(
                img_array, draw,
                tl_pt, tr_pt, bl_pt, br_pt,
                cols, rows,
                dark_thresh=dark_thresh,
                check_by_col=check_by_col,
            )
            answers.append(box_answers)

            box_meta.append({
                "title":          str(box.get("title", "")),
                "grid_cols":      cols,
                "grid_rows":      rows,
                "check_by_row":   bool(box.get("check_by_row", True)),
                "check_by_col":   check_by_col,
                "columns":        list(box.get("columns")),
                "is_combined":    bool(box.get("is_combined", False)),
                "has_own_sheet":  bool(box.get("has_own_sheet", False)),
                "no_double":      bool(box.get("no_double", False)),
                "no_blank":       bool(box.get("no_blank", False)),
                "group":          box.get("group", None),
                "combined_title": box.get("combined_title", None),
                "is_answerer":    bool(box.get("is_answerer", False)),
            })

        total_elapsed = round(time.time() - start, 4)
        return {
            "total_elapsed": total_elapsed,
            "quads":         quads,
            "answers":       answers,
            "box_meta":      box_meta
        }