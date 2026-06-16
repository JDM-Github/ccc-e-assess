export type FileSlotKey = "applicant" | "answerer" | "template";

export type GenerateStatus = "idle" | "loading" | "done" | "error";

export interface SlotFile {
    name: string;
    size: number;
    lastModified: number;
}

/**
 * Result of a single successful /generate call.
 * `fileBlob` is kept only in memory (never persisted — raw bytes are not
 * what we cache across reloads, per design: only metadata + queue survive).
 */
export interface GenerateResult {
    filename: string;
    totalGenerated: number;
    skippedCount: number;
    skippedIds: string[];
    generatedAt: number;
}

export interface GenerateErrorInfo {
    message: string;
    status?: number;
    kind: "integrity" | "validation" | "server" | "network";
}

/**
 * One entry sitting in the merge queue. Added explicitly by the user via
 * "Add to merge queue" — never automatically from a generate run.
 * `fileBlob` is a base64 string so it can be written to IndexedDB directly.
 */
export interface MergeQueueItem {
    id: string;
    filename: string;
    totalGenerated: number;
    skippedCount: number;
    addedAt: number;
    fileBase64: string;
}

export interface PersistedFormState {
    slotNames: Partial<Record<FileSlotKey, SlotFile>>;
    lastResult: GenerateResult | null;
    savedAt: number;
}

export type MergeStatus = "idle" | "loading" | "done" | "error";