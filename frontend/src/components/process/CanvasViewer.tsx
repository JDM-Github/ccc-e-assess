import { useRef, useEffect, useCallback } from "react";
import { ReviewSession } from "../../lib/types/process_type";
import type { ViewMode } from "../../controllers/process/useReviewController";

function lerp(a: [number, number], b: [number, number], t: number): [number, number] {
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

function bilinearPoint(
    tl: [number, number], tr: [number, number],
    bl: [number, number], br: [number, number],
    u: number, v: number,
): [number, number] {
    return lerp(lerp(tl, tr, u), lerp(bl, br, u), v);
}

function cellCorners(
    tl: [number, number], tr: [number, number],
    bl: [number, number], br: [number, number],
    col: number, row: number, cols: number, rows: number,
) {
    const u0 = col / cols, u1 = (col + 1) / cols;
    const v0 = row / rows, v1 = (row + 1) / rows;
    return {
        tl: bilinearPoint(tl, tr, bl, br, u0, v0),
        tr: bilinearPoint(tl, tr, bl, br, u1, v0),
        bl: bilinearPoint(tl, tr, bl, br, u0, v1),
        br: bilinearPoint(tl, tr, bl, br, u1, v1),
    };
}

function pointInQuad(
    px: number, py: number,
    p0: [number, number], p1: [number, number],
    p2: [number, number], p3: [number, number],
): boolean {
    function cross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number) {
        return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    }
    const c0 = cross(p0[0], p0[1], p1[0], p1[1], px, py);
    const c1 = cross(p1[0], p1[1], p2[0], p2[1], px, py);
    const c2 = cross(p2[0], p2[1], p3[0], p3[1], px, py);
    const c3 = cross(p3[0], p3[1], p0[0], p0[1], px, py);
    return (c0 >= 0 && c1 >= 0 && c2 >= 0 && c3 >= 0) || (c0 <= 0 && c1 <= 0 && c2 <= 0 && c3 <= 0);
}

function stripCorners(
    tl: [number, number], tr: [number, number],
    bl: [number, number], br: [number, number],
    index: number, isRow: boolean, cols: number, rows: number,
) {
    if (isRow) {
        const first = cellCorners(tl, tr, bl, br, 0, index, cols, rows);
        const last = cellCorners(tl, tr, bl, br, cols - 1, index, cols, rows);
        return { tl: first.tl, tr: last.tr, bl: first.bl, br: last.br };
    } else {
        const first = cellCorners(tl, tr, bl, br, index, 0, cols, rows);
        const last = cellCorners(tl, tr, bl, br, index, rows - 1, cols, rows);
        return { tl: first.tl, tr: first.tr, bl: last.bl, br: last.br };
    }
}

function strokeQuad(
    ctx: CanvasRenderingContext2D,
    corners: { tl: [number, number]; tr: [number, number]; bl: [number, number]; br: [number, number] },
    color: string, lineWidth: number, dash: number[],
) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(corners.tl[0], corners.tl[1]);
    ctx.lineTo(corners.tr[0], corners.tr[1]);
    ctx.lineTo(corners.br[0], corners.br[1]);
    ctx.lineTo(corners.bl[0], corners.bl[1]);
    ctx.closePath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
}

const COL_HUES = [200, 150, 30, 270, 340, 180, 50, 300, 100, 240];

const cellColor = (i: number, a: number) => `hsla(${COL_HUES[i % COL_HUES.length]}, 65%, 55%, ${a})`;
const cellStroke = (i: number) => `hsl(${COL_HUES[i % COL_HUES.length]}, 55%, 38%)`;

function cellLabel(row: number, col: number, checkByCol: boolean): string {
    return checkByCol ? String(row) : String.fromCharCode(65 + col);
}
function choiceIndex(row: number, col: number, checkByCol: boolean): number {
    return checkByCol ? row : col;
}
function readCell(answers: boolean[][] | undefined, row: number, col: number, checkByCol: boolean): boolean {
    if (!answers) return false;
    return checkByCol ? (answers[col]?.[row] ?? false) : (answers[row]?.[col] ?? false);
}
function fillQuad(
    ctx: CanvasRenderingContext2D,
    corners: { tl: [number, number]; tr: [number, number]; bl: [number, number]; br: [number, number] },
    color: string,
) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(corners.tl[0], corners.tl[1]);
    ctx.lineTo(corners.tr[0], corners.tr[1]);
    ctx.lineTo(corners.br[0], corners.br[1]);
    ctx.lineTo(corners.bl[0], corners.bl[1]);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 11;
const ZOOM_FACTOR = 1.05;

interface CanvasViewerProps {
    session: ReviewSession;
    mode: ViewMode;
    onToggle: (boxIdx: number, row: number, col: number) => void;
}

export default function CanvasViewer({ session, mode, onToggle }: CanvasViewerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef = useRef<HTMLImageElement | null>(null);
    const rafRef = useRef<number | null>(null);
    const modeRef = useRef<ViewMode>(mode);
    const sessionRef = useRef<ReviewSession>(session);
    const onToggleRef = useRef(onToggle);

    useEffect(() => { modeRef.current = mode; }, [mode]);
    useEffect(() => { sessionRef.current = session; scheduleDraw(); }, [session]);
    useEffect(() => { onToggleRef.current = onToggle; }, [onToggle]);

    const vRef = useRef({
        zoom: 1, panX: 0, panY: 0, loaded: false,
        dragging: false, dragStartX: 0, dragStartY: 0,
        dragMoved: false, lastX: 0, lastY: 0,
    });

    function scheduleDraw() {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(drawFrame);
    }

    function drawFrame() {
        const canvas = canvasRef.current;
        const img = imgRef.current;
        const s = sessionRef.current;
        if (!canvas || !img || !vRef.current.loaded) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const { zoom, panX, panY } = vRef.current;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(panX, panY);
        ctx.scale(zoom, zoom);
        ctx.drawImage(img, 0, 0, img.naturalWidth, img.naturalHeight);

        const groupTotalFilled = new Map<string, number>();
        for (let bi = 0; bi < s.boxes.length; bi++) {
            const group = s.boxes[bi].group;
            if (group === null) continue;
            const answers = s.answers[bi];
            let count = 0;
            if (answers) {
                for (const row of answers) for (const v of row) if (v) count++;
            }
            groupTotalFilled.set(group, (groupTotalFilled.get(group) ?? 0) + count);
        }

        for (let bi = 0; bi < s.boxes.length; bi++) {
            const box = s.boxes[bi];
            const quad = s.quads[bi];
            if (!quad) continue;

            const answers = s.answers[bi];
            const cols = box.grid_cols;
            const rows = box.grid_rows;
            const checkByCol = box.check_by_col;

            const tl = quad.tl as [number, number];
            const tr = quad.tr as [number, number];
            const bl = quad.bl as [number, number];
            const br = quad.br as [number, number];

            const questionCount = checkByCol ? cols : rows;
            const fillCount: number[] = new Array(questionCount).fill(0);

            if (answers) {
                if (checkByCol) {
                    for (let c = 0; c < cols; c++)
                        for (let r = 0; r < rows; r++)
                            if (answers[c]?.[r]) fillCount[c]++;
                } else {
                    for (let r = 0; r < rows; r++)
                        for (let c = 0; c < cols; c++)
                            if (answers[r]?.[c]) fillCount[r]++;
                }
            }

            
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const corners = cellCorners(tl, tr, bl, br, c, r, cols, rows);
                    const filled = readCell(answers, r, c, checkByCol);
                    const cidx = choiceIndex(r, c, checkByCol);

                    ctx.beginPath();
                    ctx.moveTo(corners.tl[0], corners.tl[1]);
                    ctx.lineTo(corners.tr[0], corners.tr[1]);
                    ctx.lineTo(corners.br[0], corners.br[1]);
                    ctx.lineTo(corners.bl[0], corners.bl[1]);
                    ctx.closePath();

                    if (filled) {
                        ctx.fillStyle = cellColor(cidx, 0.55);
                        ctx.fill();
                        ctx.strokeStyle = cellStroke(cidx);
                        ctx.lineWidth = 1.5 / zoom;
                        ctx.stroke();
                    } else {
                        ctx.strokeStyle = "rgba(114, 178, 255, 0.4)";
                        ctx.lineWidth = 0.7 / zoom;
                        ctx.stroke();
                    }

                    if (zoom > 1.8) {
                        const cx = (corners.tl[0] + corners.br[0]) / 2;
                        const cy = (corners.tl[1] + corners.br[1]) / 2;
                        ctx.fillStyle = filled ? "rgba(36, 151, 180, 0.9)" : "rgba(14, 87, 196, 0.95)";
                        ctx.font = `${Math.max(7, 10 / zoom)}px monospace`;
                        ctx.textAlign = "center";
                        ctx.textBaseline = "middle";
                        ctx.fillText(cellLabel(r, c, checkByCol), cx, cy);
                    }
                }
            }

            const borderWidth = 2.5 / zoom;
            const pad = 1.5 / zoom;

            const isGrouped = box.group !== null;
            const groupTotal = isGrouped ? (groupTotalFilled.get(box.group!) ?? 0) : 0;

            for (let qi = 0; qi < questionCount; qi++) {
                const count = fillCount[qi];

                let isDouble = false;
                let isBlank = false;

                if (isGrouped) {
                    isBlank = groupTotal === 0;
                    isDouble = groupTotal > 1;
                } else {
                    isDouble = count > 1;
                    isBlank = count === 0;
                }

                if (!isDouble && !isBlank) continue;

                const isRow = !checkByCol;
                const sc = stripCorners(tl, tr, bl, br, qi, isRow, cols, rows);
                const nudged = {
                    tl: [sc.tl[0] - pad, sc.tl[1] - pad] as [number, number],
                    tr: [sc.tr[0] + pad, sc.tr[1] - pad] as [number, number],
                    br: [sc.br[0] + pad, sc.br[1] + pad] as [number, number],
                    bl: [sc.bl[0] - pad, sc.bl[1] + pad] as [number, number],
                };

                if (isDouble) {
                    strokeQuad(ctx, nudged, "rgb(252,38,38)", borderWidth, []);
                    fillQuad(ctx, nudged, "rgba(239,68,68,0.25)");
                } else {
                    strokeQuad(ctx, nudged, "rgba(255, 115, 0, 0.95)", borderWidth + 1 / zoom, []);
                    fillQuad(ctx, nudged, "rgba(251,191,36,0.25)");
                }
            }
        }

        ctx.restore();
    }

    const fitImage = useCallback(() => {
        const canvas = canvasRef.current;
        const img = imgRef.current;
        const container = containerRef.current;
        if (!canvas || !img || !container) return;
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        canvas.width = cw;
        canvas.height = ch;
        const scale = Math.min(cw / img.naturalWidth, ch / img.naturalHeight) * 0.96;
        vRef.current.zoom = Math.min(Math.max(scale, MIN_ZOOM), MAX_ZOOM);
        vRef.current.panX = (cw - img.naturalWidth * vRef.current.zoom) / 2;
        vRef.current.panY = (ch - img.naturalHeight * vRef.current.zoom) / 2;
        scheduleDraw();
    }, []);

    
    useEffect(() => {
        vRef.current.loaded = false;
        const img = new Image();
        img.onload = () => { imgRef.current = img; vRef.current.loaded = true; fitImage(); };
        img.src = `data:image/png;base64,${session.resultImage}`;
    }, [session.resultImage]);

    
    useEffect(() => {
        const observer = new ResizeObserver(() => {
            const canvas = canvasRef.current;
            const container = containerRef.current;
            if (!canvas || !container) return;
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
            scheduleDraw();
        });
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const handler = (e: WheelEvent) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;
            const my = e.clientY - rect.top;
            const v = vRef.current;
            const factor = e.deltaY < 0 ? ZOOM_FACTOR : 1 / ZOOM_FACTOR;
            const newZoom = Math.min(Math.max(v.zoom * factor, MIN_ZOOM), MAX_ZOOM);
            if (newZoom === v.zoom) return;
            v.panX = mx - (mx - v.panX) * (newZoom / v.zoom);
            v.panY = my - (my - v.panY) * (newZoom / v.zoom);
            v.zoom = newZoom;
            scheduleDraw();
        };
        canvas.addEventListener("wheel", handler, { passive: false });
        return () => canvas.removeEventListener("wheel", handler);
    }, []);

    const onMouseDown = useCallback((e: React.MouseEvent) => {
        if (e.button !== 0) return;
        const v = vRef.current;
        v.dragging = true;
        v.dragMoved = false;
        v.dragStartX = e.clientX;
        v.dragStartY = e.clientY;
        v.lastX = e.clientX;
        v.lastY = e.clientY;
    }, []);

    const onMouseMove = useCallback((e: React.MouseEvent) => {
        const v = vRef.current;
        if (!v.dragging) return;
        if (Math.abs(e.clientX - v.dragStartX) > 3 || Math.abs(e.clientY - v.dragStartY) > 3)
            v.dragMoved = true;
        if (modeRef.current === "pan") {
            v.panX += e.clientX - v.lastX;
            v.panY += e.clientY - v.lastY;
            scheduleDraw();
        }
        v.lastX = e.clientX;
        v.lastY = e.clientY;
    }, []);

    const onMouseUp = useCallback((e: React.MouseEvent) => {
        const v = vRef.current;
        if (!v.dragging) return;
        v.dragging = false;
        if (modeRef.current === "focus" && !v.dragMoved) {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const mx = (e.clientX - rect.left - v.panX) / v.zoom;
            const my = (e.clientY - rect.top - v.panY) / v.zoom;
            const s = sessionRef.current;
            outer:
            for (let bi = 0; bi < s.boxes.length; bi++) {
                const box = s.boxes[bi];
                const quad = s.quads[bi];
                if (!quad) continue;
                const tl = quad.tl as [number, number];
                const tr = quad.tr as [number, number];
                const bl = quad.bl as [number, number];
                const br = quad.br as [number, number];
                for (let r = 0; r < box.grid_rows; r++) {
                    for (let c = 0; c < box.grid_cols; c++) {
                        const corners = cellCorners(tl, tr, bl, br, c, r, box.grid_cols, box.grid_rows);
                        if (pointInQuad(mx, my, corners.tl, corners.tr, corners.br, corners.bl)) {
                            onToggleRef.current(bi, r, c);
                            break outer;
                        }
                    }
                }
            }
        }
    }, []);

    const onMouseLeave = useCallback(() => { vRef.current.dragging = false; }, []);

    return (
        <div
            ref={containerRef}
            className={[
                "w-full h-full relative overflow-hidden",
                mode === "pan" ? "cursor-grab" : "cursor-cell",
            ].join(" ")}
        >
            <canvas
                ref={canvasRef}
                className="block w-full h-full"
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseLeave}
                onContextMenu={(e) => e.preventDefault()}
            />
        </div>
    );
}