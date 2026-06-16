import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import RequestHandler from "../lib/utilities/request_handler";
import { APP_NAME, VERSION } from "../lib/constant";

const ROUTE_META: Record<string, { title: string }> = {
    "/": { title: "Dashboard" },
    "/process": { title: "Process" },
    "/setup": { title: "Setup" },
    "/settings": { title: "Settings" },
};

type HealthStatus = "checking" | "online" | "offline";

const STATUS_CFG: Record<HealthStatus, { label: string; dotCls: string; textCls: string; ping: boolean }> = {
    checking: {
        label: "CHECKING",
        dotCls: "bg-[var(--color-neu)]",
        textCls: "text-[var(--color-neu)]",
        ping: true,
    },
    online: {
        label: "API ONLINE",
        dotCls: "bg-[var(--color-pos)]",
        textCls: "text-[var(--color-pos)]",
        ping: true,
    },
    offline: {
        label: "API OFFLINE",
        dotCls: "bg-[var(--color-neg)]",
        textCls: "text-[var(--color-neg)]",
        ping: false,
    },
};

const POLL_MS = 20_000;

function useHealthCheck() {
    const [status, setStatus] = useState<HealthStatus>("checking");
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);

    const check = async () => {
        try {
            const data = await RequestHandler.fetchData("GET", "health");
            setStatus(data?.success === false ? "offline" : "online");
        } catch {
            setStatus("offline");
        }
    };

    useEffect(() => {
        check();
        timer.current = setInterval(check, POLL_MS);
        return () => { if (timer.current) clearInterval(timer.current); };
    }, []);

    return status;
}

function StatusDot({ dotCls, ping }: { dotCls: string; ping: boolean }) {
    return (
        <span className="relative inline-flex w-[6px] h-[6px] shrink-0">
            {ping && (
                <span
                    className={`absolute inset-0 rounded-full opacity-40 ${dotCls}`}
                    style={{ animation: "healthPing 1.4s ease-out infinite" }}
                />
            )}
            <span className={`relative inline-block w-[6px] h-[6px] rounded-full ${dotCls}`} />
        </span>
    );
}

export default function Header() {
    const { pathname } = useLocation();
    const meta = ROUTE_META[pathname] ?? { title: "App" };
    const status = useHealthCheck();
    const cfg = STATUS_CFG[status];

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
                <AnimatePresence mode="wait">
                    <motion.div
                        key={status}
                        className={[
                            "flex items-center gap-1.5 px-2.5 py-[3px] rounded-[5px]",
                            "bg-[var(--color-surface2)] border border-[var(--color-border2)]",
                            "text-[9px] font-mono font-semibold tracking-[0.08em]",
                            cfg.textCls,
                        ].join(" ")}
                        initial={{ opacity: 0, scale: 0.88 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.88 }}
                        transition={{ duration: 0.12 }}
                    >
                        <StatusDot dotCls={cfg.dotCls} ping={cfg.ping} />
                        {cfg.label}
                    </motion.div>
                </AnimatePresence>

                <span className="px-2.5 py-[3px] rounded-[5px] bg-[var(--color-surface2)] border border-[var(--color-border)] text-[9px] font-mono text-[var(--color-text-faint)] tracking-[0.04em]">
                    v{VERSION}
                </span>
            </div>
        </motion.header>
    );
}