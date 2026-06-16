import { motion } from "framer-motion";
import { useExcelProcessorController } from "../controllers/excel_processor/useExcelProcessorController";
import GenerateCard from "../components/excel_processor/GenerateCard";
import MergeQueueCard from "../components/excel_processor/MergeQueueCard";
import type { FileSlotKey } from "../lib/types/excel_processor_type";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export default function ExcelProcessorPage() {
    const ctrl = useExcelProcessorController();

    const hasFile: Record<FileSlotKey, boolean> = {
        applicant: ctrl.slots.applicant != null,
        answerer: ctrl.slots.answerer != null,
        template: ctrl.slots.template != null,
    };

    const handleDragOver = (key: FileSlotKey, e: React.DragEvent) => {
        e.preventDefault();
        ctrl.setDragKey(key);
    };
    const handleDragLeave = () => ctrl.setDragKey(null);
    const handleDrop = (key: FileSlotKey, e: React.DragEvent) => {
        e.preventDefault();
        ctrl.setDragKey(null);
        const f = e.dataTransfer.files[0];
        if (f) ctrl.setSlotFile(key, f);
    };

    return (
        <div className="flex flex-col gap-4 w-full max-w-7xl pb-7">

            <div
                className="pointer-events-none fixed top-[-15%] left-[-8%] w-[480px] h-[480px] rounded-full opacity-[0.07] blur-[120px]"
                style={{ background: "radial-gradient(circle at 30% 30%, #4F6EF7 0%, transparent 70%)" }}
            />
            <div
                className="pointer-events-none fixed bottom-0 right-0 w-[400px] h-[400px] rounded-full opacity-[0.06] blur-[100px]"
                style={{ background: "radial-gradient(circle at 70% 70%, #10B981 0%, transparent 80%)" }}
            />

            {/* Header */}
            <motion.div
                className="flex flex-col gap-1"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: EASE_OUT_EXPO }}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono font-bold tracking-[0.12em] uppercase text-[var(--color-accent)]">
                            Excel Processor
                        </span>
                        <span className="w-px h-3 bg-[var(--color-border2)]" />
                        <span className="text-[10px] font-mono text-[var(--color-text-faint)] tracking-[0.06em]">
                            POST /api/excel_processor/generate
                        </span>
                    </div>
                </div>

                <h1 className="text-[2rem] font-extrabold text-[var(--color-text)] tracking-[-0.03em] leading-tight m-0">
                    Merge records with{" "}
                    <span
                        className="bg-clip-text text-transparent"
                        style={{ backgroundImage: "linear-gradient(135deg, #4F6EF7, #7C3AED)" }}
                    >
                        confidence.
                    </span>
                </h1>
                <p className="text-[0.8rem] font-mono text-[var(--color-text-muted)] leading-relaxed m-0">
                    Combine the applicant list, answer key, and template into a masterlist and scoresheet — then stack outputs into one merge queue.
                </p>
            </motion.div>

            <div className="grid grid-cols-2 gap-3 max-w-5xl">
                <GenerateCard
                    slotOrder={ctrl.slotOrder}
                    slotLabels={ctrl.slotLabels}
                    slotMeta={ctrl.slotMeta}
                    hasFile={hasFile}
                    dragKey={ctrl.dragKey}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onFileChange={ctrl.setSlotFile}
                    onClear={ctrl.clearSlotFile}
                    allSlotsFilled={ctrl.allSlotsFilled}
                    generateStatus={ctrl.generateStatus}
                    generateError={ctrl.generateError}
                    lastResult={ctrl.lastResult}
                    onGenerate={ctrl.handleGenerate}
                    canAddToQueue={ctrl.canAddToQueue}
                    addingToQueue={ctrl.addingToQueue}
                    onAddToQueue={ctrl.handleAddToMergeQueue}
                    onDownloadTemplate={ctrl.handleDownloadTemplate}
                />
                <MergeQueueCard
                    queue={ctrl.queue}
                    queueLoaded={ctrl.queueLoaded}
                    mergeStatus={ctrl.mergeStatus}
                    mergeError={ctrl.mergeError}
                    canMerge={ctrl.canMerge}
                    onMerge={ctrl.handleMerge}
                    onRemove={ctrl.handleRemoveFromQueue}
                    onDownload={ctrl.handleDownloadQueueItem}
                    onClearAll={ctrl.handleClearQueue}
                />
            </div>

            {/* Feature bullets */}
            <motion.div
                className="flex flex-col gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.4 }}
            >
                {[
                    "Three-file pipeline — applicant list, answer key, template",
                    "Integrity checks catch mismatched or duplicate Application Nos.",
                    "Each output downloads automatically once generated",
                    "Add finished outputs to a merge queue at your own pace",
                    "Queue and last session persist locally — a reload won't lose your place",
                ].map((f, i) => (
                    <motion.div
                        key={f}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.34 + i * 0.06, duration: 0.3, ease: EASE_OUT_EXPO }}
                        className="flex items-center gap-2"
                    >
                        <div className="w-1 h-1 rounded-full bg-[var(--color-accent)] opacity-50 shrink-0" />
                        <span className="text-[0.8rem] font-mono text-[var(--color-text-faint)]">{f}</span>
                    </motion.div>
                ))}
            </motion.div>
        </div>
    );
}