import type { ViewMode } from "../../controllers/process/useReviewController";

interface ModePillProps {
    mode: ViewMode;
    onChange: (m: ViewMode) => void;
}

export default function ModePill({ mode, onChange }: ModePillProps) {
    return (
        <div className="flex items-stretch bg-[var(--color-surface2)] border border-[var(--color-border2)] rounded-[6px] overflow-hidden p-[2px] gap-[2px]">
            {(["pan", "focus"] as ViewMode[]).map((m) => (
                <button
                    key={m}
                    onClick={() => onChange(m)}
                    title={`${m === "pan" ? "Pan" : "Focus"} mode (${m === "pan" ? "P" : "F"})`}
                    className={[
                        "flex-1 flex items-center justify-center py-1.5 rounded-[4px]",
                        "text-[10px] font-mono font-semibold capitalize transition-all",
                        mode === m
                            ? m === "focus"
                                ? "bg-[var(--color-accent)] text-white"
                                : "bg-[var(--color-accent)] text-[var(--color-text)]"
                            : "text-[var(--color-text-faint)] hover:text-[var(--color-text-muted)]",
                    ].join(" ")}
                >
                    {m === "pan" ? "Pan" : "Focus"}
                </button>
            ))}
        </div>
    );
}