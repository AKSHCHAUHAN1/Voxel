import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Clock, RotateCcw, Check, ChevronRight, GitCommit, Layers, Calendar } from 'lucide-react';
import { workspaceService } from '@/features/workspaces/workspace-service';

/**
 * VersionHistory — Panel showing all dashboard scene versions.
 *
 * Enables inspecting detailed version snapshots and reverting back to
 * previous checkpoints Git-style.
 */
export function VersionHistory({ dashboardId, activeVersion, onClose, onRestore }) {
  const [selectedVersionId, setSelectedVersionId] = useState(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ['dashboard-versions', dashboardId],
    queryFn: () => workspaceService.versions(dashboardId),
    enabled: Boolean(dashboardId),
  });

  const versions = data?.data || [];

  // Default to selecting the active or first version if none selected
  const activeOrSelectedVersion =
    versions.find((v) => v.id === selectedVersionId) ||
    versions.find((v) => v.version === activeVersion) ||
    versions[0];

  return (
    <aside className="w-80 border-l border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-950 flex flex-col h-full relative z-20 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 dark:border-white/5">
        <div className="flex items-center gap-2">
          <div className="grid size-7 place-items-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
            <Clock size={16} />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-slate-900 dark:text-white">Version History</h3>
            <p className="text-[10px] text-slate-400 font-medium">{versions.length} checkpoints recorded</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer transition"
        >
          <X size={16} />
        </button>
      </div>

      {/* Version List */}
      <div className="flex-1 overflow-y-auto mt-4 space-y-2.5 no-scrollbars pr-0.5">
        {isPending && (
          <div className="py-12 text-center text-xs text-slate-400 animate-pulse space-y-2">
            <GitCommit size={20} className="mx-auto text-violet-500 animate-spin" />
            <p>Loading version log history…</p>
          </div>
        )}
        {isError && (
          <div className="py-8 text-center text-xs text-rose-500 font-semibold">
            Failed to retrieve dashboard versions.
          </div>
        )}
        {!isPending && !isError && versions.length === 0 && (
          <div className="py-12 text-center text-xs text-slate-400 space-y-1">
            <GitCommit size={24} className="mx-auto opacity-30" />
            <p className="font-bold">No historical saves yet</p>
            <p className="text-[10px]">Changes saved will appear as version checkpoints here.</p>
          </div>
        )}

        {versions.map((ver) => {
          const isCurrent = ver.version === activeVersion;
          const isSelected = activeOrSelectedVersion?.id === ver.id;
          const date = new Date(ver.createdAt);
          const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const dateStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });
          const nodeCount = ver.scene?.nodes?.length || 0;
          const connCount = ver.scene?.connections?.length || 0;

          return (
            <div
              key={ver.id}
              onClick={() => setSelectedVersionId(ver.id)}
              className={`group flex flex-col p-3 rounded-2xl border transition-all cursor-pointer ${
                isSelected
                  ? 'border-violet-600 bg-violet-50/40 dark:bg-violet-500/10 shadow-sm ring-1 ring-violet-500/30'
                  : 'border-slate-200/80 hover:border-slate-300 dark:border-white/5 dark:hover:border-white/15 bg-slate-50/50 dark:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GitCommit size={14} className={isCurrent ? 'text-emerald-500' : 'text-violet-500'} />
                  <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                    Version #{ver.version}
                  </span>
                  {isCurrent && (
                    <span className="flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[8px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">
                      <Check size={8} /> Active
                    </span>
                  )}
                </div>
                <ChevronRight size={14} className={`text-slate-400 transition ${isSelected ? 'rotate-90 text-violet-600' : ''}`} />
              </div>

              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                <span className="flex items-center gap-1">
                  <Calendar size={10} /> {dateStr} at {timeStr}
                </span>
                <span className="flex items-center gap-1">
                  <Layers size={10} /> {nodeCount} nodes · {connCount} links
                </span>
              </div>

              {/* Revert Button for Selected non-current Version */}
              {isSelected && !isCurrent && (
                <div className="mt-3 pt-2.5 border-t border-slate-200/60 dark:border-white/10">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRestore(ver);
                    }}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-bold text-white shadow-md hover:bg-violet-500 active:scale-98 transition cursor-pointer"
                  >
                    <RotateCcw size={13} /> Revert to Version #{ver.version}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
