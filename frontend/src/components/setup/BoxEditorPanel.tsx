import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BoxCoord, BOX_COLORS } from "../../lib/types/setup_type";

const EASE = [0.16, 1, 0.3, 1] as const;

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

function Field({
    label,
    value,
    onChange,
}: {
    label: string;
    value: number;
    onChange: (v: string) => void;
}) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span
                style={{
                    fontSize: 9,
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-text-faint)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                }}
            >
                {label}
            </span>
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                style={{
                    background: "var(--color-bg)",
                    border: "1px solid var(--color-border)",
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
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-accent)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
            />
        </div>
    );
}

function Toggle({
    label,
    hint,
    checked,
    onChange,
    accentColor,
}: {
    label: string;
    hint?: string;
    checked: boolean;
    onChange: (v: boolean) => void;
    accentColor?: string;
}) {
    const trackColor = accentColor ?? "var(--color-accent)";

    return (
        <div
            onClick={() => onChange(!checked)}
            style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                cursor: "pointer",
            }}
        >
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span
                    style={{
                        fontSize: 10,
                        fontFamily: "var(--font-mono)",
                        color: "var(--color-text-muted)",
                        letterSpacing: "0.06em",
                        userSelect: "none",
                        transition: "color 0.15s",
                    }}
                >
                    {label}
                </span>
                {hint && (
                    <span
                        style={{
                            fontSize: 9,
                            fontFamily: "var(--font-mono)",
                            color: "var(--color-text-faint)",
                            userSelect: "none",
                        }}
                    >
                        {hint}
                    </span>
                )}
            </div>

            
            <div
                style={{
                    position: "relative",
                    flexShrink: 0,
                    width: 28,
                    height: 16,
                    borderRadius: 99,
                    background: checked ? trackColor : "var(--color-border)",
                    transition: "background 0.15s",
                }}
            >
                
                <motion.div
                    animate={{ x: checked ? 14 : 2 }}
                    transition={{ duration: 0.15, ease: EASE }}
                    style={{
                        position: "absolute",
                        top: 2,
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: "#fff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
                    }}
                />
            </div>
        </div>
    );
}

function CoordPair({
    sublabel,
    x,
    y,
    onChangeX,
    onChangeY,
}: {
    sublabel: string;
    x: number;
    y: number;
    onChangeX: (v: string) => void;
    onChangeY: (v: string) => void;
}) {
    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
                style={{
                    fontSize: 9,
                    fontFamily: "var(--font-mono)",
                    color: "var(--color-text-faint)",
                    letterSpacing: "0.06em",
                }}
            >
                {sublabel}
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <Field label="X" value={x} onChange={onChangeX} />
                <Field label="Y" value={y} onChange={onChangeY} />
            </div>
        </div>
    );
}

export default function BoxEditorPanel({
    box,
    index,
    onChange,
    onDelete,
    onSave,
    saving,
    onClose,
}: {
    box: BoxCoord;
    index: number;
    onChange: (updated: BoxCoord) => void;
    onDelete: () => void;
    onSave: () => void;
    saving: boolean;
    onClose?: () => void;
    defaultOpen?: boolean;
}) {
    const color = BOX_COLORS[index % BOX_COLORS.length];

    const [columnsInput, setColumnsInput] = useState<string>(
        (box.columns ?? []).join(",")
    );

    useEffect(() => {
        setColumnsInput((box.columns ?? []).join(","));
    }, [box.columns]);

    const setCoord = (coord: "tl" | "tr", axis: 0 | 1, val: string) => {
        const n = parseInt(val, 10);
        if (isNaN(n)) return;
        const updated = [...box[coord]] as [number, number];
        updated[axis] = n;
        onChange({ ...box, [coord]: updated });
    };

    const setField = (field: "height" | "grid_cols" | "grid_rows", val: string) => {
        const n = parseInt(val, 10);
        if (isNaN(n)) return;
        onChange({ ...box, [field]: n });
    };

    const handleColumnsBlur = () => {
        const columns = columnsInput
            .split(",")
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
        onChange({ ...box, columns });
    };

    const handleCheckMode = (mode: "row" | "col") => {
        if (mode === "row" && !box.check_by_row) {
            onChange({ ...box, check_by_row: true, check_by_col: false });
        } else if (mode === "col" && !box.check_by_col) {
            onChange({ ...box, check_by_col: true, check_by_row: false });
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
                            width: 7,
                            height: 7,
                            borderRadius: "50%",
                            background: color,
                            flexShrink: 0,
                            boxShadow: `0 0 6px ${color}80`,
                        }}
                    />
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
                        Box {index + 1}
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
                        {box.title || "Untitled box"}
                    </span>

                    
                    {box.is_answerer && (
                        <span
                            style={{
                                fontSize: 8,
                                fontFamily: "var(--font-mono)",
                                fontWeight: 700,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                color: "#10B981",
                                background: "rgba(16,185,129,0.1)",
                                border: "1px solid rgba(16,185,129,0.25)",
                                borderRadius: 4,
                                padding: "1px 6px",
                                flexShrink: 0,
                            }}
                        >
                            answerer
                        </span>
                    )}
                </div>

                
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <button
                        onClick={onDelete}
                        style={{
                            padding: "4px 10px",
                            borderRadius: 6,
                            fontSize: 10,
                            fontFamily: "var(--font-mono)",
                            fontWeight: 600,
                            border: "1px solid rgba(239,68,68,0.25)",
                            background: "rgba(239,68,68,0.06)",
                            color: "var(--color-neg, #f43f5e)",
                            cursor: "pointer",
                            transition: "background 0.15s",
                        }}
                        onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "rgba(239,68,68,0.13)")
                        }
                        onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "rgba(239,68,68,0.06)")
                        }
                    >
                        Delete
                    </button>
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
                
                <SectionCard delay={0.04}>
                    <Label>Title</Label>
                    <input
                        type="text"
                        value={box.title}
                        onChange={(e) => onChange({ ...box, title: e.target.value })}
                        placeholder="Box name…"
                        style={{
                            background: "var(--color-bg)",
                            border: "1px solid var(--color-border)",
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
                            (e.currentTarget.style.borderColor = "var(--color-border)")
                        }
                    />
                </SectionCard>

                
                <SectionCard delay={0.08}>
                    <Label>Coordinates</Label>
                    <CoordPair
                        sublabel="Top left"
                        x={box.tl[0]}
                        y={box.tl[1]}
                        onChangeX={(v) => setCoord("tl", 0, v)}
                        onChangeY={(v) => setCoord("tl", 1, v)}
                    />
                    <Divider />
                    <CoordPair
                        sublabel="Top right"
                        x={box.tr[0]}
                        y={box.tr[1]}
                        onChangeX={(v) => setCoord("tr", 0, v)}
                        onChangeY={(v) => setCoord("tr", 1, v)}
                    />
                    <Divider />
                    <Field
                        label="Height"
                        value={box.height}
                        onChange={(v) => setField("height", v)}
                    />

                    
                    <div
                        style={{
                            background: "var(--color-bg)",
                            border: "1px solid var(--color-border)",
                            borderRadius: 9,
                            padding: "10px 12px",
                        }}
                    >
                        <span
                            style={{
                                fontSize: 8.5,
                                fontFamily: "var(--font-mono)",
                                color: "var(--color-text-faint)",
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                display: "block",
                                marginBottom: 8,
                            }}
                        >
                            Derived — BL / BR
                        </span>
                        <div
                            style={{
                                display: "grid",
                                gridTemplateColumns: "1fr 1fr",
                                gap: 8,
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 10,
                                    fontFamily: "var(--font-mono)",
                                    color: "var(--color-text-muted)",
                                }}
                            >
                                BL: [{box.tl[0]}, {box.tl[1] + box.height}]
                            </span>
                            <span
                                style={{
                                    fontSize: 10,
                                    fontFamily: "var(--font-mono)",
                                    color: "var(--color-text-muted)",
                                }}
                            >
                                BR: [{box.tr[0]}, {box.tr[1] + box.height}]
                            </span>
                        </div>
                    </div>
                </SectionCard>

                
                <SectionCard delay={0.12}>
                    <Label>Grid</Label>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 8,
                        }}
                    >
                        <Field
                            label="Cols"
                            value={box.grid_cols}
                            onChange={(v) => setField("grid_cols", v)}
                        />
                        <Field
                            label="Rows"
                            value={box.grid_rows}
                            onChange={(v) => setField("grid_rows", v)}
                        />
                    </div>
                    <Divider />
                    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        <span
                            style={{
                                fontSize: 9,
                                fontFamily: "var(--font-mono)",
                                color: "var(--color-text-faint)",
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                            }}
                        >
                            Column labels
                        </span>
                        <input
                            type="text"
                            value={columnsInput}
                            onChange={(e) => setColumnsInput(e.target.value)}
                            onBlur={handleColumnsBlur}
                            placeholder="A,B,C,D,E"
                            style={{
                                background: "var(--color-bg)",
                                border: "1px solid var(--color-border)",
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
                        />
                        <span
                            style={{
                                fontSize: 9,
                                fontFamily: "var(--font-mono)",
                                color: "var(--color-text-faint)",
                                opacity: 0.6,
                            }}
                        >
                            Comma-separated headers
                        </span>
                    </div>
                </SectionCard>

                
                <SectionCard delay={0.16}>
                    <Label>Check mode</Label>
                    <Toggle
                        label="Check by row"
                        hint="Score across each row"
                        checked={box.check_by_row}
                        onChange={() => handleCheckMode("row")}
                    />
                    <Divider />
                    <Toggle
                        label="Check by col"
                        hint="Score down each column"
                        checked={box.check_by_col}
                        onChange={() => handleCheckMode("col")}
                    />
                </SectionCard>

                
                <SectionCard delay={0.2}>
                    <Label>Excel output</Label>
                    <Toggle
                        label="Combined"
                        hint="Merge all answers into one cell"
                        checked={box.is_combined}
                        onChange={(v) => onChange({ ...box, is_combined: v })}
                    />
                    <Divider />
                    <Toggle
                        label="Own sheet"
                        hint="Output to its own named sheet"
                        checked={box.has_own_sheet}
                        onChange={(v) => onChange({ ...box, has_own_sheet: v })}
                    />
                    <Divider />
                    <Toggle
                        label="No double"
                        hint="Block export if a question has 2+ answers"
                        checked={box.no_double}
                        onChange={(v) => onChange({ ...box, no_double: v })}
                    />
                    <Divider />
                    <Toggle
                        label="No blank"
                        hint="Block export if a question has no answer"
                        checked={box.no_blank}
                        onChange={(v) => onChange({ ...box, no_blank: v })}
                    />
                </SectionCard>

                
                <SectionCard delay={0.22}>
                    <Label>Group</Label>
                    <input
                        type="text"
                        value={box.group ?? ""}
                        onChange={(e) => onChange({ ...box, group: e.target.value || null })}
                        placeholder="e.g. second_choice (or leave blank for standalone)"
                        style={{
                            background: "var(--color-bg)",
                            border: "1px solid var(--color-border)",
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
                        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-accent)")}
                        onBlur={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
                    />
                    <span style={{ fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--color-text-faint)", opacity: 0.6 }}>
                        Boxes sharing the same group name are treated as one logical unit. Leave blank for standalone.
                    </span>
                </SectionCard>

                
                <SectionCard delay={0.24}>
                    <Label>Answerer</Label>
                    <Toggle
                        label="Is answerer"
                        hint="Include this box in the answer key quiz"
                        checked={box.is_answerer}
                        onChange={(v) => onChange({ ...box, is_answerer: v })}
                        accentColor="#10B981"
                    />

                    
                    {box.is_answerer && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.18, ease: EASE }}
                            style={{
                                background: "rgba(16,185,129,0.06)",
                                border: "1px solid rgba(16,185,129,0.2)",
                                borderRadius: 8,
                                padding: "8px 10px",
                                display: "flex",
                                flexDirection: "column",
                                gap: 3,
                            }}
                        >
                            <span
                                style={{
                                    fontSize: 9,
                                    fontFamily: "var(--font-mono)",
                                    color: "#10B981",
                                    fontWeight: 700,
                                    letterSpacing: "0.06em",
                                }}
                            >
                                {box.grid_rows} answer slot{box.grid_rows !== 1 ? "s" : ""} will be tracked
                            </span>
                            <span
                                style={{
                                    fontSize: 8.5,
                                    fontFamily: "var(--font-mono)",
                                    color: "var(--color-text-faint)",
                                    lineHeight: 1.5,
                                }}
                            >
                                Saving this box creates or updates its entry in the answer key.
                                Edit the answers from <strong style={{ color: "var(--color-text-muted)" }}>All question answer</strong>.
                            </span>
                        </motion.div>
                    )}
                </SectionCard>

                
                <motion.button
                    onClick={onSave}
                    disabled={saving || !box.title.trim()}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.28, duration: 0.32, ease: EASE }}
                    style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "9px 14px",
                        borderRadius: 10,
                        fontSize: 12,
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        letterSpacing: "0.03em",
                        background: "var(--color-accent)",
                        color: "#fff",
                        border: "none",
                        cursor: saving || !box.title.trim() ? "not-allowed" : "pointer",
                        opacity: saving || !box.title.trim() ? 0.35 : 1,
                        transition: "opacity 0.15s",
                        boxShadow: "0 0 20px rgba(79,110,247,0.3)",
                    }}
                    onMouseEnter={(e) => {
                        if (!saving && box.title.trim())
                            e.currentTarget.style.opacity = "0.88";
                    }}
                    onMouseLeave={(e) => {
                        if (!saving && box.title.trim())
                            e.currentTarget.style.opacity = "1";
                    }}
                >
                    <span>{saving ? "Saving…" : "Save box"}</span>
                    {saving ? (
                        <span
                            style={{
                                width: 12,
                                height: 12,
                                border: "1.5px solid rgba(255,255,255,0.4)",
                                borderTopColor: "#fff",
                                borderRadius: "50%",
                                display: "inline-block",
                                animation: "spin 0.7s linear infinite",
                            }}
                        />
                    ) : (
                        <span style={{ fontSize: 10, opacity: 0.7 }}>✔</span>
                    )}
                </motion.button>
            </div>

            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </motion.div>
    );
}