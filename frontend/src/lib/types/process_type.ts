export type AnswerGrid = boolean[][];

export interface QuadCorners {
    tl: [number, number];
    tr: [number, number];
    bl: [number, number];
    br: [number, number];
}

export interface BoxMeta {
    title: string;
    grid_cols: number;
    grid_rows: number;
    columns: string[]; 
    check_by_row: boolean;
    check_by_col: boolean;
    is_combined: boolean;
    has_own_sheet: boolean;
    no_double: boolean;
    no_blank: boolean;
    group: string | null;
    is_answerer: boolean;
}

export interface ReviewSession {
    resultImage: string;
    boxes: BoxMeta[];
    answers: AnswerGrid[];
    quads: QuadCorners[];
}

export interface PipelineResult {
    result: string;
    answers: boolean[][][];
    quads: QuadCorners[];
    box_meta: BoxMeta[];
    total_elapsed?: number;
    elapsed?: number;
}

export interface UnifiedPage {
    index: number;
    result: string | null;
    elapsed: number | null;
    error: string | null;
    answers: boolean[][][] | null;
    quads: QuadCorners[] | null;
    box_meta: BoxMeta[] | null;
}

export type RunStatus = "idle" | "loading" | "done" | "error";

// ── Excel export ──────────────────────────────────────────────────────────────

export interface ExcelPagePayload {
    page_index: number;
    box_meta: BoxMeta[];
    answers: boolean[][][];
}

export interface ExcelExportPayload {
    pages: ExcelPagePayload[];
}

export interface ExportViolation {
    page_index: number;
    box_title: string;
    question: number;
    type: "double" | "blank";
    answers: string[];
}