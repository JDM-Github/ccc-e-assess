import { useRef, useState, useEffect, useCallback } from "react";
import { BoxCoord, boxToRect, DrawingBox, BOX_COLORS, CanvasMode } from "../../lib/types/setup_type";

const HANDLE_SIZE = 8; 

type Handle = "tl" | "tr" | "bl" | "br" | "body";

function getHandle(ic: { x: number; y: number }, box: BoxCoord, hs: number): Handle | null {
    const r = boxToRect(box);
    const corners: Record<Handle, { x: number; y: number }> = {
        tl: { x: r.x, y: r.y },
        tr: { x: r.x + r.w, y: r.y },
        bl: { x: r.x, y: r.y + r.h },
        br: { x: r.x + r.w, y: r.y + r.h },
        body: { x: 0, y: 0 },
    };
    for (const [k, pt] of Object.entries(corners)) {
        if (k === "body") continue;
        if (Math.abs(ic.x - pt.x) <= hs && Math.abs(ic.y - pt.y) <= hs) return k as Handle;
    }
    if (ic.x >= r.x && ic.x <= r.x + r.w && ic.y >= r.y && ic.y <= r.y + r.h) return "body";
    return null;
}

function getCursor(handle: Handle | null, mode: CanvasMode): string {
    if (mode !== "move") return mode === "draw" ? "crosshair" : "grab";
    if (!handle) return "default";
    if (handle === "body") return "move";
    if (handle === "tl" || handle === "br") return "nwse-resize";
    return "nesw-resize";
}

export default function ImageCanvas({
    imageUrl,
    naturalW,
    naturalH,
    boxes,
    mode,
    onBoxDrawn,
    onBoxChange,
    selectedIdx,
    onSelectBox,
}: {
    imageUrl: string;
    naturalW: number;
    naturalH: number;
    boxes: BoxCoord[];
    mode: CanvasMode;
    onBoxDrawn: (box: Omit<BoxCoord, "title" | "grid_cols" | "grid_rows">) => void;
    onBoxChange: (i: number, box: BoxCoord) => void;
    selectedIdx: number | null;
    onSelectBox: (i: number | null) => void;
}) {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);
    const [cursor, setCursor] = useState("grab");

    const stateRef = useRef({ scale, offset, boxes, selectedIdx, mode });
    useEffect(() => { stateRef.current = { scale, offset, boxes, selectedIdx, mode }; }, [scale, offset, boxes, selectedIdx, mode]);

    
    const panRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null);
    
    const drawRef = useRef<DrawingBox | null>(null);
    const [drawing, setDrawing] = useState<DrawingBox | null>(null);
    
    const moveRef = useRef<{
        boxIdx: number;
        handle: Handle;
        startIc: { x: number; y: number };
        origBox: BoxCoord;
    } | null>(null);

    
    useEffect(() => {
        const el = containerRef.current;
        if (!el || !naturalW || !naturalH) return;
        const { width, height } = el.getBoundingClientRect();
        const s = Math.min(width / naturalW, height / naturalH, 1);
        setScale(s);
        setOffset({ x: (width - naturalW * s) / 2, y: (height - naturalH * s) / 2 });
    }, [naturalW, naturalH, imageUrl]);

    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const handler = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const { scale: s, offset: o } = stateRef.current;
            const factor = e.deltaY > 0 ? 0.9 : 1.1;
            const rect = canvas.getBoundingClientRect();
            const cx = e.clientX - rect.left;
            const cy = e.clientY - rect.top;
            const next = Math.min(Math.max(s * factor, 0.05), 20);
            setScale(next);
            setOffset({ x: cx - (cx - o.x) * (next / s), y: cy - (cy - o.y) * (next / s) });
        };
        canvas.addEventListener("wheel", handler, { passive: false });
        return () => canvas.removeEventListener("wheel", handler);
    }, []);

    
    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        const ro = new ResizeObserver(() => {
            canvas.width = container.clientWidth;
            canvas.height = container.clientHeight;
        });
        ro.observe(container);
        return () => ro.disconnect();
    }, []);

    
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !naturalW || !naturalH) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const img = new Image();
        img.src = imageUrl;
        img.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(offset.x, offset.y);
            ctx.scale(scale, scale);

            ctx.drawImage(img, 0, 0, naturalW, naturalH);

            const hs = HANDLE_SIZE / scale;

            boxes.forEach((box, i) => {
                const r = boxToRect(box);
                const color = BOX_COLORS[i % BOX_COLORS.length];
                const selected = selectedIdx === i;

                ctx.globalAlpha = selected ? 1 : 0.7;
                ctx.strokeStyle = color;
                ctx.lineWidth = (selected ? 2.5 : 1.5) / scale;
                ctx.strokeRect(r.x, r.y, r.w, r.h);

                ctx.globalAlpha = selected ? 0.12 : 0.05;
                ctx.fillStyle = color;
                ctx.fillRect(r.x, r.y, r.w, r.h);

                ctx.globalAlpha = 1;
                ctx.fillStyle = color;
                ctx.font = `${Math.max(10, 11 / scale)}px monospace`;
                ctx.fillText(box.title || `Box ${i + 1}`, r.x + 4 / scale, r.y + 14 / scale);

                
                if (box.columns && box.columns.length > 0) {
                    const colW = r.w / box.grid_cols;
                    ctx.save();
                    ctx.font = `${Math.max(8, 9 / scale)}px monospace`;
                    ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
                    ctx.textAlign = "center";
                    for (let c = 0; c < Math.min(box.columns.length, box.grid_cols); c++) {
                        const cx = r.x + colW * (c + 0.5);
                        ctx.fillText(box.columns[c], cx, r.y + 10 / scale);
                    }
                    ctx.restore();
                }

                
                if (selected && mode === "move") {
                    const corners = [
                        { x: r.x, y: r.y },
                        { x: r.x + r.w, y: r.y },
                        { x: r.x, y: r.y + r.h },
                        { x: r.x + r.w, y: r.y + r.h },
                    ];
                    ctx.fillStyle = "#fff";
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1.5 / scale;
                    corners.forEach(({ x, y }) => {
                        ctx.beginPath();
                        ctx.rect(x - hs / 2, y - hs / 2, hs, hs);
                        ctx.fill();
                        ctx.stroke();
                    });
                }
            });

            if (drawing) {
                const x = Math.min(drawing.startX, drawing.endX);
                const y = Math.min(drawing.startY, drawing.endY);
                const w = Math.abs(drawing.endX - drawing.startX);
                const h = Math.abs(drawing.endY - drawing.startY);
                ctx.globalAlpha = 1;
                ctx.strokeStyle = "#60a5fa";
                ctx.lineWidth = 1.5 / scale;
                ctx.setLineDash([6 / scale, 3 / scale]);
                ctx.strokeRect(x, y, w, h);
                ctx.setLineDash([]);
                ctx.globalAlpha = 0.1;
                ctx.fillStyle = "#60a5fa";
                ctx.fillRect(x, y, w, h);
            }

            ctx.restore();
        };
    }, [imageUrl, naturalW, naturalH, scale, offset, boxes, drawing, selectedIdx, mode]);

    const toImageCoords = useCallback((clientX: number, clientY: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: Math.round((clientX - rect.left - offset.x) / scale),
            y: Math.round((clientY - rect.top - offset.y) / scale),
        };
    }, [offset, scale]);

    const resetView = () => {
        const el = containerRef.current;
        if (!el || !naturalW || !naturalH) return;
        const { width, height } = el.getBoundingClientRect();
        const s = Math.min(width / naturalW, height / naturalH, 1);
        setScale(s);
        setOffset({ x: (width - naturalW * s) / 2, y: (height - naturalH * s) / 2 });
    };

    const onMouseDown = (e: React.MouseEvent) => {
        const ic = toImageCoords(e.clientX, e.clientY);
        const { mode: m, boxes: bxs, selectedIdx: si } = stateRef.current;

        if (m === "draw") {
            drawRef.current = { startX: ic.x, startY: ic.y, endX: ic.x, endY: ic.y };
            setDrawing({ ...drawRef.current });
            return;
        }

        if (m === "move") {
            const hs = HANDLE_SIZE / stateRef.current.scale;
            
            const checkOrder = si !== null
                ? [si, ...bxs.map((_, i) => i).filter((i) => i !== si)]
                : bxs.map((_, i) => i).reverse();

            for (const i of checkOrder) {
                const h = getHandle(ic, bxs[i], hs);
                if (h) {
                    moveRef.current = { boxIdx: i, handle: h, startIc: ic, origBox: bxs[i] };
                    onSelectBox(i);
                    return;
                }
            }
            onSelectBox(null);
            return;
        }

        
        panRef.current = { startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y };
    };

    const onMouseMove = (e: React.MouseEvent) => {
        const ic = toImageCoords(e.clientX, e.clientY);
        setCoords({ x: Math.max(0, Math.min(ic.x, naturalW)), y: Math.max(0, Math.min(ic.y, naturalH)) });

        const { mode: m, boxes: bxs, selectedIdx: si } = stateRef.current;

        if (m === "draw" && drawRef.current) {
            drawRef.current.endX = ic.x;
            drawRef.current.endY = ic.y;
            setDrawing({ ...drawRef.current });
            return;
        }

        if (m === "move") {
            if (moveRef.current) {
                const { boxIdx, handle, startIc, origBox } = moveRef.current;
                const dx = ic.x - startIc.x;
                const dy = ic.y - startIc.y;
                const orig = origBox;
                let tl = [...orig.tl] as [number, number];
                let tr = [...orig.tr] as [number, number];
                let height = orig.height;

                if (handle === "body") {
                    tl = [orig.tl[0] + dx, orig.tl[1] + dy];
                    tr = [orig.tr[0] + dx, orig.tr[1] + dy];
                } else if (handle === "tl") {
                    tl = [orig.tl[0] + dx, orig.tl[1] + dy];
                    height = Math.max(10, orig.height - dy);
                } else if (handle === "tr") {
                    tr = [orig.tr[0] + dx, orig.tr[1] + dy];
                    height = Math.max(10, orig.height - dy);
                } else if (handle === "bl") {
                    tl = [orig.tl[0] + dx, orig.tl[1]];
                    height = Math.max(10, orig.height + dy);
                } else if (handle === "br") {
                    tr = [orig.tr[0] + dx, orig.tr[1]];
                    height = Math.max(10, orig.height + dy);
                }

                onBoxChange(boxIdx, { ...orig, tl, tr, height });
            } else {
                
                const hs = stateRef.current.scale > 0 ? HANDLE_SIZE / stateRef.current.scale : HANDLE_SIZE;
                let hit: Handle | null = null;
                const checkOrder = si !== null
                    ? [si, ...bxs.map((_, i) => i).filter((i) => i !== si)]
                    : [...bxs.map((_, i) => i)].reverse();
                for (const i of checkOrder) {
                    hit = getHandle(ic, bxs[i], hs);
                    if (hit) break;
                }
                setCursor(getCursor(hit, m));
            }
            return;
        }

        if (m === "pan" && panRef.current) {
            setOffset({
                x: panRef.current.ox + (e.clientX - panRef.current.startX),
                y: panRef.current.oy + (e.clientY - panRef.current.startY),
            });
        }
    };

    const onMouseUp = (e: React.MouseEvent) => {
        const { mode: m } = stateRef.current;

        if (m === "draw" && drawRef.current) {
            const d = drawRef.current;
            const x1 = Math.min(d.startX, d.endX);
            const y1 = Math.min(d.startY, d.endY);
            const x2 = Math.max(d.startX, d.endX);
            const h = Math.abs(d.endY - d.startY);
            if (x2 - x1 > 4 && h > 4)
                onBoxDrawn({
                    tl: [x1, y1],
                    tr: [x2, y1],
                    height: h,
                    check_by_row: true,
                    check_by_col: false,
                    is_combined: false,
                    has_own_sheet: false,
                    no_double: false,
                    no_blank: false,
                    group: null,
                    is_answerer: false
                });
            drawRef.current = null;
            setDrawing(null);
            return;
        }

        if (m === "move") {
            moveRef.current = null;
            return;
        }

        
        if (!panRef.current) return;
        const traveled = Math.abs(e.clientX - panRef.current.startX) + Math.abs(e.clientY - panRef.current.startY);
        if (traveled < 4) {
            const ic = toImageCoords(e.clientX, e.clientY);
            let hit: number | null = null;
            for (let i = stateRef.current.boxes.length - 1; i >= 0; i--) {
                const r = boxToRect(stateRef.current.boxes[i]);
                if (ic.x >= r.x && ic.x <= r.x + r.w && ic.y >= r.y && ic.y <= r.y + r.h) { hit = i; break; }
            }
            onSelectBox(hit);
        }
        panRef.current = null;
    };

    const activeCursor = mode === "draw" ? "crosshair" : mode === "move" ? cursor : (panRef.current ? "grabbing" : "grab");

    return (
        <div className="relative flex flex-col h-full">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface shrink-0">
                <button onClick={resetView} className="text-[10px] font-mono px-2.5 py-1 rounded-[5px] border border-border2 bg-surface2 text-text-muted hover:border-accent hover:text-accent transition-colors">Fit</button>
                <button onClick={() => setScale((s) => Math.min(s * 1.25, 20))} className="text-[10px] font-mono px-2.5 py-1 rounded-[5px] border border-border2 bg-surface2 text-text-muted hover:border-accent hover:text-accent transition-colors">+</button>
                <button onClick={() => setScale((s) => Math.max(s * 0.8, 0.05))} className="text-[10px] font-mono px-2.5 py-1 rounded-[5px] border border-border2 bg-surface2 text-text-muted hover:border-accent hover:text-accent transition-colors">−</button>
                <span className="text-[10px] font-mono text-text-faint">{Math.round(scale * 100)}%</span>
                <div className="flex-1" />
                {coords && <span className="text-[10px] font-mono text-text-faint tabular-nums">{coords.x}, {coords.y}</span>}
                <span className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded-[4px] ${mode === "draw" ? "bg-accent text-white" :
                    mode === "move" ? "bg-[#f97316] text-white" :
                        "text-text-faint border border-border2"
                    }`}>
                    {mode.toUpperCase()}
                </span>
            </div>

            <div ref={containerRef} className="flex-1 overflow-hidden" style={{ cursor: activeCursor }}>
                <canvas
                    ref={canvasRef}
                    style={{ width: "100%", height: "100%", display: "block" }}
                    onMouseDown={onMouseDown}
                    onMouseMove={onMouseMove}
                    onMouseUp={onMouseUp}
                    onMouseLeave={() => { setCoords(null); panRef.current = null; moveRef.current = null; }}
                />
            </div>
        </div>
    );
}