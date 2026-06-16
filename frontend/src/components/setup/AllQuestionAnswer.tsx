import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import RequestHandler from "../../lib/utilities/request_handler";
import type { AnswerQuiz, BoxCoord } from "../../lib/types/setup_type";

const EASE = [0.16, 1, 0.3, 1] as const;

async function fetchQuiz(): Promise<AnswerQuiz> {
    const res = await RequestHandler.fetchData("GET", "box_config/answerer");
    if (!res?.success) throw new Error(res?.message ?? "Failed to fetch answer quiz");
    return res.data as AnswerQuiz;
}
async function fetchBoxes(): Promise<BoxCoord[]> {
    const res = await RequestHandler.fetchData("GET", "box_config/get_all");
    if (!res?.success) throw new Error(res?.message ?? "Failed to fetch boxes");
    return res.data as BoxCoord[];
}
async function saveAnswers(title: string, answers: string[]): Promise<void> {
    const res = await RequestHandler.fetchData("POST", `box_config/answerer/${encodeURIComponent(title)}`, { answers, strict: false });
    if (!res?.success) throw new Error(res?.message ?? "Save failed");
}
async function resetQuiz(): Promise<AnswerQuiz> {
    const res = await RequestHandler.fetchData("POST", "box_config/answerer/reset");
    if (!res?.success) throw new Error(res?.message ?? "Reset failed");
    return res.data as AnswerQuiz;
}

function Spinner({ className = "" }: { className?: string }) {
    return (
        <span className={`inline-block shrink-0 rounded-full border border-current/20 border-t-current animate-spin ${className}`} />
    );
}

function CellBtn({ selected, label, onClick, title }: { selected: boolean; label: string; onClick: () => void; title: string }) {
    return (
        <button
            title={title}
            onClick={onClick}
            className={[
                "mx-auto flex size-7 items-center justify-center rounded-md font-mono text-[9px] font-bold tracking-wide transition-all duration-100 cursor-pointer",
                selected
                    ? "border-[1.5px] border-[var(--color-accent)] bg-[var(--color-accent)] text-white"
                    : "border border-[var(--color-border)] bg-transparent text-transparent hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-dim)] hover:text-[var(--color-accent)]",
            ].join(" ")}
        >
            {label}
        </button>
    );
}

function AnswerGrid({ box, answers, onChange }: { box: BoxCoord; answers: string[]; onChange: (a: string[]) => void }) {
    const cols = box.columns ?? ["A", "B", "C", "D", "E"];

    const thCls = "px-1.5 py-1.5 text-[9px] font-mono font-bold text-[var(--color-text-faint)] text-center border-b border-[var(--color-border)] select-none tracking-widest opacity-60 whitespace-nowrap";
    const tdCls = "px-1 py-[3px] text-center";
    const rowBg = (i: number) => i % 2 === 1 ? "bg-white/[0.012]" : "";

    if (box.check_by_row) {
        return (
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className={`${thCls} w-8 min-w-8 opacity-30`}>#</th>
                            {cols.map(c => <th key={c} className={thCls}>{c}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: box.grid_rows }, (_, row) => {
                            const current = answers[row] ?? cols[0];
                            return (
                                <tr key={row} className={rowBg(row)}>
                                    <td className={`${tdCls} font-mono text-[8.5px] text-[var(--color-text-faint)] opacity-30 select-none`}>{row + 1}</td>
                                    {cols.map(c => (
                                        <td key={c} className={tdCls}>
                                            <CellBtn selected={current === c} label={c} title={`Q${row + 1} → ${c}`}
                                                onClick={() => { const n = [...answers]; n[row] = c; onChange(n); }} />
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    }

    if (box.check_by_col) {
        return (
            <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                    <thead>
                        <tr>
                            <th className={`${thCls} text-left pl-2 w-10`}>opt</th>
                            {Array.from({ length: box.grid_cols }, (_, ci) => (
                                <th key={ci} className={thCls}>{ci + 1}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {cols.map((opt, oi) => (
                            <tr key={opt} className={rowBg(oi)}>
                                <td className="pl-2 py-[3px] font-mono text-[9px] font-bold text-[var(--color-text-faint)] tracking-wider opacity-60 select-none">{opt}</td>
                                {Array.from({ length: box.grid_cols }, (_, ci) => {
                                    const current = answers[ci] ?? cols[0];
                                    return (
                                        <td key={ci} className={tdCls}>
                                            <CellBtn selected={current === opt} label={opt} title={`Col${ci + 1} → ${opt}`}
                                                onClick={() => { const n = [...answers]; n[ci] = opt; onChange(n); }} />
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    return <p className="p-3 font-mono text-[10px] text-[var(--color-text-faint)]">Neither check_by_row nor check_by_col is set on this box.</p>;
}

function SidebarItem({ title, count, active, dirty, onClick }: { title: string; count: number; active: boolean; dirty: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={[
                "flex w-full items-center gap-2 border-l-2 px-4 py-2.5 text-left transition-all duration-100 cursor-pointer",
                active
                    ? "border-[var(--color-accent)] bg-[var(--color-accent-dim)]"
                    : "border-transparent hover:bg-white/[0.03]",
            ].join(" ")}
        >
            <div className="min-w-0 flex-1">
                <div className={`truncate font-mono text-[11px] font-bold tracking-[0.01em] transition-colors duration-100 ${active ? "text-[var(--color-accent)]" : "text-[var(--color-text)]"}`}>
                    {title}
                </div>
                <div className="mt-0.5 font-mono text-[8.5px] text-[var(--color-text-faint)] opacity-50">
                    {count} items
                </div>
            </div>
            {dirty && <div className="size-[5px] shrink-0 rounded-full bg-[var(--color-accent)] opacity-70" />}
        </button>
    );
}

function RightPanel({ title, box, answers, onChange, onSave, saving, dirty, saveError }:
    { title: string; box: BoxCoord | undefined; answers: string[]; onChange: (a: string[]) => void; onSave: () => void; saving: boolean; dirty: boolean; saveError: string | null }
) {
    const cols = box?.columns ?? ["A", "B", "C", "D", "E"];
    const mode = box?.check_by_row ? "by row" : box?.check_by_col ? "by col" : null;
    const numQ = box ? (box.check_by_row ? box.grid_rows : box.grid_cols) : answers.length;
    const setAll = (l: string) => onChange(Array(answers.length).fill(l));

    return (
        <div className="flex h-full flex-col overflow-hidden">

            
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] px-[18px] py-[13px]">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 font-mono text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--color-accent)] opacity-70">
                        Answers
                    </span>
                    <span className="h-3 w-px shrink-0 bg-[var(--color-border2)]" />
                    <span className="truncate font-mono text-[13px] font-semibold text-[var(--color-text)]">
                        {title}
                    </span>
                    <span className="shrink-0 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-px font-mono text-[9px] text-[var(--color-text-faint)]">
                        {numQ} items
                    </span>
                    {mode && (
                        <span className="shrink-0 rounded border border-[var(--color-border)] bg-[var(--color-bg)] px-1.5 py-px font-mono text-[9px] text-[var(--color-text-faint)] opacity-50">
                            {mode}
                        </span>
                    )}
                </div>

                <button
                    onClick={onSave}
                    disabled={saving || !dirty}
                    className={[
                        "flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-[5px] font-mono text-[10px] font-bold tracking-[0.05em] transition-all duration-150",
                        dirty && !saving
                            ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-white cursor-pointer"
                            : "border-[var(--color-border)] bg-transparent text-[var(--color-text-faint)] cursor-default opacity-50",
                    ].join(" ")}
                >
                    {saving ? <><Spinner className="size-2.5" /> Saving…</> : dirty ? "Save" : "Saved ✔"}
                </button>
            </div>

            
            <AnimatePresence>
                {saveError && (
                    <motion.div key="err" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.15 }}
                        className="shrink-0 overflow-hidden border-b border-[var(--color-neg)]/20 bg-[var(--color-neg)]/5 px-[18px] py-1.5 font-mono text-[9px] text-[var(--color-neg)]">
                        {saveError}
                    </motion.div>
                )}
            </AnimatePresence>

            
            <div className="flex-1 overflow-y-auto p-[18px]">
                {box
                    ? <AnswerGrid box={box} answers={answers} onChange={onChange} />
                    : <p className="m-0 font-mono text-[10px] text-[var(--color-text-faint)]">Box config not found for "{title}".</p>
                }
            </div>

            
            <div className="flex shrink-0 items-center gap-1.5 border-t border-[var(--color-border)] px-[18px] py-2.5">
                <span className="mr-1 font-mono text-[9px] tracking-[0.04em] text-[var(--color-text-faint)] opacity-40">fill all</span>
                {cols.map(letter => (
                    <button key={letter} title={`Set all to ${letter}`} onClick={() => setAll(letter)}
                        className="flex size-6 cursor-pointer items-center justify-center rounded border border-[var(--color-border)] bg-transparent font-mono text-[9px] font-bold text-[var(--color-text-faint)] transition-all duration-100 hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-dim)] hover:text-[var(--color-accent)]">
                        {letter}
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function AllQuestionAnswer({ onClose }: { onClose: () => void }) {
    const [quiz, setQuiz] = useState<AnswerQuiz | null>(null);
    const [boxes, setBoxes] = useState<BoxCoord[]>([]);
    const [local, setLocal] = useState<AnswerQuiz>({});
    const [loadError, setLoadError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<string | null>(null);
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
    const [resetting, setResetting] = useState(false);
    const [resetDone, setResetDone] = useState(false);

    useEffect(() => {
        setLoading(true);
        Promise.all([fetchQuiz(), fetchBoxes()])
            .then(([q, b]) => {
                setQuiz(q); setLocal(structuredClone(q)); setBoxes(b);
                setSelected(Object.keys(q)[0] ?? null); setLoadError(null);
            })
            .catch(e => setLoadError(e.message))
            .finally(() => setLoading(false));
    }, []);

    const isDirty = useCallback((title: string) => {
        if (!quiz) return false;
        const orig = quiz[title]; const curr = local[title];
        if (!orig || !curr) return false;
        return orig.some((v, i) => v !== curr[i]);
    }, [quiz, local]);

    const handleChange = (title: string, answers: string[]) => {
        setLocal(p => ({ ...p, [title]: answers }));
        setSaveErrors(p => ({ ...p, [title]: "" }));
    };

    const handleSave = async (title: string) => {
        setSavingKey(title); setSaveErrors(p => ({ ...p, [title]: "" }));
        try {
            await saveAnswers(title, local[title]);
            setQuiz(p => p ? { ...p, [title]: [...local[title]] } : p);
        } catch (e: any) { setSaveErrors(p => ({ ...p, [title]: e.message })); }
        finally { setSavingKey(null); }
    };

    const handleReset = async () => {
        setResetting(true);
        try {
            const q = await resetQuiz();
            setQuiz(q); setLocal(structuredClone(q)); setSaveErrors({});
            setResetDone(true); setTimeout(() => setResetDone(false), 2000);
        } catch (e: any) { setLoadError(e.message); }
        finally { setResetting(false); }
    };

    const sections = Object.keys(local);
    const anyDirty = sections.some(isDirty);
    const boxByTitle = Object.fromEntries(boxes.filter(b => b.is_answerer).map(b => [b.title, b]));

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="relative flex max-h-[85vh] max-w-7xl flex-col overflow-hidden rounded-[10px] border border-[var(--color-border)] bg-[var(--color-bg)] shadow-[0_24px_64px_rgba(0,0,0,0.28),0_4px_16px_rgba(0,0,0,0.16)]"
        >
            <div
                className="pointer-events-none absolute top-[-15%] left-[-8%] w-[480px] h-[480px] rounded-full opacity-[0.07] blur-[120px]"
                style={{ background: "radial-gradient(circle at 30% 30%, #4F6EF7 0%, transparent 70%)" }}
            />
            <div
                className="pointer-events-none absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-[0.06] blur-[100px]"
                style={{ background: "radial-gradient(circle at 70% 70%, #10B981 0%, transparent 80%)" }}
            />
            
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--color-border)] px-[18px] py-[13px]">
                <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--color-accent)] opacity-70">Setup</span>
                    <span className="h-3 w-px bg-[var(--color-border2)]" />
                    <span className="font-mono text-[13px] font-semibold text-[var(--color-text)]">Answer key</span>
                    <AnimatePresence>
                        {anyDirty && (
                            <motion.span key="unsaved" initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.85 }} transition={{ duration: 0.18 }}
                                className="rounded border border-[var(--color-accent-border)] bg-[var(--color-accent-dim)] px-2 py-px font-mono text-[8px] font-bold tracking-[0.1em] uppercase text-[var(--color-accent)]">
                                unsaved
                            </motion.span>
                        )}
                    </AnimatePresence>
                </div>

                <div className="flex items-center gap-2">
                    <button onClick={handleReset} disabled={resetting}
                        className={`flex items-center gap-1.5 rounded-md border border-[var(--color-neg)]/25 bg-[var(--color-neg)]/5 px-3 py-[5px] font-mono text-[10px] font-semibold text-[var(--color-neg)] transition-colors duration-150 ${resetting ? "cursor-default opacity-60" : "cursor-pointer hover:bg-[var(--color-neg)]/10"}`}>
                        {resetDone ? "✔ Reset" : resetting ? <><Spinner className="size-2.5" /> Resetting…</> : "Reset all"}
                    </button>
                    <button onClick={onClose}
                        className="flex size-7 cursor-pointer items-center justify-center rounded-md border border-[var(--color-border)] bg-transparent font-mono text-[11px] text-[var(--color-text-faint)] transition-all duration-100 hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]">
                        ✕
                    </button>
                </div>
            </div>

            
            <div className="flex min-h-0 flex-1 overflow-hidden">

                {loading && (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2.5 p-20">
                        <Spinner className="size-5 text-[var(--color-accent)]" />
                        <span className="font-mono text-[10px] text-[var(--color-text-faint)]">Loading answer key…</span>
                    </div>
                )}

                
                {!loading && loadError && (
                    <div className="flex flex-1 flex-col items-center justify-center gap-2.5 p-6">
                        <div className="max-w-xs rounded-lg border border-[var(--color-neg)]/20 bg-[var(--color-neg)]/5 px-5 py-3 text-center">
                            <span className="font-mono text-[10px] text-[var(--color-neg)]">{loadError}</span>
                        </div>
                        <button onClick={() => window.location.reload()}
                            className="cursor-pointer bg-transparent font-mono text-[10px] font-semibold text-[var(--color-accent)] underline underline-offset-[3px]">
                            Retry
                        </button>
                    </div>
                )}

                
                {!loading && !loadError && sections.length === 0 && (
                    <div className="flex flex-1 items-center justify-center p-6">
                        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-6 py-4 text-center">
                            <p className="m-0 font-mono text-[10px] leading-[1.8] text-[var(--color-text-faint)]">
                                No answerer boxes configured yet.<br />
                                Enable <strong className="font-bold text-[var(--color-text-muted)]">Is answerer</strong> on a box to add it here.
                            </p>
                        </div>
                    </div>
                )}

                
                {!loading && !loadError && sections.length > 0 && (
                    <>
                        
                        <div className="flex w-52 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-[var(--color-border)] bg-[var(--color-bg)] py-1.5">
                            {sections.map((title, i) => (
                                <motion.div key={title} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04, duration: 0.2, ease: EASE }}>
                                    <SidebarItem title={title} count={local[title]?.length ?? 0} active={selected === title} dirty={isDirty(title)} onClick={() => setSelected(title)} />
                                </motion.div>
                            ))}
                        </div>

                        
                        <div className="flex min-w-0 flex-1 flex-col">
                            <AnimatePresence mode="wait">
                                {selected && local[selected] ? (
                                    <motion.div key={selected} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease: EASE }}
                                        className="flex flex-1 flex-col overflow-hidden">
                                        <RightPanel
                                            title={selected} box={boxByTitle[selected]} answers={local[selected]}
                                            onChange={a => handleChange(selected, a)} onSave={() => handleSave(selected)}
                                            saving={savingKey === selected} dirty={isDirty(selected)} saveError={saveErrors[selected] || null}
                                        />
                                    </motion.div>
                                ) : (
                                    <motion.div key="placeholder" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-1 items-center justify-center">
                                        <span className="font-mono text-[10px] text-[var(--color-text-faint)] opacity-40">Select a section</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </>
                )}
            </div>
        </motion.div>
    );
}