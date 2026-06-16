import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import DropZone from "./DropZone";

interface InputCardProps {
    file: File | null;
    previewUrl: string | null;
    isPdf: boolean;
    dragging: boolean;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
    onFileChange: (f: File) => void;
    onPageRangeChange?: (range: { start: number; upto?: number; maxPages?: number }) => void;
}

type RangeMode = "upto" | "max_pages";

const numInput = [
    "w-[52px] px-2 py-[5px] rounded-[5px] text-[11px] font-mono text-center",
    "bg-[var(--color-bg)] border border-[var(--color-border2)]",
    "text-[var(--color-text)] placeholder:text-[var(--color-border2)] outline-none",
    "focus:border-[var(--color-accent)] transition-colors duration-100",
    "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
].join(" ");

export default function InputCard({
    file, previewUrl, isPdf, dragging,
    onDragOver, onDragLeave, onDrop, onFileChange,
    onPageRangeChange,
}: InputCardProps) {
    const [start, setStart] = useState(1);
    const [rangeMode, setRangeMode] = useState<RangeMode>("upto");
    const [upto, setUpto] = useState<number | "">("");
    const [maxPages, setMaxPages] = useState<number | "">("");

    const emitChange = (
        nextStart: number,
        nextMode: RangeMode,
        nextUpto: number | "",
        nextMax: number | "",
    ) => {
        const range: { start: number; upto?: number; maxPages?: number } = { start: nextStart };
        if (nextMode === "upto" && nextUpto !== "") range.upto = nextUpto as number;
        if (nextMode === "max_pages" && nextMax !== "") range.maxPages = nextMax as number;
        onPageRangeChange?.(range);
    };

    const handleStart = (v: string) => {
        const n = Math.max(1, parseInt(v) || 1);
        setStart(n);
        emitChange(n, rangeMode, upto, maxPages);
    };

    const handleUpto = (v: string) => {
        const n = v === "" ? "" : Math.max(1, parseInt(v) || 1);
        setUpto(n);
        emitChange(start, rangeMode, n, maxPages);
    };

    const handleMaxPages = (v: string) => {
        const n = v === "" ? "" : Math.max(1, parseInt(v) || 1);
        setMaxPages(n);
        emitChange(start, rangeMode, upto, n);
    };

    const handleModeSwitch = (mode: RangeMode) => {
        setRangeMode(mode);
        emitChange(start, mode, upto, maxPages);
    };

    const invalidRange = rangeMode === "upto" && upto !== "" && Number(upto) < start;

    const summary = (() => {
        if (rangeMode === "upto" && upto !== "") {
            if (invalidRange) return null;
            return `${Number(upto) - start + 1} pages`;
        }
        if (rangeMode === "max_pages" && maxPages !== "") return `${maxPages} pages from p.${start}`;
        return `all pages from p.${start}`;
    })();

    return (
        <motion.div
            className={[
                "bg-[var(--color-surface)] border rounded-[10px] overflow-hidden transition-colors duration-150",
                dragging ? "border-[var(--color-accent)]" : "border-[var(--color-border)]",
            ].join(" ")}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
        >
            {/* Header */}
            <div className="px-[18px] py-[13px] border-b border-[var(--color-border)] flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono font-bold tracking-[0.12em] uppercase text-[var(--color-accent)] opacity-70">
                        Input
                    </span>
                    <span className="w-px h-3 bg-[var(--color-border2)]" />
                    <span className="text-[13px] font-semibold text-[var(--color-text)]">
                        Upload file
                    </span>
                </div>
                {file && (
                    <span className="text-[9px] font-mono text-[var(--color-text-faint)] bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-[2px] rounded-[4px] tracking-[0.04em]">
                        {isPdf ? "PDF" : "IMAGE"}
                    </span>
                )}
            </div>

            {/* Body */}
            <div className="p-[18px] flex flex-col gap-3">
                <DropZone
                    file={file}
                    previewUrl={previewUrl}
                    isPdf={isPdf}
                    dragging={dragging}
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    onFileChange={onFileChange}
                />

                {/* PDF section — same visual weight as the card header */}
                <AnimatePresence>
                    {isPdf && (
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={{ duration: 0.18 }}
                            className="border-t border-[var(--color-border)] pt-3 flex flex-col gap-2.5"
                        >
                            {/* PDF badge row */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)] animate-pulse" />
                                    <span className="text-[9px] font-mono font-bold tracking-[0.1em] uppercase text-[var(--color-accent)]">
                                        PDF
                                    </span>
                                    <span className="text-[var(--color-border2)] text-[9px] font-mono">·</span>
                                    <span className="text-[9px] font-mono text-[var(--color-text-faint)]">
                                        parallel processing
                                    </span>
                                </div>

                                {/* Summary badge */}
                                <AnimatePresence mode="wait">
                                    {invalidRange ? (
                                        <motion.span
                                            key="invalid"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="text-[9px] font-mono text-[var(--color-neg)] bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] px-2 py-[2px] rounded-[4px]"
                                        >
                                            invalid range
                                        </motion.span>
                                    ) : summary ? (
                                        <motion.span
                                            key="summary"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="text-[9px] font-mono text-[var(--color-accent)] bg-[var(--color-accent-dim)] border border-[var(--color-accent-border)] px-2 py-[2px] rounded-[4px]"
                                        >
                                            {summary}
                                        </motion.span>
                                    ) : null}
                                </AnimatePresence>
                            </div>

                            {/* Inline controls row */}
                            <div className="flex items-center gap-2">

                                {/* Start label + input */}
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-mono text-[var(--color-text-faint)] tracking-[0.06em] uppercase shrink-0">
                                        From
                                    </span>
                                    <input
                                        type="number"
                                        min={1}
                                        value={start}
                                        onChange={(e) => handleStart(e.target.value)}
                                        className={numInput}
                                    />
                                </div>

                                <span className="text-[var(--color-border2)] text-[10px] font-mono">→</span>

                                {/* Mode toggle */}
                                <div className="flex items-center rounded-[5px] border border-[var(--color-border2)] overflow-hidden shrink-0">
                                    {(["upto", "max_pages"] as RangeMode[]).map((mode) => (
                                        <button
                                            key={mode}
                                            onClick={() => handleModeSwitch(mode)}
                                            className={[
                                                "px-2 py-[4px] text-[9px] font-mono font-semibold tracking-[0.05em] transition-colors duration-100 leading-none",
                                                rangeMode === mode
                                                    ? "bg-[var(--color-accent)] text-white"
                                                    : "bg-transparent text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]",
                                            ].join(" ")}
                                        >
                                            {mode === "upto" ? "Up to" : "Max"}
                                        </button>
                                    ))}
                                </div>

                                {/* Value input — swaps on mode change */}
                                <AnimatePresence mode="wait">
                                    {rangeMode === "upto" ? (
                                        <motion.input
                                            key="upto"
                                            type="number"
                                            min={start}
                                            placeholder="end"
                                            value={upto}
                                            onChange={(e) => handleUpto(e.target.value)}
                                            initial={{ opacity: 0, x: 4 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -4 }}
                                            transition={{ duration: 0.1 }}
                                            className={[numInput, invalidRange ? "border-[rgba(239,68,68,0.5)] focus:border-[var(--color-neg)]" : ""].join(" ")}
                                        />
                                    ) : (
                                        <motion.input
                                            key="max"
                                            type="number"
                                            min={1}
                                            placeholder="n"
                                            value={maxPages}
                                            onChange={(e) => handleMaxPages(e.target.value)}
                                            initial={{ opacity: 0, x: 4 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -4 }}
                                            transition={{ duration: 0.1 }}
                                            className={numInput}
                                        />
                                    )}
                                </AnimatePresence>

                                <span className="text-[9px] font-mono text-[var(--color-text-faint)] shrink-0">
                                    {rangeMode === "upto" ? "pg." : "pages"}
                                </span>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}