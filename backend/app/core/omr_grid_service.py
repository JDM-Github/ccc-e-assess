import base64
import time
from io import BytesIO

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


# ─────────────────────────────────────────────────────────────────────────────
#  Low-level image helpers
# ─────────────────────────────────────────────────────────────────────────────

def _bytes_to_pil(image_bytes: bytes) -> Image.Image:
    return Image.open(BytesIO(image_bytes)).convert("RGB")


def _count_dark_hits(img_array: np.ndarray, points: list, dark_thresh: int) -> int:
    h, w = img_array.shape[:2]
    hits = 0
    for x, y in points:
        if 0 <= x < w and 0 <= y < h:
            pixel = img_array[y, x]
            val = int(pixel) if img_array.ndim == 2 else int(np.mean(pixel[:3]))
            if val < dark_thresh:
                hits += 1
    return hits


# ─────────────────────────────────────────────────────────────────────────────
#  Quad / edge scanning
# ─────────────────────────────────────────────────────────────────────────────

def _scan_vertical_edge(img_array: np.ndarray, anchor_x: int, top_y: int, bottom_y: int,
                        scan_range: int, sample_pts: int, dark_thresh: int) -> int:
    results = []
    for dx in range(-scan_range, scan_range + 1):
        candidate_x = anchor_x + dx
        ys = np.linspace(top_y, bottom_y, sample_pts, dtype=int)
        points = [(candidate_x, int(y)) for y in ys]
        hits = _count_dark_hits(img_array, points, dark_thresh)
        results.append((hits, abs(dx), candidate_x))
    results.sort(key=lambda r: (r[0], r[1]))
    best_hits = results[0][0]
    winners = [r for r in results if r[0] == best_hits]
    return winners[0][2]


def _scan_horizontal_edge(img_array: np.ndarray, anchor_y: int, left_x: int, right_x: int,
        scan_range: int, sample_pts: int, dark_thresh: int) -> int:
    results = []
    for dy in range(-scan_range, scan_range + 1):
        candidate_y = anchor_y + dy
        xs = np.linspace(left_x, right_x, sample_pts, dtype=int)
        points = [(int(x), candidate_y) for x in xs]
        hits = _count_dark_hits(img_array, points, dark_thresh)
        results.append((hits, abs(dy), candidate_y))
    results.sort(key=lambda r: (r[0], r[1]))
    best_hits = results[0][0]
    winners = [r for r in results if r[0] == best_hits]
    return winners[0][2]


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


# ─────────────────────────────────────────────────────────────────────────────
#  Bilinear / grid helpers
# ─────────────────────────────────────────────────────────────────────────────

def _lerp(a, b, t):
    return a + t * (b - a)


def _bilinear_point(tl, tr, bl, br, u, v) -> tuple:
    tl = np.array(tl, dtype=float)
    tr = np.array(tr, dtype=float)
    bl = np.array(bl, dtype=float)
    br = np.array(br, dtype=float)
    top    = _lerp(tl, tr, u)
    bottom = _lerp(bl, br, u)
    pt     = _lerp(top, bottom, v)
    return (float(pt[0]), float(pt[1]))


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
    p_tl = np.array(c_tl, dtype=float)
    p_tr = np.array(c_tr, dtype=float)
    p_bl = np.array(c_bl, dtype=float)
    p_br = np.array(c_br, dtype=float)

    def _norm(v):
        n = np.linalg.norm(v)
        return v / n if n > 1e-6 else v

    u_top   = _norm(p_tr - p_tl)
    u_bot   = _norm(p_br - p_bl)
    v_left  = _norm(p_bl - p_tl)
    v_right = _norm(p_br - p_tr)

    e_tl = p_tl - margin_px * u_top   - margin_px * v_left
    e_tr = p_tr + margin_px * u_top   - margin_px * v_right
    e_bl = p_bl - margin_px * u_bot   + margin_px * v_left
    e_br = p_br + margin_px * u_bot   + margin_px * v_right

    return tuple(e_tl), tuple(e_tr), tuple(e_bl), tuple(e_br)


# ─────────────────────────────────────────────────────────────────────────────
#  Bubble detection
# ─────────────────────────────────────────────────────────────────────────────

def _crop_cell(img_array: np.ndarray, c_tl, c_tr, c_bl, c_br):
    pts_src = np.array([c_tl, c_tr, c_br, c_bl], dtype=np.float32)

    w = int((np.linalg.norm(np.array(c_tr) - np.array(c_tl)) +
             np.linalg.norm(np.array(c_br) - np.array(c_bl))) / 2)
    h = int((np.linalg.norm(np.array(c_bl) - np.array(c_tl)) +
             np.linalg.norm(np.array(c_br) - np.array(c_tr))) / 2)
    w = max(w, 4);  h = max(h, 4)

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


def _find_bubble_contour(cell_img: np.ndarray, reference_area: float, dark_thresh: int):
    gray = cv2.cvtColor(cell_img, cv2.COLOR_BGR2GRAY) \
           if cell_img.ndim == 3 else cell_img.copy()

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


def _bubble_fill_ratio(cell_img: np.ndarray, contour: np.ndarray, dark_thresh: int) -> float:
    h, w = cell_img.shape[:2]
    gray = cv2.cvtColor(cell_img, cv2.COLOR_BGR2GRAY) \
        if cell_img.ndim == 3 else cell_img.copy()

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

    pt     = np.array([[[cx_c, cy_c]]], dtype=np.float32)
    pt_out = cv2.perspectiveTransform(pt, M_inv)[0][0]
    cx_o, cy_o = float(pt_out[0]), float(pt_out[1])

    edge_pt  = np.array([[[cx_c + r_c, cy_c]]], dtype=np.float32)
    edge_out = cv2.perspectiveTransform(edge_pt, M_inv)[0][0]
    r_o      = float(np.linalg.norm(edge_out - pt_out))

    h, w = img_shape[:2]
    x0 = max(0, cx_o - r_o)
    y0 = max(0, cy_o - r_o)
    x1 = min(w,  cx_o + r_o)
    y1 = min(h,  cy_o + r_o)
    return [x0, y0, x1, y1]


# ─────────────────────────────────────────────────────────────────────────────
#  Grid drawing
# ─────────────────────────────────────────────────────────────────────────────

def _draw_grid_on_image(draw: ImageDraw.Draw, tl, tr, bl, br, cols: int, rows: int):
    for c in range(cols + 1):
        u   = c / cols
        pts = [_bilinear_point(tl, tr, bl, br, u, r / rows) for r in range(rows + 1)]
        is_edge = c == 0 or c == cols
        color   = EDGE_COLOR if is_edge else GRID_COLOR
        width   = 3 if is_edge else 1
        for i in range(len(pts) - 1):
            draw.line([pts[i], pts[i + 1]], fill=color, width=width)

    for r in range(rows + 1):
        v   = r / rows
        pts = [_bilinear_point(tl, tr, bl, br, c / cols, v) for c in range(cols + 1)]
        is_edge = r == 0 or r == rows
        color   = EDGE_COLOR if is_edge else GRID_COLOR
        width   = 3 if is_edge else 1
        for i in range(len(pts) - 1):
            draw.line([pts[i], pts[i + 1]], fill=color, width=width)


# ─────────────────────────────────────────────────────────────────────────────
#  Per-cell answer detection
# ─────────────────────────────────────────────────────────────────────────────

def _check_and_mark_cell(
        img_array: np.ndarray,
        draw: ImageDraw.Draw,
        c_tl, c_tr, c_bl, c_br,
        dark_thresh: int) -> int:
    cell_img, _, _, _ = _crop_cell(img_array, c_tl, c_tr, c_bl, c_br)
    ref_h, ref_w = cell_img.shape[:2]
    reference_area = float(ref_h * ref_w)

    e_tl, e_tr, e_bl, e_br = _expand_quad(c_tl, c_tr, c_bl, c_br, CELL_MARGIN_PX)
    expanded_cell_img, expanded_M_inv, _, _ = _crop_cell(img_array, e_tl, e_tr, e_bl, e_br)

    contour = _find_bubble_contour(expanded_cell_img, reference_area=reference_area, dark_thresh=dark_thresh)

    if contour is not None:
        ratio = _bubble_fill_ratio(expanded_cell_img, contour, dark_thresh=dark_thresh)
        if ratio >= BUBBLE_FILL_RATIO:
            bbox = _contour_to_ellipse_bbox(contour, expanded_M_inv, img_array.shape)
            draw.ellipse(bbox, fill=MARKED_COLOR)
            return 1
        return 0

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
    def apply_grids(image_bytes: bytes, boxes: list[dict], cfg: dict) -> dict:
        start = time.time()

        output_width  = cfg["OUTPUT_WIDTH"]
        output_height = cfg["OUTPUT_HEIGHT"]
        scan_range    = cfg["SCAN_RANGE"]
        sample_pts    = cfg["SAMPLE_PTS"]
        dark_thresh   = cfg["DARK_THRESH"]

        img = _bytes_to_pil(image_bytes)
        img = img.resize((output_width, output_height), Image.LANCZOS)
        img_array = np.array(img)

        dummy_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
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
                "title":        str(box.get("title", "")),
                "grid_cols":    cols,
                "grid_rows":    rows,
                "check_by_row": bool(box.get("check_by_row", True)),
                "check_by_col": check_by_col,
                "columns": list(box.get("columns")),
                "is_combined": bool(box.get("is_combined", False)),
                "has_own_sheet": bool(box.get("has_own_sheet", False)),
                "no_double":    bool(box.get("no_double", False)),
                "no_blank":     bool(box.get("no_blank", False)),
                "group":        box.get("group", None),
                "is_answerer":  bool(box.get("is_answerer", False)),
            })

        total_elapsed = round(time.time() - start, 4)
        return {
            "total_elapsed": total_elapsed,
            "quads":         quads,
            "answers":       answers,
            "box_meta":      box_meta
        }