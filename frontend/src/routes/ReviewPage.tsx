import { ReviewSession } from "../lib/types/process_type";
import { useReviewController, ExportStatus, UnifiedPageRef } from "../controllers/process/useReviewController";
import { usePersistenceController } from "../controllers/usePersistenceController";
import ReviewSidebar from "../components/process/ReviewSidebar";
import CanvasViewer from "../components/process/CanvasViewer";

interface ReviewPageProps {
    sessions: (ReviewSession | null)[];
    pages: UnifiedPageRef[];
    onBack: () => void;
    onSavePage: (pageIndex: number, updated: ReviewSession) => void;
    onSaveToExcel?: () => void;
    exportStatus?: ExportStatus;
    exportError?: string | null;
}

export default function ReviewPage({
    sessions: initialSessions,
    pages,
    onBack,
    onSavePage,
    onSaveToExcel,
    exportStatus = "idle",
    exportError = null,
}: ReviewPageProps) {
    const ctrl = useReviewController({ initialSessions, pages, onSavePage, onBack });
    const persist = usePersistenceController({ sessions: ctrl.sessions, pages });

    return (
        <div className="flex h-[calc(100vh-120px)] gap-5">
            <ReviewSidebar
                pageIdx={ctrl.pageIdx}
                totalPages={ctrl.totalPages}
                sessions={ctrl.sessions}
                pages={pages}
                dirtyPages={ctrl.dirtyPages}
                mode={ctrl.mode}
                isDirty={ctrl.isDirty}
                isSaved={ctrl.isSaved}
                currentSession={ctrl.currentSession}
                exportStatus={exportStatus}
                exportError={exportError}
                onSetMode={ctrl.setMode}
                onGoToPage={ctrl.goToPage}
                onBack={ctrl.handleBack}
                onSave={ctrl.handleSave}
                onSaveToExcel={onSaveToExcel}
                persistExportStatus={persist.exportStatus}
                onExportJSON={persist.exportJSON}
            />

            <div className="flex-1 min-w-0 overflow-hidden flex flex-col min-h-0 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)]">
                <div className="px-[18px] py-[13px] border-b border-[var(--color-border)] flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono font-bold tracking-[0.12em] uppercase text-[var(--color-accent)] opacity-70">
                            Canvas
                        </span>
                        <span className="w-px h-3 bg-[var(--color-border2)]" />
                        <span className="text-[13px] font-semibold text-[var(--color-text)]">
                            Page {ctrl.pageIdx + 1}
                        </span>
                        {ctrl.currentSession && (
                            <>
                                <span className="w-px h-3 bg-[var(--color-border2)]" />
                                <span className="text-[10px] font-mono text-[var(--color-text-faint)]">
                                    {ctrl.currentSession.boxes.length} box{ctrl.currentSession.boxes.length !== 1 ? "es" : ""}
                                </span>
                            </>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[9px] font-mono text-[var(--color-text-faint)] bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-[2px] rounded-[4px] tracking-[0.04em]">
                            ← → to navigate
                        </span>
                        <span className="text-[9px] font-mono text-[var(--color-text-faint)] bg-[var(--color-bg)] border border-[var(--color-border)] px-2 py-[2px] rounded-[4px] tracking-[0.04em]">
                            scroll to zoom · drag to pan
                        </span>
                    </div>
                </div>

                <div className="flex-1 min-h-0 relative">
                    <div className="pointer-events-none absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-[0.06] blur-[130px] bg-[#4F6EF7]" />
                    <div className="pointer-events-none absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-[0.05] blur-[110px] bg-[#10B981]" />

                    {ctrl.currentSession ? (
                        <div className="absolute inset-0">
                            <CanvasViewer
                                key={`canvas-${ctrl.pageIdx}`}
                                session={ctrl.currentSession}
                                mode={ctrl.mode}
                                onToggle={ctrl.toggleCell}
                            />
                        </div>
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                            <div className="w-10 h-10 rounded-[10px] bg-[var(--color-surface2)] border border-[var(--color-border)] flex items-center justify-center opacity-40">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-faint)" strokeWidth="1.5">
                                    <rect x="3" y="3" width="18" height="18" rx="2" />
                                    <path d="M9 9h6M9 12h4" strokeLinecap="round" />
                                </svg>
                            </div>
                            <p className="text-[11px] font-mono text-[var(--color-text-faint)]">
                                No reviewable data for this page.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}