import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSetupController } from "../controllers/setup/useSetupController";
import ImageCanvas from "../components/setup/ImageCanvas";
import BoxEditorPanel from "../components/setup/BoxEditorPanel";
import MainConfigEditor from "../components/setup/MainConfigEditor";
import AllQuestionAnswer from "../components/setup/AllQuestionAnswer";
import RequestHandler from "../lib/utilities/request_handler";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

// ── types ─────────────────────────────────────────────────────────────────────

type ConfigBundle = {
    __version: 1;
    boxes: unknown[];
    answer_quiz: Record<string, string[]>;
    main_config: Record<string, number>;
};

type LoadPhase =
    | { status: "idle" }
    | { status: "confirm"; bundle: ConfigBundle }
    | { status: "loading" }
    | { status: "done" }
    | { status: "error"; message: string };

type SavePhase = "idle" | "saving" | "done" | "error";

// ── save helper ───────────────────────────────────────────────────────────────

async function saveConfigToFile(): Promise<void> {
    const [boxRes, quizRes, cfgRes] = await Promise.all([
        RequestHandler.fetchData("GET", "box_config/get_all"),
        RequestHandler.fetchData("GET", "box_config/answerer"),
        RequestHandler.fetchData("GET", "box_config/get_main_config"),
    ]);

    const failed = [
        !boxRes?.success && "boxes",
        !quizRes?.success && "answer quiz",
        !cfgRes?.success && "main config",
    ].filter(Boolean);

    if (failed.length) {
        throw new Error(`Failed to fetch: ${failed.join(", ")}`);
    }

    const bundle: ConfigBundle = {
        __version: 1,
        boxes: boxRes.data,
        answer_quiz: quizRes.data,
        main_config: cfgRes.data,
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `e-assess-config-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

// ── load helper ───────────────────────────────────────────────────────────────

async function applyConfigBundle(bundle: ConfigBundle): Promise<void> {
    const boxRes = await RequestHandler.fetchData("POST", "box_config/replace_all", {
        boxes: bundle.boxes,
    });
    if (!boxRes?.success) {
        throw new Error(`Failed to restore boxes: ${boxRes?.message ?? "unknown error"}`);
    }
    await RequestHandler.fetchData("POST", "box_config/answerer/reset");
    for (const [title, answers] of Object.entries(bundle.answer_quiz)) {
        const res = await RequestHandler.fetchData(
            "POST",
            `box_config/answerer/${encodeURIComponent(title)}`,
            { answers, strict: false }
        );
        if (!res?.success) {
            throw new Error(
                `Failed to restore answers for "${title}": ${res?.message ?? "unknown error"}`
            );
        }
    }

    // 3. Write main config fields
    const cfgRes = await RequestHandler.fetchData(
        "POST",
        "box_config/main_config",
        bundle.main_config
    );
    if (!cfgRes?.success) {
        throw new Error(
            `Failed to restore main config: ${cfgRes?.message ?? "unknown error"}`
        );
    }
}

// ── component ─────────────────────────────────────────────────────────────────

export default function SetupPage() {
    const ctrl = useSetupController();

    // save state
    const [savePhase, setSavePhase] = useState<SavePhase>("idle");

    // load state
    const [loadPhase, setLoadPhase] = useState<LoadPhase>({ status: "idle" });
    const loadInputRef = useRef<HTMLInputElement>(null);

    // ── save ──────────────────────────────────────────────────────────────

    const handleSaveConfig = async () => {
        if (savePhase === "saving") return;
        setSavePhase("saving");
        try {
            await saveConfigToFile();
            setSavePhase("done");
            setTimeout(() => setSavePhase("idle"), 2200);
        } catch (e: any) {
            setSavePhase("error");
            setTimeout(() => setSavePhase("idle"), 3000);
        }
    };

    // ── load — file picked ────────────────────────────────────────────────

    const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // reset so the same file can be re-picked
        e.target.value = "";

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const raw = JSON.parse(ev.target?.result as string);
                if (
                    !raw ||
                    typeof raw !== "object" ||
                    raw.__version !== 1 ||
                    !Array.isArray(raw.boxes) ||
                    typeof raw.answer_quiz !== "object" ||
                    typeof raw.main_config !== "object"
                ) {
                    setLoadPhase({
                        status: "error",
                        message:
                            "Invalid config file — make sure it was exported from E-Assess.",
                    });
                    setTimeout(() => setLoadPhase({ status: "idle" }), 3500);
                    return;
                }
                setLoadPhase({ status: "confirm", bundle: raw as ConfigBundle });
            } catch {
                setLoadPhase({
                    status: "error",
                    message: "Could not parse the file — is it valid JSON?",
                });
                setTimeout(() => setLoadPhase({ status: "idle" }), 3500);
            }
        };
        reader.readAsText(file);
    };

    // ── load — confirmed ──────────────────────────────────────────────────

    const handleConfirmLoad = async () => {
        if (loadPhase.status !== "confirm") return;
        const bundle = loadPhase.bundle;
        setLoadPhase({ status: "loading" });
        try {
            await applyConfigBundle(bundle);
            setLoadPhase({ status: "done" });
            setTimeout(() => setLoadPhase({ status: "idle" }), 2200);
        } catch (e: any) {
            setLoadPhase({ status: "error", message: e.message ?? "Load failed" });
            setTimeout(() => setLoadPhase({ status: "idle" }), 4000);
        }
    };

    // ── derived label helpers ─────────────────────────────────────────────

    const saveLabel =
        savePhase === "saving"
            ? "Saving…"
            : savePhase === "done"
                ? "✔ Saved"
                : savePhase === "error"
                    ? "✖ Failed"
                    : "Save config";

    const saveAccent =
        savePhase === "done"
            ? "var(--color-pos)"
            : savePhase === "error"
                ? "var(--color-neg)"
                : undefined;

    const loadLabel =
        loadPhase.status === "loading"
            ? "Loading…"
            : loadPhase.status === "done"
                ? "✔ Loaded"
                : loadPhase.status === "error"
                    ? "✖ Failed"
                    : "Load config";

    const loadAccent =
        loadPhase.status === "done"
            ? "var(--color-pos)"
            : loadPhase.status === "error"
                ? "var(--color-neg)"
                : undefined;

    // ── shared button style ───────────────────────────────────────────────

    const headerBtn = (accent?: string) =>
        [
            "px-3 py-[7px] rounded-[6px] text-[11px] font-mono font-semibold",
            "border border-[var(--color-border2)] bg-[var(--color-surface2)]",
            "transition-colors duration-150",
            accent
                ? ""
                : "text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]",
        ].join(" ");

    return (
        <div className="flex flex-col gap-3 h-full pb-5">

            {/* ── ambient blobs ─────────────────────────────────────────── */}
            <motion.div
                animate={{ x: [0, -180, 0], y: [0, 60, 0] }}
                transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
                style={{
                    position: "fixed", top: "-15%", left: "-8%",
                    width: 560, height: 560, borderRadius: "50%",
                    background: "radial-gradient(circle at 30% 30%, #4F6EF7 0%, transparent 70%)",
                    filter: "blur(140px)", zIndex: 0, opacity: 0.1, pointerEvents: "none",
                }}
            />
            <motion.div
                animate={{ x: [0, 140, 0], y: [0, -90, 0] }}
                transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
                style={{
                    position: "fixed", bottom: "0%", right: "0%",
                    width: 480, height: 480, borderRadius: "50%",
                    background: "radial-gradient(circle at 70% 70%, #10B981 0%, transparent 80%)",
                    filter: "blur(120px)", zIndex: 0, opacity: 0.09, pointerEvents: "none",
                }}
            />
            <div
                className="pointer-events-none fixed top-[-15%] left-[-8%] w-[480px] h-[480px] rounded-full opacity-[0.07] blur-[120px]"
                style={{ background: "radial-gradient(circle at 30% 30%, #4F6EF7 0%, transparent 70%)" }}
            />
            <div
                className="pointer-events-none fixed bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-[0.06] blur-[100px]"
                style={{ background: "radial-gradient(circle at 70% 70%, #7C3AED 0%, transparent 80%)" }}
            />

            {/* ── header ────────────────────────────────────────────────── */}
            <motion.div
                className="flex items-start justify-between shrink-0"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
            >
                <div className="flex flex-col gap-0.5 w-100">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono font-bold tracking-[0.12em] uppercase text-[var(--color-accent)]">
                            Setup
                        </span>
                        <span className="w-px h-3 bg-[var(--color-border2)]" />
                        <span className="text-[10px] font-mono text-[var(--color-text-faint)] tracking-[0.06em]">
                            box configuration
                        </span>
                    </div>
                    <h1 className="text-[1.6rem] font-extrabold text-[var(--color-text)] tracking-[-0.03em] leading-tight m-0">
                        Configure{" "}
                        <span
                            className="bg-clip-text text-transparent"
                            style={{ backgroundImage: "linear-gradient(135deg, #4F6EF7, #7C3AED)" }}
                        >
                            boxes.
                        </span>
                    </h1>
                    <p className="text-[0.8rem] font-mono text-[var(--color-text-muted)] leading-relaxed m-0">
                        Draw and configure answer regions on a baseline image — define grids, check modes, and export rules.
                    </p>
                </div>

                <div className="flex items-center gap-2 pt-1">
                    <AnimatePresence>
                        {ctrl.loading && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-[var(--color-accent-dim)] border border-[var(--color-accent-border)]"
                            >
                                <span className="w-[6px] h-[6px] rounded-full bg-[var(--color-accent)] animate-pulse" />
                                <span className="text-[9px] font-mono font-bold tracking-[0.1em] text-[var(--color-accent)] uppercase">
                                    Running pipeline…
                                </span>
                            </motion.div>
                        )}
                        {ctrl.runStatus === "done" && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[var(--color-surface2)] border border-[var(--color-border)]"
                            >
                                <span className="text-[9px] font-mono font-bold tracking-[0.1em] text-[var(--color-pos)] uppercase">
                                    ✔ Baseline ready
                                </span>
                            </motion.div>
                        )}
                        {ctrl.runStatus === "error" && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ duration: 0.15 }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[rgba(239,68,68,0.06)] border border-[rgba(239,68,68,0.25)]"
                            >
                                <span className="text-[9px] font-mono font-bold tracking-[0.1em] text-[var(--color-neg)] uppercase">
                                    ✖ Pipeline error
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <button
                        onClick={handleSaveConfig}
                        disabled={savePhase === "saving"}
                        className={headerBtn(saveAccent)}
                        style={saveAccent ? { color: saveAccent, borderColor: `${saveAccent}40` } : undefined}
                    >
                        {savePhase === "saving" ? (
                            <span className="flex items-center gap-1.5">
                                <span className="inline-block w-[8px] h-[8px] rounded-full border border-current/30 border-t-current animate-spin" />
                                Saving…
                            </span>
                        ) : (
                            saveLabel
                        )}
                    </button>

                    {/* ── load config ────────────────────────────────────── */}
                    <AnimatePresence mode="wait">
                        {loadPhase.status === "confirm" ? (
                            /* confirmation inline — avoids a modal for a destructive action */
                            <motion.div
                                key="confirm"
                                initial={{ opacity: 0, scale: 0.95, width: 0 }}
                                animate={{ opacity: 1, scale: 1, width: "auto" }}
                                exit={{ opacity: 0, scale: 0.95, width: 0 }}
                                transition={{ duration: 0.18, ease: EASE_OUT_EXPO }}
                                className="flex items-center gap-1.5 overflow-hidden"
                            >
                                <span className="text-[9px] font-mono text-[var(--color-text-faint)] whitespace-nowrap">
                                    {(loadPhase.bundle.boxes as unknown[]).length} boxes · overwrite?
                                </span>
                                <button
                                    onClick={() => setLoadPhase({ status: "idle" })}
                                    className="px-2 py-[5px] rounded-[6px] text-[10px] font-mono font-semibold border border-[var(--color-border2)] bg-[var(--color-surface2)] text-[var(--color-text-faint)] hover:text-[var(--color-text)] transition-colors duration-100"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleConfirmLoad}
                                    className="px-2 py-[5px] rounded-[6px] text-[10px] font-mono font-semibold border border-[rgba(239,68,68,0.35)] bg-[rgba(239,68,68,0.07)] text-[var(--color-neg)] hover:bg-[rgba(239,68,68,0.14)] transition-colors duration-100"
                                >
                                    Yes, load
                                </button>
                            </motion.div>
                        ) : (
                            <motion.button
                                key="load-btn"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.12 }}
                                onClick={() => {
                                    if (
                                        loadPhase.status === "idle" ||
                                        loadPhase.status === "done" ||
                                        loadPhase.status === "error"
                                    ) {
                                        loadInputRef.current?.click();
                                    }
                                }}
                                disabled={loadPhase.status === "loading"}
                                className={headerBtn(loadAccent)}
                                style={loadAccent ? { color: loadAccent, borderColor: `${loadAccent}40` } : undefined}
                            >
                                {loadPhase.status === "loading" ? (
                                    <span className="flex items-center gap-1.5">
                                        <span className="inline-block w-[8px] h-[8px] rounded-full border border-current/30 border-t-current animate-spin" />
                                        Loading…
                                    </span>
                                ) : (
                                    loadLabel
                                )}
                            </motion.button>
                        )}
                    </AnimatePresence>

                    <button
                        onClick={() => ctrl.setShowPipelineConfig(true)}
                        className={headerBtn()}
                    >
                        Pipeline config
                    </button>
                    <button
                        onClick={() => ctrl.setShowAQA(true)}
                        className={headerBtn()}
                    >
                        Answer key
                    </button>
                </div>
            </motion.div>

            {/* ── load error toast ──────────────────────────────────────── */}
            <AnimatePresence>
                {loadPhase.status === "error" && (
                    <motion.div
                        key="load-error"
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18 }}
                        className="shrink-0 flex items-center gap-2 px-3 py-2 rounded-[7px] border border-[rgba(239,68,68,0.25)] bg-[rgba(239,68,68,0.06)]"
                    >
                        <span className="text-[10px] font-mono text-[var(--color-neg)]">
                            {loadPhase.message}
                        </span>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── main content grid ─────────────────────────────────────── */}
            <div className="grid grid-cols-[1fr_280px] gap-3 flex-1 min-h-0">

                {/* canvas panel */}
                <motion.div
                    className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[10px] overflow-hidden flex flex-col min-h-0 h-[95%]"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25 }}
                >
                    <div className="px-[18px] py-[13px] border-b border-[var(--color-border)] flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono font-bold tracking-[0.12em] uppercase text-[var(--color-accent)] opacity-70">
                                Canvas
                            </span>
                            <span className="w-px h-3 bg-[var(--color-border2)]" />
                            <span className="text-[13px] font-semibold text-[var(--color-text)]">
                                Image workspace
                            </span>
                        </div>
                        {ctrl.file && (
                            <span className="text-[9px] font-mono text-[var(--color-text-faint)] bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-[2px] rounded-[4px] tracking-[0.04em] max-w-[180px] truncate">
                                {ctrl.file.name}
                            </span>
                        )}
                    </div>

                    <div className="flex-1 min-h-0 relative">
                        {!ctrl.ready ? (
                            <div
                                className={[
                                    "absolute inset-3 flex flex-col items-center justify-center gap-3",
                                    "border-2 border-dashed rounded-[8px] transition-colors duration-150",
                                    ctrl.loading
                                        ? "border-[var(--color-accent-border)] bg-[var(--color-accent-dim)] cursor-wait"
                                        : ctrl.dragging
                                            ? "border-[var(--color-accent)] bg-[var(--color-accent-dim)] cursor-copy"
                                            : "border-[var(--color-border2)] hover:border-[var(--color-accent)] cursor-pointer",
                                ].join(" ")}
                                onDragOver={(e) => { e.preventDefault(); if (!ctrl.loading) ctrl.setDragging(true); }}
                                onDragLeave={() => ctrl.setDragging(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    ctrl.setDragging(false);
                                    if (ctrl.loading) return;
                                    const f = e.dataTransfer.files[0];
                                    if (f) ctrl.handleFile(f);
                                }}
                                onClick={() => { if (!ctrl.loading) ctrl.fileInputRef.current?.click(); }}
                            >
                                <AnimatePresence mode="wait">
                                    {ctrl.loading ? (
                                        <motion.div
                                            key="loading"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="flex flex-col items-center gap-3"
                                        >
                                            <div className="w-6 h-6 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin" />
                                            <span className="text-[11px] font-mono font-semibold text-[var(--color-accent)]">
                                                Processing pipeline…
                                            </span>
                                            <span className="text-[9px] font-mono text-[var(--color-text-faint)]">
                                                {ctrl.file?.name}
                                            </span>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="idle"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            exit={{ opacity: 0 }}
                                            className="flex flex-col items-center gap-3"
                                        >
                                            <div className="w-10 h-10 rounded-[10px] bg-[var(--color-surface2)] border border-[var(--color-border)] flex items-center justify-center opacity-40">
                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-[var(--color-text-faint)]">
                                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                                    <circle cx="8.5" cy="8.5" r="1.5" />
                                                    <path d="M21 15l-5-5L5 21" strokeLinecap="round" strokeLinejoin="round" />
                                                </svg>
                                            </div>
                                            <div className="text-center flex flex-col gap-1">
                                                <p className="text-[11px] font-mono text-[var(--color-text-faint)]">
                                                    Drop an image here
                                                </p>
                                                <p className="text-[9px] font-mono text-[var(--color-text-faint)] opacity-50">
                                                    or click to browse · images only
                                                </p>
                                            </div>
                                            {ctrl.runStatus === "error" && (
                                                <span className="text-[10px] font-mono text-[var(--color-neg)] text-center px-4">
                                                    {ctrl.runError}
                                                </span>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ) : (
                            <ImageCanvas
                                imageUrl={ctrl.baselineUrl!}
                                naturalW={ctrl.naturalSize?.w ?? 0}
                                naturalH={ctrl.naturalSize?.h ?? 0}
                                boxes={ctrl.boxes}
                                mode={ctrl.canvasMode}
                                onBoxDrawn={ctrl.onBoxDrawn}
                                onBoxChange={ctrl.updateBox}
                                selectedIdx={ctrl.selectedIdx}
                                onSelectBox={ctrl.setSelectedIdx}
                            />
                        )}
                    </div>
                </motion.div>

                {/* right sidebar */}
                <div className="flex flex-col gap-3 min-h-0 overflow-hidden">

                    {/* tools card */}
                    <motion.div
                        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[10px] overflow-hidden shrink-0"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25, delay: 0.04 }}
                    >
                        <div className="px-[18px] py-[13px] border-b border-[var(--color-border)] flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-mono font-bold tracking-[0.12em] uppercase text-[var(--color-accent)] opacity-70">
                                    Tools
                                </span>
                                <span className="w-px h-3 bg-[var(--color-border2)]" />
                                <span className="text-[13px] font-semibold text-[var(--color-text)]">Workspace</span>
                            </div>
                            {ctrl.boxes.length > 0 && (
                                <span className="text-[9px] font-mono text-[var(--color-text-faint)]">
                                    {ctrl.boxes.length} box{ctrl.boxes.length !== 1 ? "es" : ""}
                                </span>
                            )}
                        </div>
                        <div className="p-[14px] flex flex-col gap-2">
                            <div className="flex gap-2">
                                {/* upload */}
                                <button
                                    title={ctrl.file ? "Swap image" : "Upload image"}
                                    onClick={() => ctrl.fileInputRef.current?.click()}
                                    disabled={ctrl.loading}
                                    className={[
                                        "flex-1 flex items-center justify-center gap-1.5 px-3 py-[9px] rounded-[7px]",
                                        "text-[11px] font-mono font-semibold tracking-[0.02em]",
                                        "transition-all duration-150 active:scale-[0.98]",
                                        "disabled:opacity-30 disabled:cursor-not-allowed",
                                        "bg-[var(--color-surface2)] border border-[var(--color-border2)]",
                                        "text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]",
                                    ].join(" ")}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                                        <polyline points="17 8 12 3 7 8" />
                                        <line x1="12" y1="3" x2="12" y2="15" />
                                    </svg>
                                    <span>{ctrl.file ? "Swap" : "Upload"}</span>
                                </button>

                                {/* draw */}
                                <button
                                    title={ctrl.canvasMode === "draw" ? "Cancel draw" : "Draw new box"}
                                    onClick={() => ctrl.toggleMode("draw")}
                                    disabled={!ctrl.ready}
                                    className={[
                                        "flex-1 flex items-center justify-center gap-1.5 px-3 py-[9px] rounded-[7px]",
                                        "text-[11px] font-mono font-semibold tracking-[0.02em]",
                                        "transition-all duration-150 active:scale-[0.98]",
                                        "disabled:opacity-30 disabled:cursor-not-allowed",
                                        ctrl.canvasMode === "draw"
                                            ? "bg-[var(--color-accent)] text-white border border-transparent"
                                            : "bg-[var(--color-surface2)] border border-[var(--color-border2)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]",
                                    ].join(" ")}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="3" y="3" width="18" height="18" rx="2" />
                                        <line x1="12" y1="8" x2="12" y2="16" />
                                        <line x1="8" y1="12" x2="16" y2="12" />
                                    </svg>
                                    <span>{ctrl.canvasMode === "draw" ? "Cancel" : "Draw"}</span>
                                </button>

                                {/* move */}
                                <button
                                    title={ctrl.canvasMode === "move" ? "Cancel move" : "Move / Resize"}
                                    onClick={() => ctrl.toggleMode("move")}
                                    disabled={!ctrl.ready}
                                    className={[
                                        "flex-1 flex items-center justify-center gap-1.5 px-3 py-[9px] rounded-[7px]",
                                        "text-[11px] font-mono font-semibold tracking-[0.02em]",
                                        "transition-all duration-150 active:scale-[0.98]",
                                        "disabled:opacity-30 disabled:cursor-not-allowed",
                                        ctrl.canvasMode === "move"
                                            ? "bg-[#f97316] text-white border border-transparent"
                                            : "bg-[var(--color-surface2)] border border-[var(--color-border2)] text-[var(--color-text-muted)] hover:border-[#f97316] hover:text-[#f97316]",
                                    ].join(" ")}
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="5 9 2 12 5 15" />
                                        <polyline points="9 5 12 2 15 5" />
                                        <polyline points="15 19 12 22 9 19" />
                                        <polyline points="19 9 22 12 19 15" />
                                        <line x1="2" y1="12" x2="22" y2="12" />
                                        <line x1="12" y1="2" x2="12" y2="22" />
                                    </svg>
                                    <span>{ctrl.canvasMode === "move" ? "Cancel" : "Move"}</span>
                                </button>
                            </div>

                            <AnimatePresence>
                                {(ctrl.canvasMode === "draw" || ctrl.canvasMode === "move") && (
                                    <motion.p
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.15 }}
                                        className="text-[9px] font-mono text-[var(--color-text-faint)] text-center overflow-hidden"
                                    >
                                        {ctrl.canvasMode === "draw"
                                            ? "Click and drag on the image"
                                            : "Drag a box to move, drag corners to resize"}
                                    </motion.p>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>

                    {/* box list */}
                    <AnimatePresence>
                        {ctrl.boxes.length > 0 && (
                            <motion.div
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[10px] overflow-hidden flex flex-col min-h-0 max-h-[200px]"
                            >
                                <div className="px-[18px] py-[13px] border-b border-[var(--color-border)] shrink-0 flex items-center gap-2">
                                    <span className="text-[9px] font-mono font-bold tracking-[0.12em] uppercase text-[var(--color-accent)] opacity-70">
                                        Config
                                    </span>
                                    <span className="w-px h-3 bg-[var(--color-border2)]" />
                                    <span className="text-[13px] font-semibold text-[var(--color-text)]">Boxes</span>
                                </div>
                                <div className="flex flex-col gap-1 p-2 overflow-y-auto max-h-[280px]">
                                    {ctrl.boxes.map((box, i) => {
                                        const color = ctrl.BOX_COLORS[i % ctrl.BOX_COLORS.length];
                                        const isSelected = ctrl.selectedIdx === i;
                                        return (
                                            <motion.button
                                                key={i}
                                                initial={{ opacity: 0, x: -6 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.04, duration: 0.2 }}
                                                onClick={() => {
                                                    ctrl.setSelectedIdx(i);
                                                    ctrl.setEditingBoxIdx(i);
                                                }}
                                                className={[
                                                    "w-full flex items-center gap-2.5 px-3 py-[9px] rounded-[6px] text-left transition-colors duration-100",
                                                    isSelected
                                                        ? "bg-[var(--color-accent-dim)] border border-[var(--color-accent-border)]"
                                                        : "border border-transparent hover:bg-[var(--color-surface2)]",
                                                ].join(" ")}
                                            >
                                                <span
                                                    className="w-[7px] h-[7px] rounded-full shrink-0"
                                                    style={{ backgroundColor: color }}
                                                />
                                                <span className={[
                                                    "text-[11px] font-mono font-semibold flex-1 truncate",
                                                    isSelected ? "text-[var(--color-accent)]" : "text-[var(--color-text)]",
                                                ].join(" ")}>
                                                    {box.title || `Box ${i + 1}`}
                                                </span>
                                                {box.is_answerer && (
                                                    <span className="text-[7px] font-mono font-bold tracking-[0.06em] text-[#10B981] shrink-0">
                                                        ANS
                                                    </span>
                                                )}
                                                <span className="text-[9px] font-mono text-[var(--color-text-faint)] shrink-0">
                                                    {box.grid_cols}×{box.grid_rows}
                                                </span>
                                            </motion.button>
                                        );
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* empty hint */}
                    <AnimatePresence>
                        {ctrl.boxes.length === 0 && ctrl.ready && ctrl.canvasMode === "pan" && (
                            <motion.p
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="text-[10px] font-mono text-[var(--color-text-faint)] text-center py-2"
                            >
                                No boxes yet — draw one on the image.
                            </motion.p>
                        )}
                    </AnimatePresence>

                    {/* tips card */}
                    <motion.div
                        className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[10px] overflow-hidden shrink-0"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2, delay: 0.1 }}
                    >
                        <div className="px-[18px] py-[13px] border-b border-[var(--color-border)] flex items-center gap-2">
                            <span className="text-[9px] font-mono font-bold tracking-[0.12em] uppercase text-[var(--color-accent)] opacity-70">
                                Tips
                            </span>
                            <span className="w-px h-3 bg-[var(--color-border2)]" />
                            <span className="text-[13px] font-semibold text-[var(--color-text)]">
                                Getting started
                            </span>
                        </div>
                        <div className="p-[14px] flex flex-col gap-2">
                            {[
                                "Upload any image to generate a baseline",
                                "Draw boxes over answer grid regions",
                                "Configure grid dimensions and check mode",
                                "Save boxes and export to Excel",
                            ].map((f, i) => (
                                <motion.div
                                    key={f}
                                    initial={{ opacity: 0, x: -8 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.34 + i * 0.06, duration: 0.3, ease: EASE_OUT_EXPO }}
                                    className="flex items-center gap-2"
                                >
                                    <div className="w-1 h-1 rounded-full bg-[var(--color-accent)] opacity-50 shrink-0" />
                                    <span className="text-[0.68rem] font-mono text-[var(--color-text-faint)]">{f}</span>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                </div>
            </div>

            {/* ── hidden file inputs ────────────────────────────────────── */}
            <input
                ref={ctrl.fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) ctrl.handleFile(f); }}
            />
            <input
                ref={loadInputRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={handleFilePicked}
            />

            {/* ── box editor modal ──────────────────────────────────────── */}
            <AnimatePresence>
                {ctrl.editingBoxIdx !== null && ctrl.boxes[ctrl.editingBoxIdx] && (
                    <motion.div
                        key="box-editor"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-50 flex items-center justify-center"
                        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
                        onClick={() => ctrl.setEditingBoxIdx(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 8 }}
                            transition={{ duration: 0.18, ease: EASE_OUT_EXPO }}
                            className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-[12px] shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <BoxEditorPanel
                                box={ctrl.boxes[ctrl.editingBoxIdx]}
                                index={ctrl.editingBoxIdx}
                                onChange={(updated) => ctrl.updateBox(ctrl.editingBoxIdx!, updated)}
                                onDelete={() => { ctrl.deleteBox(ctrl.editingBoxIdx!); ctrl.setEditingBoxIdx(null); }}
                                onSave={() => ctrl.saveBox(ctrl.editingBoxIdx!)}
                                saving={ctrl.savingIdx === ctrl.editingBoxIdx}
                                onClose={() => ctrl.setEditingBoxIdx(null)}
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── pipeline config modal ─────────────────────────────────── */}
            <AnimatePresence>
                {ctrl.showPipelineConfig && (
                    <motion.div
                        key="pipeline-config"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-50 flex items-center justify-center"
                        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
                        onClick={() => ctrl.setShowPipelineConfig(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 8 }}
                            transition={{ duration: 0.18, ease: EASE_OUT_EXPO }}
                            className="w-[360px] max-h-[85vh] overflow-y-auto rounded-[12px] shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <MainConfigEditor onClose={() => ctrl.setShowPipelineConfig(false)} />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── answer key modal ──────────────────────────────────────── */}
            <AnimatePresence>
                {ctrl.showAQA && (
                    <motion.div
                        key="aqa"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="fixed inset-0 z-50 flex items-center justify-center"
                        style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
                        onClick={() => ctrl.setShowAQA(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.96, y: 8 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.96, y: 8 }}
                            transition={{ duration: 0.18, ease: EASE_OUT_EXPO }}
                            className="w-[560px] max-h-[85vh] rounded-[12px] shadow-2xl overflow-hidden"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <AllQuestionAnswer onClose={() => ctrl.setShowAQA(false)} />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}