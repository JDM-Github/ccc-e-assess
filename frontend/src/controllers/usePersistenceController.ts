import { useState, useCallback } from "react";
import { ReviewSession } from "../lib/types/process_type";
import { UnifiedPageRef } from "./process/useReviewController";

export interface PersistedSnapshot {
    version: 1;
    exportedAt: string;
    pages: UnifiedPageRef[];
    sessions: (ReviewSession | null)[];
}

export type PersistStatus = "idle" | "saving" | "saved" | "error";

interface UsePersistenceControllerProps {
    sessions: (ReviewSession | null)[];
    pages: UnifiedPageRef[];
}

export function usePersistenceController({
    sessions,
    pages,
}: UsePersistenceControllerProps) {
    const [exportStatus, setExportStatus] = useState<PersistStatus>("idle");
    const [exportError, setExportError] = useState<string | null>(null);

    const buildSnapshot = useCallback((): PersistedSnapshot => ({
        version: 1,
        exportedAt: new Date().toISOString(),
        pages,
        sessions,
    }), [pages, sessions]);

    const buildSnapshotChunks = useCallback((snapshot: PersistedSnapshot): string[] => {
        const chunks: string[] = [];
        chunks.push(JSON.stringify({
            meta: true,
            version: snapshot.version,
            exportedAt: snapshot.exportedAt,
            pageCount: snapshot.pages.length,
            sessionCount: snapshot.sessions.length,
        }) + "\n");
        snapshot.pages.forEach((page, i) => {
            chunks.push(JSON.stringify({ kind: "page", index: i, data: page ?? null }) + "\n");
        });
        snapshot.sessions.forEach((session, i) => {
            chunks.push(JSON.stringify({ kind: "session", index: i, data: session ?? null }) + "\n");
        });
        return chunks;
    }, []);

    const exportJSON = useCallback(async () => {
        if (exportStatus !== "idle") return;
        setExportStatus("saving");
        setExportError(null);

        await new Promise((r) => setTimeout(r, 120));

        try {
            const snapshot = buildSnapshot();
            const chunks = buildSnapshotChunks(snapshot);
            const blob = new Blob(chunks, { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            const timestamp = new Date()
                .toISOString()
                .replace(/[:.]/g, "-")
                .slice(0, 19);
            a.href = url;
            a.download = `e-assess-${timestamp}.json`;

            a.style.display = "none";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            setExportStatus("saved");
        } catch (err) {
            console.error("JSON export failed:", err);
            setExportError(err instanceof Error ? err.message : "Unknown error");
            setExportStatus("error");
        } finally {
            setTimeout(() => setExportStatus("idle"), 3000);
        }
    }, [buildSnapshot, buildSnapshotChunks, exportStatus]);

    return {
        exportJSON,
        exportStatus,
        exportError,
        buildSnapshot,
    };
}