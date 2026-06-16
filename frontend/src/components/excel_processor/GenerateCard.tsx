import { motion, AnimatePresence } from "framer-motion";
import { Download, Plus } from "lucide-react";
import FileSlot from "./FileSlot";
import type {
    FileSlotKey,
    GenerateErrorInfo,
    GenerateResult,
    GenerateStatus,
    SlotFile,
} from "../../lib/types/excel_processor_type";

interface GenerateCardProps {
    slotOrder: FileSlotKey[];
    slotLabels: Record<FileSlotKey, string>;
    slotMeta: Partial<Record<FileSlotKey, SlotFile>>;
    hasFile: Record<FileSlotKey, boolean>;
    dragKey: FileSlotKey | null;
    onDragOver: (key: FileSlotKey, e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (key: FileSlotKey, e: React.DragEvent) => void;
    onFileChange: (key: FileSlotKey, f: File) => void;
    onClear: (key: FileSlotKey) => void;
    allSlotsFilled: boolean;
    generateStatus: GenerateStatus;
    generateError: GenerateErrorInfo | null;
    lastResult: GenerateResult | null;
    onGenerate: () => void;
    canAddToQueue: boolean;
    addingToQueue: boolean;
    onAddToQueue: () => void;
    onDownloadTemplate: (kind: "template" | "applicant") => void;
}

const SLOT_HINTS: Record<FileSlotKey, string> = {
    applicant: "Names, programs, contact info per Application No.",
    answerer: "One sheet per subject — Application No. + Correct",
    template: "MASTERLIST + SCORESHEET layout to populate",
};

const ERROR_LABEL: Record<GenerateErrorInfo["kind"], string> = {
    integrity: "Data mismatch",
    validation: "Invalid request",
    server: "Server error",
    network: "Connection error",
};

export default function GenerateCard({
    slotOrder, slotLabels, slotMeta, hasFile,
    dragKey, onDragOver, onDragLeave, onDrop, onFileChange, onClear,
    allSlotsFilled, generateStatus, generateError, lastResult,
    onGenerate, canAddToQueue, addingToQueue, onAddToQueue, onDownloadTemplate
}: GenerateCardProps) {
    const busy = generateStatus === "loading";

    const runBtnCls = (() => {
        if (generateStatus === "error")
            return "bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.3)] text-[var(--color-neg)]";
        if (generateStatus === "done")
            return "bg-[var(--color-accent)] text-white border border-transparent";
        return "bg-[var(--color-surface2)] border border-[var(--color-border2)] text-[var(--color-text)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]";
    })();

    return (
        <motion.div
            className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[10px] overflow-hidden"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
        >
            <div className="px-[18px] py-[13px] border-b border-[var(--color-border)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono font-bold tracking-[0.12em] uppercase text-[var(--color-accent)] opacity-70">
                        Input
                    </span>
                    <span className="w-px h-3 bg-[var(--color-border2)]" />
                    <span className="text-[13px] font-semibold text-[var(--color-text)]">
                        Generate output
                    </span>
                </div>
                <span className="text-[9px] font-mono text-[var(--color-text-faint)] bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-[2px] rounded-[4px] tracking-[0.04em]">
                    3 FILES
                </span>
            </div>

            

            <div className="p-[18px] flex flex-col gap-3">
                <div className="grid grid-cols-3 gap-2.5">
                    {slotOrder.map((key) => (
                        <FileSlot
                            key={key}
                            label={slotLabels[key]}
                            hint={SLOT_HINTS[key]}
                            file={slotMeta[key]}
                            isDragging={dragKey === key}
                            onDragOver={(e) => onDragOver(key, e)}
                            onDragLeave={onDragLeave}
                            onDrop={(e) => onDrop(key, e)}
                            onFileChange={(f) => onFileChange(key, f)}
                            onClear={() => onClear(key)}
                            fromCache={slotMeta[key] != null && !hasFile[key]}
                        />
                    ))}
                </div>

                <button
                    className={[
                        "w-full flex items-center justify-between px-3 py-[9px] rounded-[7px]",
                        "text-[12px] font-mono font-semibold tracking-[0.02em]",
                        "transition-all duration-150 active:scale-[0.98]",
                        "disabled:opacity-30 disabled:cursor-not-allowed",
                        runBtnCls,
                    ].join(" ")}
                    onClick={onGenerate}
                    disabled={!allSlotsFilled || busy}
                >
                    <span>Generate masterlist &amp; scoresheet</span>
                    <span className="flex items-center gap-1.5">
                        {busy && <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin opacity-60" />}
                        {!busy && generateStatus === "done" && <span className="text-[10px] opacity-75">✔</span>}
                        {generateStatus === "error" && !busy && <span className="text-[10px]">✖</span>}
                        {busy && <span className="text-[9px] opacity-60">processing</span>}
                    </span>
                </button>

                <AnimatePresence>
                    {generateStatus === "error" && generateError && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18 }}
                            className="bg-[rgba(239,68,68,0.05)] border border-[rgba(239,68,68,0.25)] rounded-[8px] px-3 py-2.5"
                        >
                            <span className="text-[9px] font-mono font-bold tracking-[0.12em] text-[var(--color-neg)] block mb-1 uppercase">
                                {ERROR_LABEL[generateError.kind]}{generateError.status ? ` · ${generateError.status}` : ""}
                            </span>
                            <pre className="font-mono text-[11px] text-[var(--color-text-muted)] whitespace-pre-wrap break-words leading-relaxed m-0">
                                {generateError.message}
                            </pre>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {generateStatus === "done" && lastResult && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18 }}
                            className="bg-[var(--color-accent-dim)] border border-[var(--color-accent-border)] rounded-[8px] px-3 py-2.5 flex flex-col gap-1.5"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[9px] font-mono font-bold tracking-[0.12em] text-[var(--color-accent)] uppercase">
                                    Generated
                                </span>
                                <span className="text-[10px] font-mono text-[var(--color-text-muted)] truncate max-w-[160px]">
                                    {lastResult.filename}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--color-text-muted)]">
                                <span>{lastResult.totalGenerated} rows written</span>
                                {lastResult.skippedCount > 0 && (
                                    <span className="text-[var(--color-neg)]">{lastResult.skippedCount} skipped</span>
                                )}
                            </div>
                            {lastResult.skippedIds.length > 0 && (
                                <p className="text-[9px] font-mono text-[var(--color-text-faint)] break-all leading-relaxed m-0">
                                    Not found in applicant list: {lastResult.skippedIds.join(", ")}
                                </p>
                            )}

                            <button
                                onClick={onAddToQueue}
                                disabled={!canAddToQueue || addingToQueue}
                                className={[
                                    "mt-1 flex items-center justify-center gap-1.5 px-3 py-[7px] rounded-[6px]",
                                    "text-[11px] font-mono font-semibold border border-[var(--color-border2)]",
                                    "bg-[var(--color-surface2)] text-[var(--color-text-muted)]",
                                    "hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]",
                                    "transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed",
                                ].join(" ")}
                            >
                                <Plus size={12} strokeWidth={2.5} />
                                {addingToQueue ? "Adding…" : "Add to merge queue"}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <div className="flex justify-center items-center gap-3 mt-1">
                    <span className="text-[9px] font-mono text-[var(--color-text-faint)]">
                        Need a template?
                    </span>
                    <button
                        onClick={() => onDownloadTemplate("applicant")}
                        className="flex items-center gap-1 text-[9px] font-mono text-[var(--color-text-faint)] hover:text-[var(--color-accent)] transition-colors duration-150"
                    >
                        <Download size={10} strokeWidth={2.5} />
                        Applicant template
                    </button>
                    <span className="text-[var(--color-border2)]">·</span>
                    <button
                        onClick={() => onDownloadTemplate("template")}
                        className="flex items-center gap-1 text-[9px] font-mono text-[var(--color-text-faint)] hover:text-[var(--color-accent)] transition-colors duration-150"
                    >
                        <Download size={10} strokeWidth={2.5} />
                        Output template
                    </button>
                </div>

                <p className="text-[9px] font-mono text-[var(--color-text-faint)] text-center mt-0.5">
                    POST /api/excel_processor/generate
                </p>
            </div>
        </motion.div>
    );
}