import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Save, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import ModePill from "./ModePill";
import type { ViewMode, ExportStatus, UnifiedPageRef } from "../../controllers/process/useReviewController";
import { ReviewSession } from "../../lib/types/process_type";
import { PersistStatus } from "../../controllers/usePersistenceController";

interface ReviewSidebarProps {
    pageIdx: number;
    totalPages: number;
    sessions: (ReviewSession | null)[];
    pages: UnifiedPageRef[];
    dirtyPages: Set<number>;
    mode: ViewMode;
    isDirty: boolean;
    isSaved: boolean;
    currentSession: ReviewSession | null;
    exportStatus?: ExportStatus;
    exportError?: string | null;
    persistExportStatus?: PersistStatus;
    onSetMode: (m: ViewMode) => void;
    onGoToPage: (i: number) => void;
    onBack: () => void;
    onSave: () => void;
    onSaveToExcel?: () => void;
    onExportJSON?: () => void;
}

const EASE = [0.16, 1, 0.3, 1] as const;

function getPageStats(session: ReviewSession | null) {
    if (!session) return null;
    const processedGroups = new Set<string>();
    let total = 0;
    let answered = 0;

    session.boxes.forEach((box, bi) => {
        const group = box.group ?? null;
        if (group !== null) {
            if (processedGroups.has(group)) return;
            processedGroups.add(group);
            total++;
            const groupAnswered = session.boxes.some((b, gi) => {
                if ((b.group ?? null) !== group) return false;
                const grid = session.answers[gi];
                return grid?.some(row => row.some(Boolean)) ?? false;
            });
            if (groupAnswered) answered++;
        } else {
            total++;
            const grid = session.answers[bi];
            if (!grid) return;
            if (box.check_by_row) {
                if (grid.every(row => row.some(Boolean))) answered++;
            } else if (box.check_by_col) {
                const allColsAnswered = Array.from({ length: box.grid_cols }, (_, ci) =>
                    grid[ci]?.some(Boolean) ?? false
                ).every(Boolean);
                if (allColsAnswered) answered++;
            } else {
                if (grid.some(row => row.some(Boolean))) answered++;
            }
        }
    });

    return { total, answered };
}

type PageStatus = "done" | "partial" | "empty" | "error" | "no-data";

function getStatus(
    session: ReviewSession | null,
    page: UnifiedPageRef,
    stats: ReturnType<typeof getPageStats>
): PageStatus {
    if (!session) return "no-data";
    if (page.error) return "error";
    if (!stats || stats.total === 0) return "empty";
    if (stats.answered === stats.total) return "done";
    return "empty";
}

const STATUS_BADGE: Record<Exclude<PageStatus, "no-data">, { label: string; cls: string }> = {
    done: {
        label: "DONE",
        cls: "bg-[rgba(16,185,129,0.1)] text-[var(--color-pos)] border border-[rgba(16,185,129,0.2)]",
    },
    partial: {
        label: "PROG",
        cls: "bg-[rgba(245,158,11,0.1)] text-[var(--color-neu)] border border-[rgba(245,158,11,0.2)]",
    },
    empty: {
        label: "EMPTY",
        cls: "bg-[var(--color-surface2)] text-[var(--color-text-faint)] border border-[var(--color-border)]",
    },
    error: {
        label: "ERR",
        cls: "bg-[rgba(239,68,68,0.1)] text-[var(--color-neg)] border border-[rgba(239,68,68,0.2)]",
    },
};

const PROGRESS_FILL: Record<PageStatus, string> = {
    done: "bg-[var(--color-pos)]",
    partial: "bg-[var(--color-neu)]",
    empty: "bg-[var(--color-border2)]",
    error: "bg-[var(--color-neg)]",
    "no-data": "bg-[var(--color-border2)]",
};

export default function ReviewSidebar({
    pageIdx, totalPages, sessions, pages, dirtyPages,
    mode, isDirty, isSaved, currentSession,
    exportStatus = "idle", exportError = null,
    persistExportStatus = "idle",
    onSetMode, onGoToPage, onBack, onSave, onSaveToExcel, onExportJSON,
}: ReviewSidebarProps) {

    // Auto-scroll the selected page into view
    const listRef = useRef<HTMLDivElement>(null);
    const selectedRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (selectedRef.current && listRef.current) {
            selectedRef.current.scrollIntoView({ block: "nearest", behavior: "smooth" });
        }
    }, [pageIdx]);

    const excelLoading = exportStatus === "loading";
    const excelDone = exportStatus === "done";
    const excelFailed = exportStatus === "error";

    const excelBtnCls = excelFailed
        ? "border border-[rgba(239,68,68,0.3)] text-[var(--color-neg)] bg-[rgba(239,68,68,0.06)]"
        : excelDone
            ? "border border-[var(--color-border)] text-[var(--color-pos)] bg-[var(--color-surface2)]"
            : excelLoading
                ? "border border-[var(--color-border2)] text-[var(--color-text-faint)] bg-[var(--color-surface2)] opacity-60"
                : "border border-[var(--color-border2)] text-[var(--color-text-muted)] bg-[var(--color-surface2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]";

    const saveBtnCls = isSaved
        ? "border border-[var(--color-border)] text-[var(--color-pos)] bg-[var(--color-surface2)]"
        : isDirty
            ? "border border-transparent text-white bg-[var(--color-accent)] hover:opacity-90"
            : "border border-[var(--color-border)] text-[var(--color-text-faint)] bg-[var(--color-surface2)]";

    const jsonLoading = persistExportStatus === "saving";
    const jsonDone = persistExportStatus === "saved";
    const jsonFailed = persistExportStatus === "error";

    const jsonBtnCls = jsonFailed
        ? "border border-[rgba(239,68,68,0.3)] text-[var(--color-neg)] bg-[rgba(239,68,68,0.06)]"
        : jsonDone
            ? "border border-[rgba(16,185,129,0.3)] text-[var(--color-pos)] bg-[rgba(16,185,129,0.06)]"
            : jsonLoading
                ? "border border-[var(--color-border2)] text-[var(--color-text-faint)] bg-[var(--color-surface2)] opacity-60"
                : "border border-[var(--color-border2)] text-[var(--color-text-muted)] bg-[var(--color-surface2)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]";

    return (
        <div className="relative w-[360px] flex flex-col h-full gap-3 overflow-hidden">

            <div
                className="pointer-events-none fixed top-[-15%] left-[-8%] w-[480px] h-[480px] rounded-full opacity-[0.07] blur-[120px]"
                style={{ background: "radial-gradient(circle at 30% 30%, #4F6EF7 0%, transparent 70%)" }}
            />
            <div
                className="pointer-events-none fixed bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-[0.06] blur-[100px]"
                style={{ background: "radial-gradient(circle at 70% 70%, #10B981 0%, transparent 80%)" }}
            />

            {/* Header */}
            <motion.div
                className="flex flex-col gap-0.5 shrink-0"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE }}
            >
                <div className="flex items-center gap-2 mb-1">
                    <button
                        className="text-[10px] font-mono font-bold tracking-[0.12em] uppercase text-[var(--color-accent)] cursor-pointer"
                        onClick={onBack}
                    >
                        Image Processor
                    </button>
                    <span className="w-px h-3 bg-[var(--color-border2)]" />
                    <span className="text-[10px] font-mono text-[var(--color-text-faint)] tracking-[0.06em]">
                        REVIEW, SAVE, EXPORT
                    </span>
                </div>
                <h1 className="text-[1.6rem] font-extrabold text-[var(--color-text)] tracking-[-0.03em] leading-tight m-0">
                    Answer{" "}
                    <span
                        className="bg-clip-text text-transparent"
                        style={{ backgroundImage: "linear-gradient(135deg, #4F6EF7, #7C3AED)" }}
                    >
                        Review
                    </span>
                </h1>
                <p className="text-[0.75rem] font-mono text-[var(--color-text-muted)] leading-relaxed m-0">
                    Verify each page before exporting to Excel.
                </p>
            </motion.div>

            {/* Page list — flex-1 so it fills available space and scrolls */}
            <motion.div
                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[10px] overflow-hidden flex flex-col flex-1 min-h-0"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: EASE, delay: 0.06 }}
            >
                <div className="px-3.5 py-2 border-b border-[var(--color-border)] flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-semibold text-[var(--color-text)]">Pages</span>
                        <span className="text-[9px] font-mono text-[var(--color-text-faint)] bg-[var(--color-bg)] border border-[var(--color-border)] px-1.5 py-[1px] rounded-[3px]">
                            {pageIdx + 1} / {totalPages}
                        </span>
                    </div>
                    <div className="w-48">
                        <ModePill mode={mode} onChange={onSetMode} />
                    </div>
                </div>

                {/* Scrollable list — takes remaining height of the card */}
                <div ref={listRef} className="flex flex-col gap-px p-1.5 overflow-y-auto flex-1">
                    {pages.map((page, i) => {
                        const session = sessions[i];
                        const hasSession = session !== null;
                        const isSelected = i === pageIdx;
                        const isDirtyPage = dirtyPages.has(i);
                        const stats = getPageStats(session);
                        const status = getStatus(session, page, stats);
                        const pct = stats && stats.total > 0
                            ? Math.round((stats.answered / stats.total) * 100)
                            : 0;

                        return (
                            <button
                                key={i}
                                ref={isSelected ? selectedRef : undefined}
                                onClick={() => hasSession && onGoToPage(i)}
                                disabled={!hasSession}
                                className={[
                                    "w-full flex items-center gap-2.5 px-2.5 py-[7px] rounded-[5px] text-left transition-colors shrink-0",
                                    "disabled:opacity-40 disabled:cursor-not-allowed",
                                    isSelected
                                        ? "bg-[var(--color-accent-dim)] border border-[var(--color-accent-border)]"
                                        : "border border-transparent hover:bg-[var(--color-surface2)]",
                                ].join(" ")}
                            >
                                {/* Page number */}
                                <span className={[
                                    "text-[10px] font-mono font-bold tabular-nums shrink-0 w-6 text-right",
                                    isSelected ? "text-[var(--color-accent)]" : "text-[var(--color-text-faint)]",
                                ].join(" ")}>
                                    {i + 1}
                                </span>

                                {/* Progress bar + stat */}
                                <div className="flex-1 min-w-0 flex flex-col gap-[3px]">
                                    <div className="h-[3px] rounded-full bg-[var(--color-surface2)] overflow-hidden">
                                        <div
                                            className={["h-full rounded-full transition-all duration-300", PROGRESS_FILL[status]].join(" ")}
                                            style={{ width: status === "no-data" ? "0%" : `${pct}%` }}
                                        />
                                    </div>
                                    <span className="text-[9px] font-mono text-[var(--color-text-faint)] leading-none truncate">
                                        {!hasSession
                                            ? "no data"
                                            : page.error
                                                ? "error"
                                                : stats
                                                    ? `${stats.answered} / ${stats.total} boxes`
                                                    : "no boxes"
                                        }
                                    </span>
                                </div>

                                {/* Status badge */}
                                {status !== "no-data" && (
                                    <span className={[
                                        "text-[8px] font-mono font-bold px-1.5 py-[2px] rounded-[3px] shrink-0 leading-none",
                                        isDirtyPage
                                            ? "bg-[rgba(79,110,247,0.12)] text-[var(--color-accent)] border border-[var(--color-accent-border)]"
                                            : STATUS_BADGE[status].cls,
                                    ].join(" ")}>
                                        {isDirtyPage ? "EDIT" : STATUS_BADGE[status].label}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            </motion.div>

            {/* Actions — shrink-0 so they never get squeezed out */}
            <motion.div
                className="shrink-0 flex flex-col gap-1.5"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.18, duration: 0.3 }}
            >
                {/* Prev / Next */}
                <div className="flex gap-2">
                    <button
                        onClick={() => onGoToPage(pageIdx - 1)}
                        disabled={pageIdx === 0}
                        className="flex-1 flex items-center justify-center py-[7px] rounded-[6px] text-[11px] font-mono border border-[var(--color-border2)] bg-[var(--color-surface2)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        ← Prev
                    </button>
                    <button
                        onClick={() => onGoToPage(pageIdx + 1)}
                        disabled={pageIdx >= totalPages - 1}
                        className="flex-1 flex items-center justify-center py-[7px] rounded-[6px] text-[11px] font-mono border border-[var(--color-border2)] bg-[var(--color-surface2)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    >
                        Next →
                    </button>
                </div>

                {/* Export divider */}
                <div className="flex items-center gap-2 pt-0.5">
                    <div className="flex-1 h-px bg-[var(--color-border)]" />
                    <span className="text-[9px] font-mono font-bold tracking-[0.1em] uppercase text-[var(--color-text-faint)]">Export</span>
                    <div className="flex-1 h-px bg-[var(--color-border)]" />
                </div>

                {/* Excel */}
                <button
                    onClick={() => onSaveToExcel?.()}
                    disabled={excelLoading}
                    className={[
                        "w-full flex items-center justify-center gap-2 py-[7px] rounded-[6px]",
                        "text-[11px] font-mono font-semibold transition-all disabled:cursor-not-allowed",
                        excelBtnCls,
                    ].join(" ")}
                >
                    {excelLoading ? <Loader2 size={12} className="animate-spin shrink-0" />
                        : excelDone ? <CheckCircle size={12} className="shrink-0" />
                            : excelFailed ? <AlertCircle size={12} className="shrink-0" />
                                : <Download size={12} className="shrink-0" />}
                    <span>
                        {excelLoading ? "Exporting…" : excelDone ? "Exported to Excel" : excelFailed ? "Export failed" : "Export to Excel"}
                    </span>
                </button>

                <AnimatePresence>
                    {excelFailed && exportError && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.18 }}
                            className="overflow-hidden"
                        >
                            <div className="px-3 py-1.5 rounded-[5px] bg-[rgba(239,68,68,0.05)] border border-[rgba(239,68,68,0.2)]">
                                <p className="text-[9px] font-mono text-[var(--color-neg)] leading-relaxed break-all m-0">
                                    {exportError}
                                </p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* JSON snapshot */}
                <button
                    onClick={() => onExportJSON?.()}
                    disabled={jsonLoading}
                    className={[
                        "w-full flex items-center justify-center gap-2 py-[7px] rounded-[6px]",
                        "text-[11px] font-mono font-semibold transition-all disabled:cursor-not-allowed",
                        jsonBtnCls,
                    ].join(" ")}
                >
                    {jsonLoading ? <Loader2 size={12} className="animate-spin shrink-0" />
                        : jsonDone ? <CheckCircle size={12} className="shrink-0" />
                            : jsonFailed ? <AlertCircle size={12} className="shrink-0" />
                                : <Save size={12} className="shrink-0" />}
                    <span>
                        {jsonLoading ? "Saving…" : jsonDone ? "Snapshot saved" : jsonFailed ? "Save failed" : "Save snapshot (.json)"}
                    </span>
                </button>

                {/* Page divider */}
                <div className="flex items-center gap-2 pt-0.5">
                    <div className="flex-1 h-px bg-[var(--color-border)]" />
                    <span className="text-[9px] font-mono font-bold tracking-[0.1em] uppercase text-[var(--color-text-faint)]">Page</span>
                    <div className="flex-1 h-px bg-[var(--color-border)]" />
                </div>

                {/* Save page */}
                <button
                    onClick={onSave}
                    disabled={!currentSession}
                    className={[
                        "w-full flex items-center justify-center gap-2 py-[7px] rounded-[6px] text-[11px] font-mono font-semibold transition-all",
                        "disabled:opacity-30 disabled:cursor-not-allowed",
                        saveBtnCls,
                    ].join(" ")}
                >
                    {isSaved ? <CheckCircle size={12} className="shrink-0" />
                        : isDirty ? <Save size={12} className="shrink-0" />
                            : null}
                    <span>{isSaved ? "Saved" : isDirty ? "Save page" : "No changes"}</span>
                </button>
            </motion.div>
        </div>
    );
}