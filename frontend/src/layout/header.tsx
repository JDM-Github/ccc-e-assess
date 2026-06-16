import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { APP_NAME, VERSION } from "../lib/constant";

const ROUTE_META: Record<string, { title: string }> = {
    "/": { title: "Dashboard" },
    "/process": { title: "Process" },
    "/setup": { title: "Setup" },
    "/settings": { title: "Settings" },
};

export default function Header() {
    const { pathname } = useLocation();
    const meta = ROUTE_META[pathname] ?? { title: "App" };

    return (
        <motion.header
            className="h-[40px] shrink-0 flex items-center justify-between px-5 bg-[var(--color-bg)] border-b border-[var(--color-border)] sticky top-0 z-100"
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.22, delay: 0.05 }}
        >
            {/* Left — breadcrumb */}
            <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-[var(--color-text-faint)] tracking-[0.06em] uppercase">
                    {APP_NAME}
                </span>
                <span className="text-[10px] font-mono text-[var(--color-border2)]">/</span>
                <span className="text-[11px] font-mono font-semibold text-[var(--color-text)] tracking-[0.04em] uppercase">
                    {meta.title}
                </span>
            </div>

            <div className="flex items-center gap-2">
                <span className="px-2.5 py-[3px] rounded-[5px] bg-[var(--color-surface2)] border border-[var(--color-border)] text-[9px] font-mono text-[var(--color-text-faint)] tracking-[0.04em]">
                    v{VERSION}
                </span>
            </div>
        </motion.header>
    );
}