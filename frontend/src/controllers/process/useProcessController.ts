import { useState, useRef, useCallback, useEffect } from "react";
import RequestHandler from "../../lib/utilities/request_handler";
import {
    BoxMeta,
    ExcelExportPayload,
    ExportViolation,
    PipelineResult,
    ReviewSession,
    RunStatus,
    UnifiedPage,
} from "../../lib/types/process_type";

const BLANK_PAGE = (index: number): UnifiedPage => ({
    index,
    result: null,
    elapsed: null,
    error: null,
    answers: null,
    quads: null,
    box_meta: null,
});

interface PageRange {
    start: number;
    upto: null | number,
    maxPages: null | number,
}
export function useProcessController() {
    const [file, setFile] = useState<File | null>(null);
    const [pageRange, setPageRange] = useState<Partial<PageRange>>({ start: 1 });

    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [dragging, setDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [pages, setPages] = useState<UnifiedPage[]>([]);
    const [runStatus, setRunStatus] = useState<RunStatus>("idle");
    const [batchProcessing, setBatchProcessing] = useState(false);
    const [batchTotalPages, setBatchTotalPages] = useState<number | null>(null);
    const [runError, setRunError] = useState<string | undefined>();

    const [reviewSessions, setReviewSessions] = useState<(ReviewSession | null)[] | null>(null);
    const [buildingReview, setBuildingReview] = useState(false);

    const [exportStatus, setExportStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
    const [exportError, setExportError] = useState<string | null>(null);

    const isPdf = file?.type === "application/pdf" || file?.name.toLowerCase().endsWith(".pdf");
    const busy = runStatus === "loading" || batchProcessing;
    const donePages = pages.filter((p) => p.result != null || p.error != null).length;
    const reviewableCount = pages.filter((p) => p.result != null).length;
    const canReview = !batchProcessing && runStatus !== "loading" && reviewableCount > 0;
    const overallStatus: RunStatus | "streaming" = batchProcessing ? "streaming" : runStatus;

    const resetState = () => {
        setRunStatus("idle");
        setRunError(undefined);
        setPages([]);
        setBatchTotalPages(null);
        setReviewSessions(null);
        setExportStatus("idle");
        setExportError(null);
    };

    const handleFile = (f: File) => {
        setFile(f);
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(f.type.startsWith("image/") ? URL.createObjectURL(f) : null);
        resetState();
    };

    useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, []);

    const onDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
        },
        [previewUrl],
    );

    const runSingle = async () => {
        if (!file) return;
        setRunStatus("loading");
        setPages([BLANK_PAGE(0)]);
        setReviewSessions(null);

        const fd = new FormData();
        fd.append("file", file);
        const res = await RequestHandler.fetchData("POST", "image_processor/pipeline", fd);

        if (res?.success === false) {
            setRunStatus("error");
            setRunError(res.message);
            setPages([{ ...BLANK_PAGE(0), error: res.message }]);
        } else {
            const data: PipelineResult = res?.data ?? {};
            setRunStatus("done");
            setPages([{
                index: 0,
                result: data.result ?? null,
                elapsed: data.total_elapsed ?? null,
                error: null,
                answers: data.answers ?? null,
                quads: data.quads ?? null,
                box_meta: data.box_meta ?? null,
            }]);
        }
    };

    const runBatch = async () => {
        if (!file) return;
        setPages([]);
        setBatchTotalPages(null);
        setBatchProcessing(true);
        setRunStatus("loading");
        setReviewSessions(null);

        const fd = new FormData();
        fd.append("file", file);
        fd.append("max_workers", "10");
        
        fd.append("start_page", String(pageRange.start));
        if (pageRange.upto != null) fd.append("upto", String(pageRange.upto));
        if (pageRange.maxPages != null) fd.append("max_pages", String(pageRange.maxPages));

        try {
            await RequestHandler.streamData(
                "POST",
                "image_processor/pipeline/batch/stream",
                fd,
                (msg: any) => {
                    if (msg.type === "total") {
                        setBatchTotalPages(msg.total_pages);
                        setPages(Array.from({ length: msg.total_pages }, (_, i) => BLANK_PAGE(i)));
                    } else if (msg.type === "page") {
                        const idx: number = msg.page_num ?? 0;
                        setPages((prev) => {
                            const next = [...prev];
                            next[idx] = {
                                index: idx,
                                result: msg.result ?? null,
                                elapsed: msg.elapsed ?? null,
                                error: msg.error ?? null,
                                answers: msg.answers ?? null,
                                quads: msg.quads ?? null,
                                box_meta: msg.box_meta ?? null,
                            };
                            return next;
                        });
                    } else if (msg.type === "done") {
                        setRunStatus("done");
                    } else if (msg.type === "error") {
                        setRunStatus("error");
                        setRunError(msg.message);
                    }
                },
            );
        } catch (err: unknown) {
            setRunStatus("error");
            setRunError((err as Error)?.message ?? "Unknown error");
        } finally {
            setBatchProcessing(false);
            setRunStatus((prev) => (prev === "loading" ? "done" : prev));
        }
    };

    const handleRun = () => (isPdf ? runBatch() : runSingle());

    const handleOpenReview = () => {
        setBuildingReview(true);
        try {
            const sessions: (ReviewSession | null)[] = pages.map((page) => {
                if (!page.result) return null;
                const boxesMeta: BoxMeta[] = page.box_meta ?? [];
                const answers: boolean[][][] = page.answers
                    ? page.answers.map((grid) => grid.map((row) => [...row]))
                    : boxesMeta.map((b) =>
                        Array.from({ length: b.grid_rows }, () =>
                            Array.from({ length: b.grid_cols }, () => false),
                        ),
                    );
                return { resultImage: page.result, boxes: boxesMeta, answers, quads: page.quads ?? [] };
            });
            setReviewSessions(sessions);
        } finally {
            setBuildingReview(false);
        }
    };

    const handleSaveReviewPage = (pageIndex: number, updated: ReviewSession) => {
        setPages((prev) =>
            prev.map((p, i) => (i === pageIndex ? { ...p, answers: updated.answers } : p)),
        );
        setReviewSessions((prev) =>
            prev ? prev.map((s, i) => (i === pageIndex ? updated : s)) : prev,
        );
    };

    const handleSaveToExcel = useCallback(async () => {
        const source = reviewSessions ?? null;
        if (!source) return;

        const violations: ExportViolation[] = [];
        source.forEach((session, pageIdx) => {
            if (!session) return;

            const groupedBoxIndices = new Set<number>();
            const groupMap = new Map<string, { bm: BoxMeta; boxIdx: number }[]>();
            session.boxes.forEach((bm, boxIdx) => {
                if (bm.group !== null) {
                    groupedBoxIndices.add(boxIdx);
                    const existing = groupMap.get(bm.group) ?? [];
                    existing.push({ bm, boxIdx });
                    groupMap.set(bm.group, existing);
                }
            });

            groupMap.forEach((groupBoxes) => {
                const needsNoDouble = groupBoxes.some(({ bm }) => bm.no_double);
                const needsNoBlank = groupBoxes.some(({ bm }) => bm.no_blank);
                if (!needsNoDouble && !needsNoBlank) return;

                const allChecked: string[] = [];
                groupBoxes.forEach(({ bm, boxIdx }) => {
                    const ag = session.answers[boxIdx] ?? [];
                    const cols = bm.columns ?? [];
                    if (bm.check_by_col) {
                        ag.forEach((colData) => {
                            colData.forEach((v, rowIdx) => {
                                if (v && rowIdx < cols.length) allChecked.push(cols[rowIdx]);
                            });
                        });
                    } else {
                        ag.forEach((row) => {
                            row.forEach((v, colIdx) => {
                                if (v && colIdx < cols.length) allChecked.push(cols[colIdx]);
                            });
                        });
                    }
                });

                const title = groupBoxes[0].bm.title;
                if (needsNoBlank && allChecked.length === 0)
                    violations.push({ page_index: pageIdx, box_title: title, question: 0, type: "blank", answers: [] });
                if (needsNoDouble && allChecked.length > 1)
                    violations.push({ page_index: pageIdx, box_title: title, question: 0, type: "double", answers: allChecked });
            });

            session.boxes.forEach((bm, boxIdx) => {
                if (groupedBoxIndices.has(boxIdx)) return;
                if (!bm.no_double && !bm.no_blank) return;
                const ag = session.answers[boxIdx] ?? [];
                const cols = bm.columns ?? [];
                const questionCount = bm.check_by_col ? bm.grid_cols : bm.grid_rows;
                for (let q = 0; q < questionCount; q++) {
                    const cellValues = ag[q] ?? [];
                    const checked = cols.filter((_, idx) => cellValues[idx]);
                    if (bm.no_blank && checked.length === 0)
                        violations.push({ page_index: pageIdx, box_title: bm.title, question: q + 1, type: "blank", answers: [] });
                    if (bm.no_double && checked.length > 1)
                        violations.push({ page_index: pageIdx, box_title: bm.title, question: q + 1, type: "double", answers: checked });
                }
            });
        });

        if (violations.length > 0) {
            setExportStatus("error");
            const lines = violations.slice(0, 10).map((v) => {
                const loc = v.question > 0 ? ` · Q${v.question}` : "";
                return v.type === "double"
                    ? `Page ${v.page_index + 1} · ${v.box_title}${loc}: double answer (${v.answers.join(",")})`
                    : `Page ${v.page_index + 1} · ${v.box_title}${loc}: blank`;
            });
            if (violations.length > 10) lines.push(`…and ${violations.length - 10} more`);
            setExportError(lines.join("\n"));
            return;
        }

        setExportStatus("loading");
        setExportError(null);

        const payload: ExcelExportPayload = {
            pages: source
                .map((session, i) => {
                    if (!session) return null;
                    return { page_index: i, box_meta: session.boxes, answers: session.answers as boolean[][][] };
                })
                .filter((p): p is NonNullable<typeof p> => p !== null),
        };

        try {
            const res = await RequestHandler.fetchData("POST", "image_processor/export", payload);
            if (res?.success === false) {
                setExportStatus("error");
                setExportError(res.message ?? "Export failed");
                return;
            }
            const b64: string = res?.data?.file ?? "";
            const filename: string = res?.data?.filename ?? "export.xlsx";
            if (b64) {
                const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
                const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = filename;
                a.click();
                URL.revokeObjectURL(url);
            }
            setExportStatus("done");
        } catch (err: unknown) {
            setExportStatus("error");
            setExportError((err as Error)?.message ?? "Unknown error");
        }
    }, [reviewSessions]);

    return {
        // file
        file, previewUrl, dragging, setDragging, fileInputRef, handleFile, onDrop,
        // derived
        isPdf, busy, donePages, reviewableCount, canReview, overallStatus,
        // run
        runStatus, runError, batchProcessing, batchTotalPages, pages,
        handleRun, setPages, setPageRange,
        // review
        reviewSessions, buildingReview, handleOpenReview, handleSaveReviewPage,
        setReviewSessions,
        // export
        exportStatus, exportError, handleSaveToExcel,
    };
}