import { useState, useRef, useEffect } from "react";
import { RunStatus } from "../../lib/types/process_type";
import { BoxCoord, CanvasMode, BOX_COLORS } from "../../lib/types/setup_type";
import RequestHandler from "../../lib/utilities/request_handler";

export function useSetupController() {
    const [file, setFile] = useState<File | null>(null);
    const [dragging, setDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [runStatus, setRunStatus] = useState<RunStatus>("idle");
    const [baselineUrl, setBaselineUrl] = useState<string | null>(null);
    const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
    const [runError, setRunError] = useState<string | null>(null);

    const [boxes, setBoxes] = useState<BoxCoord[]>([]);
    const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
    const [savingIdx, setSavingIdx] = useState<number | null>(null);
    const [newestIdx, setNewestIdx] = useState<number | null>(null);
    const [canvasMode, setCanvasMode] = useState<CanvasMode>("pan");

    const [editingBoxIdx, setEditingBoxIdx] = useState<number | null>(null);
    const [showPipelineConfig, setShowPipelineConfig] = useState(false);
    const [showAQA, setShowAQA] = useState(false);

    const loadImageSize = (url: string) => {
        const img = new Image();
        img.onload = () => setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
        img.src = url;
    };

    const normalizeBox = (box: BoxCoord): BoxCoord => ({
        ...box,
        is_combined: box.is_combined ?? false,
        has_own_sheet: box.has_own_sheet ?? false,
        no_double: box.no_double ?? false,
        no_blank: box.no_blank ?? false,
        group: box.group ?? null,
        is_answerer: box.is_answerer ?? false
    });

    const fetchBoxes = () => {
        RequestHandler.fetchData("GET", "box_config/get_all").then((res) => {
            if (res?.success) setBoxes((res.data ?? []).map(normalizeBox));
        });
    };

    useEffect(() => { fetchBoxes(); }, []);

    const handleFile = (f: File) => {
        if (!f.type.startsWith("image/")) return;
        if (baselineUrl) URL.revokeObjectURL(baselineUrl);
        setFile(f);
        setBaselineUrl(null);
        setNaturalSize(null);
        setRunStatus("idle");
        setRunError(null);
        setSelectedIdx(null);
        setCanvasMode("pan");
    };

    useEffect(() => {
        if (!file) return;
        runPipeline(file);
    }, [file]);

    const runPipeline = async (f: File) => {
        setRunStatus("loading");
        setRunError(null);
        const fd = new FormData();
        fd.append("file", f);
        const res = await RequestHandler.fetchData("POST", "image_processor/pipeline_no_annotation", fd);
        if (res?.success === false) {
            setRunStatus("error");
            setRunError(res.message ?? "Unknown error");
            return;
        }
        const b64 = res?.data?.result;
        if (b64) {
            const blob = await fetch(`data:image/png;base64,${b64}`).then((r) => r.blob());
            const url = URL.createObjectURL(blob);
            setBaselineUrl(url);
            loadImageSize(url);
        }
        setRunStatus("done");
        fetchBoxes();
    };

    const onBoxDrawn = (
        partial: Omit<BoxCoord, "title" | "grid_cols" | "grid_rows" | "check_by_row" | "check_by_col" | "is_combined" | "has_own_sheet" | "no_double" | "no_blank" | "group" | "is_answerer">
    ) => {
        const newBox: BoxCoord = {
            ...partial,
            title: "",
            grid_cols: 5,
            grid_rows: 40,
            check_by_row: true,
            check_by_col: false,
            is_combined: false,
            has_own_sheet: false,
            no_double: false,
            no_blank: false,
            group: null,
            is_answerer: false
        };
        const newIdx = boxes.length;
        setBoxes((prev) => {
            setNewestIdx(prev.length);
            return [...prev, newBox];
        });
        setSelectedIdx(newIdx);
        setCanvasMode("pan");
        setEditingBoxIdx(newIdx);
    };

    const updateBox = (i: number, updated: BoxCoord) =>
        setBoxes((prev) => prev.map((b, idx) => (idx === i ? updated : b)));

    const deleteBox = async (i: number) => {
        const box = boxes[i];
        if (box.title) {
            await RequestHandler.fetchData("DELETE", `box_config/delete/${encodeURIComponent(box.title)}`);
        }
        setBoxes((prev) => prev.filter((_, idx) => idx !== i));
        setSelectedIdx(null);
        if (editingBoxIdx === i) setEditingBoxIdx(null);
    };

    const saveBox = async (i: number) => {
        const box = boxes[i];
        if (!box.title.trim()) return;
        setSavingIdx(i);
        const exists = await RequestHandler.fetchData("GET", `box_config/get/${encodeURIComponent(box.title)}`);
        const res = exists?.success && exists.data
            ? await RequestHandler.fetchData("POST", `box_config/update/${encodeURIComponent(box.title)}`, box)
            : await RequestHandler.fetchData("POST", "box_config/add", box);
        setSavingIdx(null);
        if (!res?.success) alert(res?.message ?? "Save failed");
    };

    const toggleMode = (m: CanvasMode) => setCanvasMode((prev) => prev === m ? "pan" : m);

    const ready = runStatus === "done" && !!baselineUrl;
    const loading = runStatus === "loading";

    return {
        // file
        file, dragging, setDragging, fileInputRef, handleFile,
        // status
        runStatus, runError, loading, ready,
        // canvas
        baselineUrl, naturalSize, canvasMode, toggleMode, setCanvasMode,
        // boxes
        boxes, selectedIdx, setSelectedIdx, savingIdx, newestIdx,
        onBoxDrawn, updateBox, deleteBox, saveBox,
        // modals
        editingBoxIdx, setEditingBoxIdx,
        showPipelineConfig, setShowPipelineConfig,
        showAQA, setShowAQA,
        // constants
        BOX_COLORS,
    };
}