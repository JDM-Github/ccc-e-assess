import type { RunStatus } from "../../lib/types/process_type";

interface StatusPillProps {
    status: RunStatus | "streaming";
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
    idle: { label: "—", cls: "text-[var(--color-text-faint)]" },
    loading: { label: "Running", cls: "text-[var(--color-accent)] animate-pulse" },
    streaming: { label: "Streaming", cls: "text-[var(--color-accent)] animate-pulse" },
    done: { label: "✔ Done", cls: "text-[var(--color-pos)]" },
    error: { label: "✖ Error", cls: "text-[var(--color-neg)]" },
};

export default function StatusPill({ status }: StatusPillProps) {
    const s = STATUS_MAP[status] ?? STATUS_MAP.idle;
    return (
        <span className={`text-[9px] font-mono font-semibold tracking-[0.1em] ${s.cls}`}>
            {s.label}
        </span>
    );
}