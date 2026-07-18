import { useQuery } from '@tanstack/react-query';
import { X, Clock, RotateCcw, Check } from 'lucide-react';
import { workspaceService } from '@/features/workspaces/workspace-service';

/**
 * VersionHistory — Panel showing all dashboard scene versions.
 *
 * Enables reviewing history timestamps, version counts, and rolling back
 * the canvas editor scene state.
 */
export function VersionHistory({ dashboardId, activeVersion, onClose, onRestore }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['dashboard-versions', dashboardId],
    queryFn: () => workspaceService.versions(dashboardId),
    enabled: Boolean(dashboardId),
  });

  const versions = data?.data || [];

  return (
    <aside className="w-80 border-l border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-950 flex flex-col h-full relative z-20 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-violet-500" />
          <h3 className="font-bold text-sm">Version History</h3>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
        >
          <X size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto mt-4 space-y-3 no-scrollbars">
        {isPending && (
          <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
            Loading history log…
          </div>
        )}
        {isError && (
          <div className="py-8 text-center text-xs text-rose-500">
            Failed to retrieve versions.
          </div>
        )}
        {!isPending && !isError && versions.length === 0 && (
          <div className="py-8 text-center text-xs text-slate-400">
            No save points recorded yet.
          </div>
        )}

        {versions.map((ver, idx) => {
          const isCurrent = ver.version === activeVersion;
          const date = new Date(ver.createdAt);
          const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

          return (
            <div
              key={ver.id}
              className={`group flex items-start justify-between p-3 rounded-xl border transition-all ${
                isCurrent
                  ? 'border-violet-500 bg-violet-50/10'
                  : 'border-slate-100 hover:border-slate-200 dark:border-white/5 dark:hover:border-white/10 bg-slate-50/20 dark:bg-white/5'
              }`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800 dark:text-white">
                    Version #{ver.version}
                  </span>
                  {isCurrent && (
                    <span className="flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.2 text-[8px] font-extrabold uppercase text-emerald-500 tracking-wider">
                      <Check size={8} /> Active
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 block font-medium">
                  {dateStr} at {timeStr}
                </span>
                <span className="text-[10px] text-slate-500 block">
                  {ver.scene?.nodes?.length || 0} nodes · {ver.scene?.connections?.length || 0} links
                </span>
              </div>

              {!isCurrent && (
                <button
                  onClick={() => onRestore(ver)}
                  title="Restore this version"
                  className="rounded-lg p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-500/5 cursor-pointer transition opacity-0 group-hover:opacity-100"
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
