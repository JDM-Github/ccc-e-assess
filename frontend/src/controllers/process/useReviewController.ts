import { useState, useCallback, useEffect, useRef } from "react";
import { ReviewSession } from "../../lib/types/process_type";

type ViewMode = "pan" | "focus";
type ExportStatus = "idle" | "loading" | "done" | "error";

interface UnifiedPageRef {
    index: number;
    result: string | null;
    error: string | null;
}

function cloneAnswers(answers: boolean[][][]): boolean[][][] {
    return answers.map((grid) => grid.map((row) => [...row]));
}

interface UseReviewControllerProps {
    initialSessions: (ReviewSession | null)[];
    pages: UnifiedPageRef[];
    onSavePage: (pageIndex: number, updated: ReviewSession) => void;
    onBack: () => void;
}

export function useReviewController({
    initialSessions,
    pages,
    onSavePage,
    onBack,
}: UseReviewControllerProps) {
    const [sessions, setSessions] = useState<(ReviewSession | null)[]>(() =>
        initialSessions.map((s) => (s ? { ...s, answers: cloneAnswers(s.answers) } : null)),
    );
    const [pageIdx, setPageIdx] = useState<number>(() =>
        Math.max(0, initialSessions.findIndex((s) => s !== null)),
    );
    const [dirtyPages, setDirtyPages] = useState<Set<number>>(new Set());
    const [lastSaved, setLastSaved] = useState<number | null>(null);
    const [mode, setMode] = useState<ViewMode>("pan");

    const currentSession = sessions[pageIdx] ?? null;
    const totalPages = pages.length;
    const isDirty = dirtyPages.has(pageIdx);
    const isSaved = lastSaved === pageIdx && !isDirty;

    const commitPageRef = useRef<(idx: number) => void>(() => { });
    const commitPage = useCallback(
        (idx: number) => {
            const s = sessions[idx];
            if (s && dirtyPages.has(idx)) {
                onSavePage(idx, s);
                setDirtyPages((prev) => {
                    const next = new Set(prev);
                    next.delete(idx);
                    return next;
                });
            }
        },
        [sessions, dirtyPages, onSavePage],
    );

    commitPageRef.current = commitPage;

    const goToPage = useCallback(
        (nextIdx: number) => {
            if (nextIdx < 0 || nextIdx >= pages.length) return;
            commitPageRef.current(pageIdx);
            setPageIdx(nextIdx);
            setLastSaved(null);
        },
        [pageIdx, pages.length],
    );

    // Keyboard shortcuts — arrow keys for prev/next, p/f for mode
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            const tag = (e.target as HTMLElement)?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA") return;

            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                setPageIdx((prev) => {
                    if (prev >= pages.length - 1) return prev;
                    commitPageRef.current(prev);
                    setLastSaved(null);
                    return prev + 1;
                });
            }
            if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                setPageIdx((prev) => {
                    if (prev <= 0) return prev;
                    commitPageRef.current(prev);
                    setLastSaved(null);
                    return prev - 1;
                });
            }
            if (e.key === "p" || e.key === "P") setMode("pan");
            if (e.key === "f" || e.key === "F") setMode("focus");
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [pages.length]);

    const handleBack = useCallback(() => {
        commitPage(pageIdx);
        onBack();
    }, [pageIdx, commitPage, onBack]);

    const toggleCell = useCallback(
        (boxIdx: number, row: number, col: number) => {
            setSessions((prev) =>
                prev.map((s, i) => {
                    if (i !== pageIdx || !s) return s;
                    const checkByCol = s.boxes[boxIdx]?.check_by_col ?? false;
                    return {
                        ...s,
                        answers: s.answers.map((grid, gi) => {
                            if (gi !== boxIdx) return grid;
                            if (checkByCol) {
                                return grid.map((colData, ci) =>
                                    ci !== col ? colData : colData.map((v, ri) => (ri === row ? !v : v)),
                                );
                            } else {
                                return grid.map((rowData, ri) =>
                                    ri !== row ? rowData : rowData.map((v, ci) => (ci === col ? !v : v)),
                                );
                            }
                        }),
                    };
                }),
            );
            setDirtyPages((prev) => new Set(prev).add(pageIdx));
            setLastSaved(null);
        },
        [pageIdx],
    );

    const handleSave = useCallback(() => {
        const s = sessions[pageIdx];
        if (s) {
            onSavePage(pageIdx, s);
            setDirtyPages((prev) => {
                const next = new Set(prev);
                next.delete(pageIdx);
                return next;
            });
            setLastSaved(pageIdx);
        }
    }, [sessions, pageIdx, onSavePage]);

    const boxStats = currentSession
        ? (() => {
            const result: { title: string; answered: number; questionCount: number; pct: number; checkByCol: boolean }[] = [];
            const processedGroups = new Set<string>();

            currentSession.boxes.forEach((box, i) => {
                const group = box.group ?? null;

                if (group !== null) {
                    if (processedGroups.has(group)) return;
                    processedGroups.add(group);

                    const anyChecked = currentSession.boxes.some((b, gi) => {
                        if ((b.group ?? null) !== group) return false;
                        const grid = currentSession.answers[gi];
                        return grid?.some(row => row.some(Boolean)) ?? false;
                    });

                    result.push({
                        title: box.title,
                        answered: anyChecked ? 1 : 0,
                        questionCount: 1,
                        pct: anyChecked ? 100 : 0,
                        checkByCol: box.check_by_col,
                    });
                } else {
                    const grid = currentSession.answers[i];
                    let answered = 0;
                    let questionCount = 0;

                    if (grid) {
                        if (box.check_by_col) {
                            questionCount = box.grid_cols;
                            for (let c = 0; c < box.grid_cols; c++) {
                                if (grid[c]?.some(Boolean)) answered++;
                            }
                        } else {
                            questionCount = box.grid_rows;
                            for (let r = 0; r < box.grid_rows; r++) {
                                if (grid[r]?.some(Boolean)) answered++;
                            }
                        }
                    }

                    const pct = questionCount > 0 ? Math.round((answered / questionCount) * 100) : 0;
                    result.push({ title: box.title, answered, questionCount, pct, checkByCol: box.check_by_col });
                }
            });

            return result;
        })()
        : [];

    return {
        sessions,
        pageIdx,
        totalPages,
        currentSession,
        mode,
        setMode,
        isDirty,
        isSaved,
        dirtyPages,
        boxStats,
        goToPage,
        handleBack,
        toggleCell,
        handleSave,
    };
}

export type { ViewMode, ExportStatus, UnifiedPageRef };