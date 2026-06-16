import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Settings2, Cpu, TableProperties } from "lucide-react";

const TOOLS = [
    {
        path: "/setup",
        Icon: Settings2,
        title: "Setup",
        subtitle: "Box configuration",
        description: "Upload a baseline image, draw answer regions, configure grid dimensions and check modes.",
        accentColor: "#4F6EF7",
        accentDim: "rgba(79, 110, 247, 0.12)",
        accentBorder: "rgba(79, 110, 247, 0.25)",
        keyFeatures: [
            "Draw & resize answer boxes",
            "Grid, row & column modes",
            "Pipeline & answer key config",
        ],
    },
    {
        path: "/process",
        Icon: Cpu,
        title: "Process",
        subtitle: "Run the pipeline",
        description: "Upload a single image or multi-page PDF and stream results across all pages concurrently.",
        accentColor: "#10B981",
        accentDim: "rgba(16, 185, 129, 0.12)",
        accentBorder: "rgba(16, 185, 129, 0.25)",
        keyFeatures: [
            "Image & multi-page PDF support",
            "Concurrent batch streaming",
            "Live per-page progress",
        ],
    },
    {
        path: "/process",
        Icon: TableProperties,
        title: "Review",
        subtitle: "Verify & export",
        description: "Inspect detected answers page by page on a canvas, toggle cells, save edits, and export to Excel.",
        accentColor: "#F59E0B",
        accentDim: "rgba(245, 158, 11, 0.12)",
        accentBorder: "rgba(245, 158, 11, 0.25)",
        keyFeatures: [
            "Per-page canvas viewer",
            "Toggle & save answer cells",
            "One-click Excel export",
        ],
    },
];

const STATS = [
    { val: "N", label: "Box regions", sub: "Drawn on baseline image" },
    { val: "PDF", label: "Multi-page support", sub: "Pages streamed in parallel" },
    { val: "3", label: "Check modes", sub: "Grid · row · column" },
    { val: "xlsx", label: "Export format", sub: "One-click after review" },
];

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export function Dashboard() {
    const navigate = useNavigate();

    return (
        <div className="min-h-full overflow-y-auto relative">

            <motion.div
                animate={{ x: [0, -180, 0], y: [0, 60, 0] }}
                transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
                className="pointer-events-none fixed top-[-1%] left-[-8%] w-[560px] h-[560px] rounded-full opacity-10 blur-[140px] z-0"
                style={{ background: "radial-gradient(circle at 30% 30%, #4F6EF7 0%, transparent 70%)" }}
            />
            <motion.div
                animate={{ x: [0, 140, 0], y: [0, -90, 0] }}
                transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
                className="pointer-events-none fixed bottom-0 right-0 w-[480px] h-[480px] rounded-full opacity-[0.09] blur-[120px] z-0"
                style={{ background: "radial-gradient(circle at 70% 70%, #10B981 0%, transparent 80%)" }}
            />

            <div className="relative z-10 max-w-[1200px] mx-auto pb-8">

                {/* Header */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: EASE_OUT_EXPO }}
                    className="mb-10"
                >
                    <p className="text-[11px] font-mono font-bold tracking-[0.12em] uppercase text-[var(--color-accent)] mb-3">
                        E-Assess · Image & PDF assessment pipeline
                    </p>
                    <h1 className="text-[2.75rem] font-extrabold leading-[1.1] tracking-[-0.03em] mb-4 text-[var(--color-text)] m-0">
                        Assess with{" "}
                        <span
                            className="bg-clip-text text-transparent"
                            style={{ backgroundImage: "linear-gradient(135deg, #4F6EF7, #7C3AED)" }}
                        >
                            precision.
                        </span>
                    </h1>
                    <p className="text-[0.85rem] font-mono text-[var(--color-text-muted)] leading-relaxed max-w-[460px] m-0">
                        Three stages — configure your boxes, run the pipeline, then review and export results.
                    </p>
                </motion.div>

                {/* Tool cards */}
                <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 mb-10">
                    {TOOLS.map((tool, index) => {
                        const { Icon } = tool;
                        return (
                            <motion.button
                                key={tool.path}
                                onClick={() => navigate(tool.path)}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.08 * index, duration: 0.42, ease: EASE_OUT_EXPO }}
                                whileTap={{ scale: 0.985 }}
                                className="bg-[var(--color-surface)] rounded-[1rem] p-6 text-left cursor-pointer transition-all duration-200 font-sans border"
                                style={{ borderColor: "var(--color-border)" }}
                                onMouseEnter={e => {
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = tool.accentBorder;
                                    (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 0 1px ${tool.accentBorder}, 0 8px 24px ${tool.accentDim}`;
                                }}
                                onMouseLeave={e => {
                                    (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border)";
                                    (e.currentTarget as HTMLButtonElement).style.boxShadow = "none";
                                }}
                            >
                                {/* Icon + endpoint */}
                                <div className="flex items-start justify-between mb-5">
                                    <div
                                        className="w-[42px] h-[42px] rounded-[8px] flex items-center justify-center border"
                                        style={{ background: tool.accentDim, borderColor: tool.accentBorder }}
                                    >
                                        <Icon size={20} color={tool.accentColor} strokeWidth={1.75} />
                                    </div>
                                </div>

                                {/* Title */}
                                <div className="text-[1.1rem] font-bold text-[var(--color-text)] mb-[3px]">
                                    {tool.title}
                                </div>
                                <div
                                    className="text-[0.68rem] font-bold tracking-[0.04em] uppercase mb-3"
                                    style={{ color: tool.accentColor }}
                                >
                                    {tool.subtitle}
                                </div>

                                {/* Description */}
                                <p className="text-[0.78rem] text-[var(--color-text-muted)] leading-[1.55] mb-4 m-0">
                                    {tool.description}
                                </p>

                                {/* Feature bullets */}
                                <div className="flex flex-col gap-[6px] mb-4">
                                    {tool.keyFeatures.map((f) => (
                                        <div key={f} className="flex items-center gap-2">
                                            <div
                                                className="w-1 h-1 rounded-full shrink-0 opacity-60"
                                                style={{ background: tool.accentColor }}
                                            />
                                            <span className="text-[0.68rem] font-mono text-[var(--color-text-faint)]">{f}</span>
                                        </div>
                                    ))}
                                </div>

                            </motion.button>
                        );
                    })}
                </div>

                {/* Stats strip */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.32, duration: 0.4, ease: EASE_OUT_EXPO }}
                    className="flex bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[1rem] overflow-hidden mb-8"
                >
                    {STATS.map((s, i) => (
                        <div
                            key={s.label}
                            className={[
                                "flex-1 px-6 py-5",
                                i < STATS.length - 1 ? "border-r border-[var(--color-border)]" : "",
                            ].join(" ")}
                        >
                            <div className="text-[1.75rem] font-extrabold font-mono text-[var(--color-text)] tracking-[-0.02em] mb-1">
                                {s.val}
                            </div>
                            <div className="text-[0.68rem] font-semibold text-[var(--color-text-muted)] mb-[3px]">
                                {s.label}
                            </div>
                            <div className="text-[0.6rem] font-mono text-[var(--color-text-faint)]">
                                {s.sub}
                            </div>
                        </div>
                    ))}
                </motion.div>

                {/* Footer */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.44, duration: 0.35 }}
                    className="text-center text-[0.68rem] font-mono text-[var(--color-text-faint)] border-t border-[var(--color-border)] pt-6"
                >
                    E-Assess · Assessment pipeline
                </motion.div>

            </div>
        </div>
    );
}