import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import RequestHandler from "../../lib/utilities/request_handler";
import { MainConfig } from "../../lib/types/setup_type";

const EASE = [0.16, 1, 0.3, 1] as const;

const FIELD_META: {
    key: keyof MainConfig;
    label: string;
    hint: string;
    min: number;
    max: number;
}[] = [
        { key: "OUTPUT_WIDTH", label: "Output width", hint: "px", min: 1, max: 9999 },
        { key: "OUTPUT_HEIGHT", label: "Output height", hint: "px", min: 1, max: 9999 },
        { key: "SCAN_RANGE", label: "Scan range", hint: "px", min: 1, max: 200 },
        { key: "SAMPLE_PTS", label: "Sample points", hint: "count", min: 1, max: 200 },
        { key: "DARK_THRESH", label: "Dark threshold", hint: "0–255", min: 0, max: 255 },
    ];

function SectionCard({
    children,
    delay = 0,
}: {
    children: React.ReactNode;
    delay?: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, duration: 0.35, ease: EASE }}
            style={{
                background: "var(--color-surface3)",
                border: "1px solid var(--color-border)",
                borderRadius: 14,
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
            }}
        >
            {children}
        </motion.div>
    );
}

function Label({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
            <div
                style={{
                    width: 16,
                    height: 1,
                    background: "linear-gradient(90deg, #4F6EF7, transparent)",
                }}
            />
            <span
                style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: "0.13em",
                    textTransform: "uppercase",
                    color: "var(--color-text-faint)",
                    fontFamily: "var(--font-mono)",
                }}
            >
                {children}
            </span>
        </div>
    );
}

function Divider() {
    return (
        <div
            style={{
                height: 1,
                background: "var(--color-border)",
                borderRadius: 99,
            }}
        />
    );
}

function ConfigField({
    label,
    hint,
    value,
    min,
    max,
    dirty,
    onChange,
}: {
    label: string;
    hint: string;
    value: number;
    min: number;
    max: number;
    dirty: boolean;
    onChange: (v: string) => void;
}) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span
                    style={{
                        fontSize: 9,
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                        color: "var(--color-text-faint)",
                    }}
                >
                    {label}
                </span>
                <span
                    style={{
                        fontSize: 9,
                        fontFamily: "var(--font-mono)",
                        color: "var(--color-text-faint)",
                        opacity: 0.5,
                    }}
                >
                    {hint}
                </span>
                {dirty && (
                    <motion.span
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: EASE }}
                        style={{
                            marginLeft: "auto",
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background: "var(--color-accent)",
                            boxShadow: "0 0 6px var(--color-accent)",
                            flexShrink: 0,
                        }}
                    />
                )}
            </div>

            
            <input
                type="number"
                value={value}
                min={min}
                max={max}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    background: "var(--color-bg)",
                    border: `1px solid ${dirty ? "rgba(79,110,247,0.4)" : "var(--color-border)"}`,
                    borderRadius: 7,
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--color-text)",
                    padding: "6px 8px",
                    outline: "none",
                    width: "100%",
                    transition: "border-color 0.15s",
                    boxSizing: "border-box",
                }}
                onFocus={(e) =>
                    (e.currentTarget.style.borderColor = "var(--color-accent)")
                }
                onBlur={(e) =>
                (e.currentTarget.style.borderColor = dirty
                    ? "rgba(79,110,247,0.4)"
                    : "var(--color-border)")
                }
            />
        </div>
    );
}

function Spinner({ color = "#fff" }: { color?: string }) {
    return (
        <span
            style={{
                width: 12,
                height: 12,
                border: `1.5px solid ${color}40`,
                borderTopColor: color,
                borderRadius: "50%",
                display: "inline-block",
                animation: "spin 0.7s linear infinite",
                flexShrink: 0,
            }}
        />
    );
}

export default function MainConfigEditor({ onClose }: { onClose?: () => void }) {
    const [config, setConfig] = useState<MainConfig | null>(null);
    const [draft, setDraft] = useState<MainConfig | null>(null);
    const [saving, setSaving] = useState(false);
    const [resetting, setResetting] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);

    useEffect(() => {
        RequestHandler.fetchData("GET", "box_config/get_main_config").then((res) => {
            if (res?.success) {
                setConfig(res.data);
                setDraft(res.data);
            }
        });
    }, []);

    const setField = (key: keyof MainConfig, val: string) => {
        const n = parseInt(val, 10);
        if (isNaN(n) || !draft) return;
        setDraft({ ...draft, [key]: n });
    };

    const dirtyKeys = (): Set<keyof MainConfig> => {
        if (!config || !draft) return new Set();
        return new Set(
            (Object.keys(draft) as (keyof MainConfig)[]).filter((k) => draft[k] !== config[k])
        );
    };

    const dirty = dirtyKeys();
    const hasDirty = dirty.size > 0;

    const handleSave = async () => {
        if (!draft || !hasDirty) return;
        setSaving(true);
        setSaveError(null);
        const patch: Partial<MainConfig> = {};
        dirty.forEach((k) => { patch[k] = draft[k]; });
        const res = await RequestHandler.fetchData("POST", "box_config/main_config", patch);
        setSaving(false);
        if (res?.success) {
            setConfig(res.data);
            setDraft(res.data);
        } else {
            setSaveError(res?.message ?? "Save failed");
        }
    };

    const handleReset = async () => {
        setResetting(true);
        setSaveError(null);
        const res = await RequestHandler.fetchData("POST", "box_config/main_config/reset");
        setResetting(false);
        if (res?.success) {
            setConfig(res.data);
            setDraft(res.data);
        } else {
            setSaveError(res?.message ?? "Reset failed");
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            style={{
                background: "var(--color-bg)",
                border: "1px solid var(--color-border)",
                borderRadius: 18,
                overflow: "hidden",
                boxShadow:
                    "0 0 0 1px rgba(79,110,247,0.07), 0 20px 60px rgba(0,0,0,0.35), 0 4px 16px rgba(0,0,0,0.2)",
                display: "flex",
                flexDirection: "column",
                position: "relative",
            }}
        >
            
            <div
                style={{
                    position: "absolute",
                    top: "-20%",
                    left: "-10%",
                    width: 280,
                    height: 280,
                    borderRadius: "50%",
                    background: "radial-gradient(circle at 30% 30%, #4F6EF7 0%, transparent 70%)",
                    filter: "blur(70px)",
                    opacity: 0.07,
                    pointerEvents: "none",
                    zIndex: 0,
                }}
            />

            
            <div
                style={{
                    position: "relative",
                    zIndex: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--color-border)",
                    background: "var(--color-surface)",
                    borderRadius: "18px 18px 0 0",
                    gap: 8,
                }}
            >
                
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span
                        style={{
                            fontSize: 9,
                            fontWeight: 700,
                            fontFamily: "var(--font-mono)",
                            letterSpacing: "0.12em",
                            textTransform: "uppercase",
                            background: "linear-gradient(135deg, #4F6EF7, #7C3AED)",
                            WebkitBackgroundClip: "text",
                            WebkitTextFillColor: "transparent",
                            opacity: 0.85,
                            flexShrink: 0,
                        }}
                    >
                        Setup
                    </span>
                    <div
                        style={{
                            width: 1,
                            height: 13,
                            background: "var(--color-border)",
                            flexShrink: 0,
                        }}
                    />
                    <span
                        style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--color-text)",
                            fontFamily: "var(--font-mono)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        Pipeline config
                    </span>
                </div>

                
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <AnimatePresence>
                        {hasDirty && (
                            <motion.span
                                key="unsaved-badge"
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.8 }}
                                transition={{ duration: 0.2, ease: EASE }}
                                style={{
                                    fontSize: 8,
                                    fontFamily: "var(--font-mono)",
                                    fontWeight: 700,
                                    letterSpacing: "0.1em",
                                    textTransform: "uppercase",
                                    padding: "3px 8px",
                                    borderRadius: 5,
                                    background: "var(--color-accent-dim, rgba(79,110,247,0.1))",
                                    border: "1px solid var(--color-accent-border, rgba(79,110,247,0.25))",
                                    color: "var(--color-accent)",
                                }}
                            >
                                {dirty.size} unsaved
                            </motion.span>
                        )}
                    </AnimatePresence>
                    {onClose && (
                        <button
                            onClick={onClose}
                            style={{
                                width: 28,
                                height: 28,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                borderRadius: 7,
                                border: "1px solid var(--color-border)",
                                background: "var(--color-surface3)",
                                color: "var(--color-text-faint)",
                                cursor: "pointer",
                                fontSize: 11,
                                transition: "all 0.15s",
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.color = "var(--color-text)";
                                e.currentTarget.style.background = "var(--color-border)";
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.color = "var(--color-text-faint)";
                                e.currentTarget.style.background = "var(--color-surface3)";
                            }}
                        >
                            ✕
                        </button>
                    )}
                </div>
            </div>

            
            <div
                style={{
                    position: "relative",
                    zIndex: 1,
                    padding: "14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    overflowY: "auto",
                }}
            >
                {!draft ? (
                    
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 8,
                            padding: "32px 0",
                        }}
                    >
                        <Spinner color="var(--color-accent)" />
                        <span
                            style={{
                                fontSize: 10,
                                fontFamily: "var(--font-mono)",
                                color: "var(--color-text-faint)",
                            }}
                        >
                            Loading…
                        </span>
                    </motion.div>
                ) : (
                    <>
                        
                        <SectionCard delay={0.06}>
                            <Label>Parameters</Label>
                            {FIELD_META.map(({ key, label, hint, min, max }, i) => (
                                <>
                                    {i > 0 && <Divider key={`div-${key}`} />}
                                    <ConfigField
                                        key={key}
                                        label={label}
                                        hint={hint}
                                        value={draft[key]}
                                        min={min}
                                        max={max}
                                        dirty={dirty.has(key)}
                                        onChange={(v) => setField(key, v)}
                                    />
                                </>
                            ))}
                        </SectionCard>

                        
                        <AnimatePresence>
                            {saveError && (
                                <motion.div
                                    key="error"
                                    initial={{ opacity: 0, y: -4 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -4 }}
                                    transition={{ duration: 0.2, ease: EASE }}
                                    style={{
                                        background: "rgba(239,68,68,0.05)",
                                        border: "1px solid rgba(239,68,68,0.25)",
                                        borderRadius: 9,
                                        padding: "9px 12px",
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 10,
                                            fontFamily: "var(--font-mono)",
                                            color: "var(--color-neg, #f43f5e)",
                                        }}
                                    >
                                        {saveError}
                                    </span>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        
                        <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.16, duration: 0.32, ease: EASE }}
                            style={{ display: "flex", gap: 8 }}
                        >
                            
                            <button
                                onClick={handleReset}
                                disabled={resetting || saving}
                                style={{
                                    flex: 1,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 6,
                                    padding: "9px 12px",
                                    borderRadius: 10,
                                    fontSize: 11,
                                    fontFamily: "var(--font-mono)",
                                    fontWeight: 600,
                                    letterSpacing: "0.02em",
                                    border: "1px solid var(--color-border)",
                                    background: "var(--color-surface3)",
                                    color: "var(--color-text-muted)",
                                    cursor: resetting || saving ? "not-allowed" : "pointer",
                                    opacity: resetting || saving ? 0.35 : 1,
                                    transition: "all 0.15s",
                                }}
                                onMouseEnter={(e) => {
                                    if (!resetting && !saving) {
                                        e.currentTarget.style.borderColor = "rgba(244,63,94,0.4)";
                                        e.currentTarget.style.color = "var(--color-neg, #f43f5e)";
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderColor = "var(--color-border)";
                                    e.currentTarget.style.color = "var(--color-text-muted)";
                                }}
                            >
                                {resetting ? (
                                    <>
                                        <Spinner color="currentColor" />
                                        Resetting…
                                    </>
                                ) : (
                                    "Reset defaults"
                                )}
                            </button>

                            
                            <button
                                onClick={handleSave}
                                disabled={saving || resetting || !hasDirty}
                                style={{
                                    flex: 1,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 6,
                                    padding: "9px 12px",
                                    borderRadius: 10,
                                    fontSize: 11,
                                    fontFamily: "var(--font-mono)",
                                    fontWeight: 700,
                                    letterSpacing: "0.02em",
                                    background: "var(--color-accent)",
                                    color: "#fff",
                                    border: "none",
                                    cursor: saving || resetting || !hasDirty ? "not-allowed" : "pointer",
                                    opacity: saving || resetting || !hasDirty ? 0.35 : 1,
                                    transition: "opacity 0.15s",
                                    boxShadow: hasDirty ? "0 0 20px rgba(79,110,247,0.3)" : "none",
                                }}
                                onMouseEnter={(e) => {
                                    if (!saving && !resetting && hasDirty)
                                        e.currentTarget.style.opacity = "0.88";
                                }}
                                onMouseLeave={(e) => {
                                    if (!saving && !resetting && hasDirty)
                                        e.currentTarget.style.opacity = "1";
                                }}
                            >
                                {saving ? (
                                    <>
                                        <Spinner color="#fff" />
                                        Saving…
                                    </>
                                ) : (
                                    <>
                                        Save changes
                                        <span style={{ fontSize: 10, opacity: 0.7 }}>✔</span>
                                    </>
                                )}
                            </button>
                        </motion.div>
                    </>
                )}
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </motion.div>
    );
}