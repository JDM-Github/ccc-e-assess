import type { MergeQueueItem, PersistedFormState } from "../types/excel_processor_type";

const DB_NAME = "excel_processor_db";
const DB_VERSION = 1;
const QUEUE_STORE = "merge_queue";
const FORM_STORE = "form_state";
const FORM_STATE_KEY = "last_form_state";

/**
 * Thin wrapper around the native IndexedDB API. No external deps —
 * mirrors the rest of this codebase's static-class utility style
 * (see RequestHandler). Two object stores:
 *   - merge_queue: keyed by item.id, holds MergeQueueItem entries
 *   - form_state:  single row keyed by a constant, holds PersistedFormState
 */
export default class ExcelProcessorDB {
    private static dbPromise: Promise<IDBDatabase> | null = null;

    private static open(): Promise<IDBDatabase> {
        if (typeof window === "undefined" || !("indexedDB" in window)) {
            return Promise.reject(new Error("IndexedDB is not available in this environment."));
        }
        if (ExcelProcessorDB.dbPromise) return ExcelProcessorDB.dbPromise;

        ExcelProcessorDB.dbPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);

            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(QUEUE_STORE)) {
                    db.createObjectStore(QUEUE_STORE, { keyPath: "id" });
                }
                if (!db.objectStoreNames.contains(FORM_STORE)) {
                    db.createObjectStore(FORM_STORE);
                }
            };

            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error ?? new Error("Failed to open IndexedDB."));
        });

        return ExcelProcessorDB.dbPromise;
    }

    private static async withStore<T>(
        storeName: string,
        mode: IDBTransactionMode,
        fn: (store: IDBObjectStore) => IDBRequest<T> | void,
    ): Promise<T> {
        const db = await ExcelProcessorDB.open();
        return new Promise<T>((resolve, reject) => {
            const tx = db.transaction(storeName, mode);
            const store = tx.objectStore(storeName);
            let result: T;

            tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed."));
            tx.oncomplete = () => resolve(result);

            const req = fn(store);
            if (req) {
                req.onsuccess = () => { result = req.result; };
                req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed."));
            }
        });
    }

    // ── Merge queue ──────────────────────────────────────────────────

    static async getQueue(): Promise<MergeQueueItem[]> {
        try {
            const items = await ExcelProcessorDB.withStore<MergeQueueItem[]>(
                QUEUE_STORE, "readonly", (store) => store.getAll(),
            );
            return (items ?? []).sort((a, b) => a.addedAt - b.addedAt);
        } catch {
            return [];
        }
    }

    static async addToQueue(item: MergeQueueItem): Promise<void> {
        await ExcelProcessorDB.withStore(QUEUE_STORE, "readwrite", (store) => store.put(item));
    }

    static async removeFromQueue(id: string): Promise<void> {
        await ExcelProcessorDB.withStore(QUEUE_STORE, "readwrite", (store) => store.delete(id));
    }

    static async clearQueue(): Promise<void> {
        await ExcelProcessorDB.withStore(QUEUE_STORE, "readwrite", (store) => store.clear());
    }

    // ── Form state ───────────────────────────────────────────────────

    static async getFormState(): Promise<PersistedFormState | null> {
        try {
            const state = await ExcelProcessorDB.withStore<PersistedFormState | undefined>(
                FORM_STORE, "readonly", (store) => store.get(FORM_STATE_KEY),
            );
            return state ?? null;
        } catch {
            return null;
        }
    }

    static async setFormState(state: PersistedFormState): Promise<void> {
        await ExcelProcessorDB.withStore(FORM_STORE, "readwrite", (store) => store.put(state, FORM_STATE_KEY));
    }

    static async clearFormState(): Promise<void> {
        await ExcelProcessorDB.withStore(FORM_STORE, "readwrite", (store) => store.delete(FORM_STATE_KEY));
    }
}