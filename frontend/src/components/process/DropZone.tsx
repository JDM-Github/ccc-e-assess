import { useRef } from "react";

interface DropZoneProps {
    file: File | null;
    previewUrl: string | null;
    isPdf: boolean;
    dragging: boolean;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent) => void;
    onFileChange: (f: File) => void;
}

export default function DropZone({
    file, previewUrl, isPdf, dragging,
    onDragOver, onDragLeave, onDrop, onFileChange,
}: DropZoneProps) {
    const inputRef = useRef<HTMLInputElement>(null);

    return (
        <div
            className={[
                "border border-dashed rounded-[8px] flex flex-col items-center justify-center py-5 px-3 cursor-pointer transition-all duration-150",
                dragging
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-dim)]"
                    : "border-[var(--color-border2)] hover:border-[var(--color-accent)] hover:bg-[rgba(79,110,247,0.04)]",
            ].join(" ")}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
        >
            <input
                ref={inputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onFileChange(f); }}
            />

            {previewUrl ? (
                <img
                    src={previewUrl}
                    alt="preview"
                    className="max-h-[100px] rounded-[5px] object-contain mb-2"
                />
            ) : file && isPdf ? (
                <div className="flex flex-col items-center gap-1.5 py-2">
                    <span className="text-[22px] opacity-40">📄</span>
                    <span className="text-[10px] font-mono text-[var(--color-text-muted)]">PDF uploaded</span>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-2">
                    
                    <div className="w-8 h-8 rounded-[8px] bg-[rgba(79,110,247,0.08)] border border-[rgba(79,110,247,0.15)] flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" opacity="0.7">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                    </div>
                    <span className="text-[11px] font-mono text-[var(--color-text-faint)] text-center leading-relaxed">
                        Drop image or PDF<br />or click to browse
                    </span>
                </div>
            )}

            {file && (
                <span className="text-[10px] font-mono text-[var(--color-text-muted)] mt-2 text-center truncate w-full">
                    {file.name}
                </span>
            )}
        </div>
    );
}