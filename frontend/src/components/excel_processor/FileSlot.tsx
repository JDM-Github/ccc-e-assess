import { useRef } from "react";
import { motion } from "framer-motion";
import { FileSpreadsheet, X, Check } from "lucide-react";
import type { SlotFile } from "../../lib/types/excel_processor_type";

interface FileSlotProps {
    label: string;
    hint: string;
    file: SlotFile | undefined;
    isDragging: boolean;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
    onFileChange: (f: File) => void;
    onClear: () => void;
    fromCache?: boolean;
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileSlot({
    label, hint, file, isDragging,
    onDragOver, onDragLeave, onDrop, onFileChange, onClear,
    fromCache,
}: FileSlotProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    const handlePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) onFileChange(f);
        e.target.value = "";
    };

    return (
        <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => !file && inputRef.current?.click()}
            className={[
                "relative flex flex-col gap-2 px-3 py-3 rounded-[8px] border transition-colors duration-150 cursor-pointer",
                isDragging
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-dim)]"
                    : file
                        ? "border-[var(--color-border2)] bg-[var(--color-bg)] cursor-default"
                        : "border-dashed border-[var(--color-border2)] bg-[var(--color-bg)] hover:border-[var(--color-accent)]",
            ].join(" ")}
        >
            <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={handlePick}
            />

            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span
                        className={[
                            "flex items-center justify-center w-4 h-4 rounded-[4px] shrink-0 transition-colors duration-150",
                            file ? "bg-[var(--color-accent)] text-white" : "bg-[var(--color-surface2)] text-[var(--color-text-faint)]",
                        ].join(" ")}
                    >
                        {file ? <Check size={10} strokeWidth={3} /> : <FileSpreadsheet size={10} strokeWidth={2.5} />}
                    </span>
                    <span className="text-[11px] font-semibold text-[var(--color-text)] truncate">{label}</span>
                </div>

                {file && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onClear(); }}
                        className="flex items-center justify-center w-4 h-4 rounded-[4px] text-[var(--color-text-faint)] hover:text-[var(--color-neg)] hover:bg-[rgba(239,68,68,0.08)] transition-colors duration-100 shrink-0"
                    >
                        <X size={11} strokeWidth={2.5} />
                    </button>
                )}
            </div>

            {file ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.15 }}
                    className="flex items-center justify-between gap-2"
                >
                    <span className="text-[10px] font-mono text-[var(--color-text-muted)] truncate">{file.name}</span>
                    <span className="text-[9px] font-mono text-[var(--color-text-faint)] shrink-0">{formatSize(file.size)}</span>
                </motion.div>
            ) : (
                <span className="text-[10px] font-mono text-[var(--color-text-faint)] leading-relaxed">
                    {hint}
                </span>
            )}

            {fromCache && file && (
                <span className="text-[9px] font-mono text-[var(--color-accent)] tracking-[0.04em] uppercase">
                    restored from last session · reselect to reuse
                </span>
            )}
        </div>
    );
}