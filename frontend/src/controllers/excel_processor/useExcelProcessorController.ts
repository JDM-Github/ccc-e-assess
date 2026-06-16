import { useState, useEffect, useCallback, useRef } from "react";
import RequestHandler from "../../lib/utilities/request_handler";
import ExcelProcessorDB from "../../lib/utilities/excel_processor_db";
import type {
    FileSlotKey,
    GenerateErrorInfo,
    GenerateResult,
    GenerateStatus,
    MergeQueueItem,
    MergeStatus,
    SlotFile,
} from "../../lib/types/excel_processor_type";

const SLOT_LABELS: Record<FileSlotKey, string> = {
    applicant: "Applicant list",
    answerer: "Answer key",
    template: "Output template",
};

const SLOT_ORDER: FileSlotKey[] = ["applicant", "answerer", "template"];

function toSlotFile(f: File): SlotFile {
    return { name: f.name, size: f.size, lastModified: f.lastModified };
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1] ?? "");
        };
        reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
        reader.readAsDataURL(blob);
    });
}

function base64ToBlob(b64: string): Blob {
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    return new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function parseFilenameFromDisposition(header: string | null, fallback: string): string {
    if (!header) return fallback;
    const match = /filename="?([^";]+)"?/i.exec(header);
    return match?.[1]?.trim() || fallback;
}

export function useExcelProcessorController() {
    const [slots, setSlots] = useState<Partial<Record<FileSlotKey, File>>>({});
    const [slotMeta, setSlotMeta] = useState<Partial<Record<FileSlotKey, SlotFile>>>({});
    const [dragKey, setDragKey] = useState<FileSlotKey | null>(null);

    const [generateStatus, setGenerateStatus] = useState<GenerateStatus>("idle");
    const [generateError, setGenerateError] = useState<GenerateErrorInfo | null>(null);
    const [lastResult, setLastResult] = useState<GenerateResult | null>(null);
    const lastBlobRef = useRef<Blob | null>(null);

    const [queue, setQueue] = useState<MergeQueueItem[]>([]);
    const [queueLoaded, setQueueLoaded] = useState(false);
    const [mergeStatus, setMergeStatus] = useState<MergeStatus>("idle");
    const [mergeError, setMergeError] = useState<string | null>(null);
    const [addingToQueue, setAddingToQueue] = useState(false);

    // ── Hydrate from IndexedDB on mount ─────────────────────────────
    useEffect(() => {
        (async () => {
            const [storedQueue, storedForm] = await Promise.all([
                ExcelProcessorDB.getQueue(),
                ExcelProcessorDB.getFormState(),
            ]);
            setQueue(storedQueue);
            setQueueLoaded(true);
            if (storedForm) {
                setSlotMeta(storedForm.slotNames ?? {});
                setLastResult(storedForm.lastResult ?? null);
                if (storedForm.lastResult) setGenerateStatus("done");
            }
        })();
    }, []);

    // ── Persist form state (slot metadata + last result) on change ──
    useEffect(() => {
        if (!queueLoaded) return; // avoid clobbering before initial hydrate completes
        ExcelProcessorDB.setFormState({
            slotNames: slotMeta,
            lastResult,
            savedAt: Date.now(),
        });
    }, [slotMeta, lastResult, queueLoaded]);

    const setSlotFile = useCallback((key: FileSlotKey, file: File) => {
        setSlots((prev) => ({ ...prev, [key]: file }));
        setSlotMeta((prev) => ({ ...prev, [key]: toSlotFile(file) }));
        setGenerateStatus("idle");
        setGenerateError(null);
    }, []);

    const clearSlotFile = useCallback((key: FileSlotKey) => {
        setSlots((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        setSlotMeta((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }, []);

    const allSlotsFilled = SLOT_ORDER.every((k) => slots[k] != null);
    const filledFromCache = SLOT_ORDER.some((k) => slotMeta[k] != null && slots[k] == null);

    const classifyError = (status: number, message: string): GenerateErrorInfo => {
        if (status === 422) return { message, status, kind: "integrity" };
        if (status === 400) return { message, status, kind: "validation" };
        if (status >= 500) return { message, status, kind: "server" };
        return { message, status, kind: "network" };
    };

    const handleGenerate = useCallback(async () => {
        if (!allSlotsFilled) return;
        setGenerateStatus("loading");
        setGenerateError(null);

        const fd = new FormData();
        fd.append("applicant", slots.applicant as File);
        fd.append("answerer", slots.answerer as File);
        fd.append("template", slots.template as File);

        try {
            const url = `${RequestHandler.baseURL}/${RequestHandler.apiLink}/excel_processor/generate`;
            const isClient = typeof window !== "undefined";
            const headers: Record<string, string> = {};
            const authToken = isClient ? localStorage.getItem("authToken") : null;
            const authAccess = isClient ? localStorage.getItem("authAccess") : null;
            if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
            if (authAccess) headers["X-Auth-Token"] = `Bearer ${authAccess}`;

            const res = await fetch(url, { method: "POST", headers, body: fd });

            if (!res.ok) {
                let message = `HTTP error! Status: ${res.status}`;
                try {
                    const body = await res.json();
                    message = body.message || message;
                } catch {
                    // non-JSON error body; keep default message
                }
                setGenerateStatus("error");
                setGenerateError(classifyError(res.status, message));
                return;
            }

            const blob = await res.blob();
            const filename = parseFilenameFromDisposition(res.headers.get("Content-Disposition"), "output.xlsx");
            const totalGenerated = parseInt(res.headers.get("X-Total-Generated") ?? "0", 10) || 0;
            const skippedCount = parseInt(res.headers.get("X-Skipped-Count") ?? "0", 10) || 0;
            const skippedIdsRaw = res.headers.get("X-Skipped-Ids") ?? "";
            const skippedIds = skippedIdsRaw ? skippedIdsRaw.split(",").filter(Boolean) : [];

            lastBlobRef.current = blob;
            downloadBlob(blob, filename);

            setLastResult({ filename, totalGenerated, skippedCount, skippedIds, generatedAt: Date.now() });
            setGenerateStatus("done");
        } catch (err: unknown) {
            setGenerateStatus("error");
            setGenerateError({
                message: (err as Error)?.message ?? "Could not reach the server. Check your connection and try again.",
                kind: "network",
            });
        }
    }, [allSlotsFilled, slots]);

    const handleAddToMergeQueue = useCallback(async () => {
        if (!lastBlobRef.current || !lastResult) return;
        setAddingToQueue(true);
        try {
            const fileBase64 = await blobToBase64(lastBlobRef.current);
            const item: MergeQueueItem = {
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                filename: lastResult.filename,
                totalGenerated: lastResult.totalGenerated,
                skippedCount: lastResult.skippedCount,
                addedAt: Date.now(),
                fileBase64,
            };
            await ExcelProcessorDB.addToQueue(item);
            setQueue((prev) => [...prev, item]);
        } finally {
            setAddingToQueue(false);
        }
    }, [lastResult]);

    const handleRemoveFromQueue = useCallback(async (id: string) => {
        await ExcelProcessorDB.removeFromQueue(id);
        setQueue((prev) => prev.filter((q) => q.id !== id));
    }, []);

    const handleDownloadQueueItem = useCallback((item: MergeQueueItem) => {
        downloadBlob(base64ToBlob(item.fileBase64), item.filename);
    }, []);

    const handleClearQueue = useCallback(async () => {
        await ExcelProcessorDB.clearQueue();
        setQueue([]);
        setMergeStatus("idle");
        setMergeError(null);
    }, []);

    const handleMerge = useCallback(async () => {
        if (queue.length < 2) return;
        setMergeStatus("loading");
        setMergeError(null);

        const fd = new FormData();
        queue.forEach((item, i) => {
            fd.append(`files[${i}]`, base64ToBlob(item.fileBase64), item.filename);
        });

        try {
            const url = `${RequestHandler.baseURL}/${RequestHandler.apiLink}/excel_processor/merge`;
            const headers: Record<string, string> = {};
            const authToken = localStorage.getItem("authToken");
            const authAccess = localStorage.getItem("authAccess");
            if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
            if (authAccess) headers["X-Auth-Token"] = `Bearer ${authAccess}`;

            const res = await fetch(url, { method: "POST", headers, body: fd });

            if (!res.ok) {
                let message = `HTTP error! Status: ${res.status}`;
                try { const body = await res.json(); message = body.message || message; } catch { }
                setMergeStatus("error");
                setMergeError(message);
                return;
            }

            const blob = await res.blob();
            const filename = parseFilenameFromDisposition(res.headers.get("Content-Disposition"), "merged.xlsx");
            downloadBlob(blob, filename);
            setMergeStatus("done");
        } catch (err: unknown) {
            setMergeStatus("error");
            setMergeError((err as Error)?.message ?? "Could not reach the server.");
        }
    }, [queue]);

    const handleDownloadTemplate = useCallback(async (kind: "template" | "applicant") => {
        try {
            const url = `${RequestHandler.baseURL}/${RequestHandler.apiLink}/excel_processor/download/${kind}`;
            const headers: Record<string, string> = {};
            const authToken = localStorage.getItem("authToken");
            const authAccess = localStorage.getItem("authAccess");
            if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
            if (authAccess) headers["X-Auth-Token"] = `Bearer ${authAccess}`;

            const res = await fetch(url, { headers });
            if (!res.ok) return;
            const blob = await res.blob();
            const filename = parseFilenameFromDisposition(
                res.headers.get("Content-Disposition"),
                kind === "template" ? "output_template.xlsx" : "applicant_template.xlsx"
            );
            downloadBlob(blob, filename);
        } catch {
        }
    }, []);

    return {
        // slots
        slotOrder: SLOT_ORDER,
        slotLabels: SLOT_LABELS,
        slots,
        slotMeta,
        dragKey,
        setDragKey,
        setSlotFile,
        clearSlotFile,
        allSlotsFilled,
        filledFromCache,
        // generate
        generateStatus,
        generateError,
        lastResult,
        handleGenerate,
        // merge queue
        queue,
        queueLoaded,
        addingToQueue,
        canAddToQueue: generateStatus === "done" && !!lastResult && lastBlobRef.current != null,
        handleAddToMergeQueue,
        handleRemoveFromQueue,
        handleDownloadQueueItem,
        handleClearQueue,
        // merge
        mergeStatus,
        mergeError,
        canMerge: queue.length >= 2,
        handleMerge,
        handleDownloadTemplate
    };
}