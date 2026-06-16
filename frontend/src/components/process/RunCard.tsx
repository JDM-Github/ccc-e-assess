import { motion, AnimatePresence } from "framer-motion";
import StatusPill from "./StatusPill";
import type { RunStatus } from "../../lib/types/process_type";

interface RunCardProps {
    isPdf: boolean;
    busy: boolean;
    file: File | null;
    runStatus: RunStatus;
    overallStatus: RunStatus | "streaming";
    runError?: string;
    batchProcessing: boolean;
    batchTotalPages: number | null;
    donePages: number;
    canReview: boolean;
    buildingReview: boolean;
    reviewableCount: number;
    onRun: () => void;
    onOpenReview: () => void;
}

export default function RunCard({
    isPdf, busy, file, runStatus, overallStatus, runError,
    batchProcessing, batchTotalPages, donePages,
    canReview, buildingReview, reviewableCount,
    onRun, onOpenReview,
}: RunCardProps) {
    const buttonLabel = isPdf ? "Process all pages" : "Run pipeline";
    const endpoint = isPdf
        ? "image_processor/pipeline/batch/stream"
        : "image_processor/pipeline";

    const runBtnCls = (() => {
        if (runStatus === "error")
            return "bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.3)] text-[var(--color-neg)]";
        if (runStatus === "done" || batchProcessing)
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
                        Run
                    </span>
                    <span className="w-px h-3 bg-[var(--color-border2)]" />
                    <span className="text-[13px] font-semibold text-[var(--color-text)]">
                        Pipeline
                    </span>
                </div>
                <StatusPill status={overallStatus} />
            </div>

            
            <div className="p-[18px] flex flex-col gap-2.5">

                
                <button
                    className={[
                        "w-full flex items-center justify-between px-3 py-[9px] rounded-[7px]",
                        "text-[12px] font-mono font-semibold tracking-[0.02em]",
                        "transition-all duration-150 active:scale-[0.98]",
                        "disabled:opacity-30 disabled:cursor-not-allowed",
                        runBtnCls,
                    ].join(" ")}
                    onClick={onRun}
                    disabled={!file || busy}
                >
                    <span>{buttonLabel}</span>
                    <span className="flex items-center gap-1.5">
                        {busy && (
                            <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin opacity-60" />
                        )}
                        {!busy && runStatus === "done" && <span className="text-[10px] opacity-75">✔</span>}
                        {runStatus === "error" && !busy && <span className="text-[10px]">✖</span>}
                        {busy && <span className="text-[9px] opacity-60">running</span>}
                    </span>
                </button>

                
                <AnimatePresence>
                    {batchProcessing && batchTotalPages != null && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.18 }}
                            className="flex flex-col gap-1.5 pt-0.5 overflow-hidden"
                        >
                            <div className="flex justify-between items-center">
                                <span className="text-[9px] font-mono text-[var(--color-text-faint)]">
                                    {donePages} / {batchTotalPages} pages
                                </span>
                                <span className="text-[9px] font-mono text-[var(--color-accent)] animate-pulse">
                                    streaming…
                                </span>
                            </div>
                            <div className="h-[3px] rounded-full bg-[var(--color-surface2)] overflow-hidden">
                                <motion.div
                                    className="h-full bg-[var(--color-accent)] rounded-full"
                                    animate={{ width: `${(donePages / batchTotalPages) * 100}%` }}
                                    transition={{ duration: 0.3 }}
                                />
                            </div>
                            
                            <div className="flex flex-wrap gap-1 pt-0.5">
                                {Array.from({ length: batchTotalPages }).map((_, i) => {
                                    const isDone = i < donePages;
                                    return (
                                        <motion.div
                                            key={i}
                                            initial={{ scale: 0.5, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            transition={{ delay: i * 0.04, duration: 0.2 }}
                                            className={[
                                                "w-[6px] h-[6px] rounded-full transition-colors duration-300",
                                                isDone
                                                    ? "bg-[var(--color-accent)]"
                                                    : "bg-[var(--color-border2)]",
                                            ].join(" ")}
                                        />
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                
                <AnimatePresence>
                    {runStatus === "error" && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18 }}
                            className="bg-[rgba(239,68,68,0.05)] border border-[rgba(239,68,68,0.25)] rounded-[8px] px-3 py-2.5"
                        >
                            <span className="text-[9px] font-mono font-bold tracking-[0.12em] text-[var(--color-neg)] block mb-1 uppercase">
                                Error
                            </span>
                            <pre className="font-mono text-[11px] text-[var(--color-text-muted)] whitespace-pre-wrap break-all leading-relaxed m-0">
                                {runError}
                            </pre>
                        </motion.div>
                    )}
                </AnimatePresence>

                
                <AnimatePresence>
                    {canReview && (
                        <motion.button
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.15 }}
                            className={[
                                "w-full flex items-center justify-between px-3 py-[9px] rounded-[7px] overflow-hidden",
                                "text-[12px] font-mono font-semibold",
                                "border border-[var(--color-border2)] bg-[var(--color-surface2)]",
                                "text-[var(--color-text)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]",
                                "disabled:opacity-30 disabled:cursor-not-allowed transition-colors duration-150",
                            ].join(" ")}
                            onClick={onOpenReview}
                            disabled={buildingReview}
                        >
                            <span>
                                {buildingReview
                                    ? "Loading…"
                                    : `Review answers${reviewableCount > 1 ? ` (${reviewableCount} pages)` : ""}`}
                            </span>
                            {buildingReview
                                ? <span className="w-3 h-3 border border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                                : <span className="text-[10px] opacity-60">→</span>
                            }
                        </motion.button>
                    )}
                </AnimatePresence>

                
                <p className="text-[9px] font-mono text-[var(--color-text-faint)] text-center mt-0.5">
                    POST /api/{endpoint}
                </p>
            </div>
        </motion.div>
    );
}