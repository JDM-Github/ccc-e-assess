import { motion, AnimatePresence } from "framer-motion";
import { Layers, Download, X, Trash2 } from "lucide-react";
import type { MergeQueueItem, MergeStatus } from "../../lib/types/excel_processor_type";

interface MergeQueueCardProps {
    queue: MergeQueueItem[];
    queueLoaded: boolean;
    mergeStatus: MergeStatus;
    mergeError: string | null;
    canMerge: boolean;
    onMerge: () => void;
    onRemove: (id: string) => void;
    onDownload: (item: MergeQueueItem) => void;
    onClearAll: () => void;
}

function timeAgo(ts: number): string {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

export default function MergeQueueCard({
    queue, queueLoaded, mergeStatus, mergeError, canMerge,
    onMerge, onRemove, onDownload, onClearAll,
}: MergeQueueCardProps) {
    const busy = mergeStatus === "loading";

    const mergeBtnCls = (() => {
        if (mergeStatus === "error")
            return "bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.3)] text-[var(--color-neg)]";
        if (mergeStatus === "done")
            return "bg-[var(--color-accent)] text-white border border-transparent";
        return "bg-[var(--color-surface2)] border border-[var(--color-border2)] text-[var(--color-text)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]";
    })();

    return (
        <motion.div
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[10px] overflow-hidden"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05 }}
        >
            <div className="px-[18px] py-[13px] border-b border-[var(--color-border)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono font-bold tracking-[0.12em] uppercase text-[var(--color-accent)] opacity-70">
                        Queue
                    </span>
                    <span className="w-px h-3 bg-[var(--color-border2)]" />
                    <span className="text-[13px] font-semibold text-[var(--color-text)]">
                        Merge queue
                    </span>
                </div>
                <span className="text-[9px] font-mono text-[var(--color-text-faint)] bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-[2px] rounded-[4px] tracking-[0.04em]">
                    {queue.length} {queue.length === 1 ? "FILE" : "FILES"}
                </span>
            </div>

            <div className="p-[18px] flex flex-col gap-3">
                {!queueLoaded ? (
                    <div className="flex items-center justify-center py-8">
                        <span className="w-4 h-4 border border-[var(--color-border2)] border-t-[var(--color-accent)] rounded-full animate-spin" />
                    </div>
                ) : queue.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-7 px-3 text-center">
                        <div className="flex items-center justify-center w-8 h-8 rounded-[8px] bg-[var(--color-surface2)] text-[var(--color-text-faint)]">
                            <Layers size={14} strokeWidth={2} />
                        </div>
                        <p className="text-[10px] font-mono text-[var(--color-text-faint)] leading-relaxed max-w-[220px]">
                            Generate an output, then add it here. Keep adding as many as you need before merging.
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-1.5 max-h-[260px] overflow-y-auto pr-0.5">
                        <AnimatePresence initial={false}>
                            {queue.map((item, i) => (
                                <motion.div
                                    key={item.id}
                                    layout
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 8, height: 0 }}
                                    transition={{ duration: 0.18 }}
                                    className="flex items-center gap-2 px-2.5 py-2 rounded-[6px] bg-[var(--color-bg)] border border-[var(--color-border2)]"
                                >
                                    <span className="text-[9px] font-mono text-[var(--color-text-faint)] w-4 text-center shrink-0">
                                        {i + 1}
                                    </span>
                                    <div className="flex flex-col min-w-0 flex-1">
                                        <span className="text-[10px] font-mono text-[var(--color-text)] truncate">
                                            {item.filename}
                                        </span>
                                        <span className="text-[9px] font-mono text-[var(--color-text-faint)]">
                                            {item.totalGenerated} rows
                                            {item.skippedCount > 0 ? ` · ${item.skippedCount} skipped` : ""} · {timeAgo(item.addedAt)}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => onDownload(item)}
                                        className="flex items-center justify-center w-5 h-5 rounded-[4px] text-[var(--color-text-faint)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-dim)] transition-colors duration-100 shrink-0"
                                    >
                                        <Download size={11} strokeWidth={2.5} />
                                    </button>
                                    <button
                                        onClick={() => onRemove(item.id)}
                                        disabled={busy}
                                        className="flex items-center justify-center w-5 h-5 rounded-[4px] text-[var(--color-text-faint)] hover:text-[var(--color-neg)] hover:bg-[rgba(239,68,68,0.08)] transition-colors duration-100 shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <X size={12} strokeWidth={2.5} />
                                    </button>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}

                <button
                    className={[
                        "w-full flex items-center justify-between px-3 py-[9px] rounded-[7px]",
                        "text-[12px] font-mono font-semibold tracking-[0.02em]",
                        "transition-all duration-150 active:scale-[0.98]",
                        "disabled:opacity-30 disabled:cursor-not-allowed",
                        mergeBtnCls,
                    ].join(" ")}
                    onClick={onMerge}
                    disabled={!canMerge || busy}
                >
                    <span>Merge {queue.length > 0 ? `${queue.length} files` : "files"}</span>
                    <span className="flex items-center gap-1.5">
                        {busy && <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin opacity-60" />}
                        {!busy && mergeStatus === "done" && <span className="text-[10px] opacity-75">✔</span>}
                        {mergeStatus === "error" && !busy && <span className="text-[10px]">✖</span>}
                        {busy && <span className="text-[9px] opacity-60">merging</span>}
                    </span>
                </button>

                {queue.length === 1 && (
                    <p className="text-[9px] font-mono text-[var(--color-text-faint)] text-center -mt-1.5">
                        add at least one more file to merge
                    </p>
                )}

                <AnimatePresence>
                    {mergeStatus === "error" && mergeError && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18 }}
                            className="bg-[rgba(239,68,68,0.05)] border border-[rgba(239,68,68,0.25)] rounded-[8px] px-3 py-2.5"
                        >
                            <span className="text-[9px] font-mono font-bold tracking-[0.12em] text-[var(--color-neg)] block mb-1 uppercase">
                                Merge failed
                            </span>
                            <p className="font-mono text-[11px] text-[var(--color-text-muted)] leading-relaxed m-0">
                                {mergeError}
                            </p>
                            <p className="font-mono text-[10px] text-[var(--color-text-faint)] leading-relaxed mt-1.5 mb-0">
                                Your queue is untouched — nothing was lost. Try again once the merge endpoint is live.
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {queue.length > 0 && (
                    <button
                        onClick={onClearAll}
                        disabled={busy}
                        className="flex items-center justify-center gap-1.5 text-[9px] font-mono text-[var(--color-text-faint)] hover:text-[var(--color-neg)] transition-colors duration-150 mt-0.5 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <Trash2 size={10} strokeWidth={2} />
                        Clear queue
                    </button>
                )}

                <p className="text-[9px] font-mono text-[var(--color-text-faint)] text-center mt-0.5">
                    POST /api/excel_processor/merge
                </p>
            </div>
        </motion.div>
    );
}