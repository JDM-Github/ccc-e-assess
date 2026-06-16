import { useRef } from "react";
import { motion } from "framer-motion";
import { Upload } from "lucide-react";
import { useProcessController } from "../controllers/process/useProcessController";
import type { PersistedSnapshot } from "../controllers/usePersistenceController";
import InputCard from "../components/process/InputCard";
import RunCard from "../components/process/RunCard";
import ReviewPage from "./ReviewPage";

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

export default function ProcessorPage() {
	const ctrl = useProcessController();
	const snapshotInputRef = useRef<HTMLInputElement>(null);

	const handleSnapshotImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const f = e.target.files?.[0];
		if (!f) return;

		try {
			const reader = f.stream().pipeThrough(new TextDecoderStream()).getReader();

			let buffer = "";
			let meta: any = null;
			const pages: (PersistedSnapshot["pages"][number] | null)[] = [];
			const sessions: PersistedSnapshot["sessions"] = [];

			const consumeLine = (line: string) => {
				if (!line.trim()) return;
				const obj = JSON.parse(line);
				if (obj.meta) meta = obj;
				else if (obj.kind === "page") pages[obj.index] = obj.data;
				else if (obj.kind === "session") sessions[obj.index] = obj.data;
			};

			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				buffer += value;
				let nlIdx: number;
				while ((nlIdx = buffer.indexOf("\n")) >= 0) {
					consumeLine(buffer.slice(0, nlIdx));
					buffer = buffer.slice(nlIdx + 1);
				}
			}
			if (buffer.trim()) consumeLine(buffer);

			if (!meta || meta.version !== 1) {
				alert("Invalid snapshot file.");
				return;
			}

			const densePages = Array.from({ length: meta.pageCount }, (_, i) => pages[i] ?? null);
			const denseSessions = Array.from({ length: meta.sessionCount }, (_, i) => sessions[i] ?? null);

			const restoredPages = denseSessions.map((session, i) => ({
				index: densePages[i]?.index ?? i,
				result: session?.resultImage ?? null,
				elapsed: null,
				error: densePages[i]?.error ?? null,
				answers: session?.answers ?? null,
				quads: session?.quads ?? null,
				box_meta: session?.boxes ?? null,
			}));

			ctrl.setPages(restoredPages);
			ctrl.setReviewSessions(denseSessions);
			e.target.value = "";
		} catch (err) {
			console.error("Snapshot import failed:", err);
			alert("Could not parse snapshot — make sure it's a valid E-Assess .json file.");
		}
	};

	if (ctrl.reviewSessions) {
		return (
			<ReviewPage
				sessions={ctrl.reviewSessions}
				pages={ctrl.pages}
				onBack={() => ctrl.setReviewSessions(null)}
				onSavePage={ctrl.handleSaveReviewPage}
				onSaveToExcel={ctrl.handleSaveToExcel}
				exportStatus={ctrl.exportStatus}
				exportError={ctrl.exportError}
			/>
		);
	}

	return (
		<div className="flex flex-col gap-4 w-full max-w-7xl mx-auto">

			{/* Ambient blobs */}
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
							Image Processor
						</span>
						<span className="w-px h-3 bg-[var(--color-border2)]" />
						<span className="text-[10px] font-mono text-[var(--color-text-faint)] tracking-[0.06em]">
							POST /api/image_processor
						</span>
					</div>

					{/* Snapshot import */}
					<button
						onClick={() => snapshotInputRef.current?.click()}
						className="flex items-center gap-1.5 px-3 py-[6px] rounded-[6px] text-[11px] font-mono font-semibold border border-[var(--color-border2)] bg-[var(--color-surface2)] text-[var(--color-text-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] transition-colors duration-150"
					>
						<Upload size={12} strokeWidth={2} />
						Import snapshot
					</button>
					<input
						ref={snapshotInputRef}
						type="file"
						accept=".json,application/json"
						className="hidden"
						onChange={handleSnapshotImport}
					/>
				</div>

				<h1 className="text-[2rem] font-extrabold text-[var(--color-text)] tracking-[-0.03em] leading-tight m-0">
					Process with{" "}
					<span
						className="bg-clip-text text-transparent"
						style={{ backgroundImage: "linear-gradient(135deg, #4F6EF7, #7C3AED)" }}
					>
						precision.
					</span>
				</h1>
				<p className="text-[0.8rem] font-mono text-[var(--color-text-muted)] leading-relaxed m-0">
					Run the full pipeline on an image or stream all pages of a PDF in parallel.
				</p>
			</motion.div>

			<div className="grid grid-cols-2 gap-3 max-w-5xl">
				<InputCard
					file={ctrl.file}
					previewUrl={ctrl.previewUrl}
					isPdf={ctrl.isPdf || false}
					dragging={ctrl.dragging}
					onDragOver={(e) => { e.preventDefault(); ctrl.setDragging(true); }}
					onDragLeave={() => ctrl.setDragging(false)}
					onDrop={ctrl.onDrop}
					onFileChange={ctrl.handleFile}
					onPageRangeChange={(range) => ctrl.setPageRange(range)}
				/>
				<RunCard
					isPdf={ctrl.isPdf || false}
					busy={ctrl.busy}
					file={ctrl.file}
					runStatus={ctrl.runStatus}
					overallStatus={ctrl.overallStatus}
					runError={ctrl.runError}
					batchProcessing={ctrl.batchProcessing}
					batchTotalPages={ctrl.batchTotalPages}
					donePages={ctrl.donePages}
					canReview={ctrl.canReview}
					buildingReview={ctrl.buildingReview}
					reviewableCount={ctrl.reviewableCount}
					onRun={ctrl.handleRun}
					onOpenReview={ctrl.handleOpenReview}
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
					"Single image or multi-page PDF support",
					"Streamed batch processing — pages run concurrently",
					"Inline answer review before export",
					"One-click Excel export with validation",
					"Import a saved snapshot to resume a previous session",
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