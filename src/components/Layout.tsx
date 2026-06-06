import { Outlet } from 'react-router-dom';
import { Sidebar, useSidebarCollapse } from './Sidebar';
import { Topbar } from './Topbar';
import { DetailPanel } from './DetailPanel';
import { AttachmentModal } from './AttachmentModal';
import { AppTour } from './AppTour';
import { useAppStore } from '../store';
import { Loader2, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { useRef, useCallback } from 'react';

export function Layout() {
  const { loading, attachmentModal, closeAttachmentModal } = useAppStore();
  const { collapsed, setCollapsed } = useSidebarCollapse();
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const hoveredOpen = useRef(false);

  const handleEdgeEnter = useCallback(() => {
    if (!collapsed) return;
    hoverTimer.current = setTimeout(() => {
      hoveredOpen.current = true;
      setCollapsed(false);
    }, 120);
  }, [collapsed, setCollapsed]);

  const handleEdgeLeave = useCallback(() => {
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; }
  }, []);

  const handleSidebarLeave = useCallback(() => {
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; }
    if (hoveredOpen.current) {
      hoveredOpen.current = false;
      setCollapsed(true);
    }
  }, [setCollapsed]);

  return (
    <div className="flex w-full h-screen overflow-hidden relative">
      {/* Invisible hover strip — triggers expand when sidebar is collapsed */}
      {collapsed && (
        <div
          className="absolute left-0 top-0 bottom-0 w-3 z-[70]"
          onMouseEnter={handleEdgeEnter}
          onMouseLeave={handleEdgeLeave}
        />
      )}
      <div ref={sidebarRef} onMouseLeave={collapsed ? undefined : handleSidebarLeave}
        className={cn("transition-all duration-300 shrink-0", collapsed ? "w-0 min-w-0" : "w-[220px] min-w-[220px]")}
      >
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      </div>
      {/* Toggle tab — rendered outside the clipped aside so it's always visible */}
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 z-[60] w-4 h-10 bg-dark border border-white/10 border-l-0 rounded-r-[4px] flex items-center justify-center text-white/40 hover:text-white/80 hover:bg-[#2a2a2a] transition-all duration-300",
          collapsed ? "left-0" : "left-[220px]"
        )}
      >
        <ChevronRight size={10} className={cn("transition-transform duration-300", !collapsed && "rotate-180")} />
      </button>
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-cream relative">
        <Topbar />
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

        {loading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-[1px] flex items-center justify-center z-[100] animate-in fade-in duration-200">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 text-blk opacity-20 animate-spin" />
              <div className="font-mono text-[9px] font-bold tracking-[3px] uppercase text-blk opacity-50">Synchronizing...</div>
            </div>
          </div>
        )}
      </div>
      <DetailPanel />
      <AttachmentModal
        entityType={attachmentModal.type as any}
        entityId={attachmentModal.id as any}
        isOpen={!!attachmentModal.type}
        onClose={closeAttachmentModal}
      />
      <AppTour />
    </div>
  );
}
