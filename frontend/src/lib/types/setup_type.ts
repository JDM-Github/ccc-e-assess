export interface BoxCoord {
    tl: [number, number];
    tr: [number, number];
    height: number;
    grid_cols: number;
    grid_rows: number;
    title: string;
    check_by_row: boolean;
    check_by_col: boolean;
    columns?: string[];
    is_combined: boolean;
    has_own_sheet: boolean;
    no_double: boolean;
    no_blank: boolean;
    group: string | null;
    is_answerer: boolean;
}

export interface MainConfig {
    OUTPUT_WIDTH: number;
    OUTPUT_HEIGHT: number;
    SCAN_RANGE: number;
    SAMPLE_PTS: number;
    DARK_THRESH: number;
}

export type AnswerQuiz = Record<string, string[]>;
export interface DrawingBox {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
}

export type RunStatus = "idle" | "loading" | "done" | "error";
export type CanvasMode = "pan" | "draw" | "move";

export const BOX_COLORS = [
    "#60a5fa", "#34d399", "#f97316", "#a78bfa", "#fb7185", "#facc15",
];

export function boxToRect(box: BoxCoord) {
    return {
        x: box.tl[0],
        y: box.tl[1],
        w: box.tr[0] - box.tl[0],
        h: box.height,
    };
}