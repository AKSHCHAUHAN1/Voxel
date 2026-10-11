import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  ArrowRight,
  FolderPlus,
  LayoutDashboard,
  Layers,
  Box,
  BarChart3,
  Plus,
  Sparkles,
  X,
  Edit2,
  Trash2,
  Archive,
  RotateCcw,
  Copy as CopyIcon,
  Star,
  LogOut,
  Users,
  Pin,
  Search,
  MoreHorizontal,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { workspaceService } from './workspace-service';

import { useNotificationStore } from '@/store/notification-store';

const schema = z.object({
  name: z.string().trim().min(2, 'Use at least 2 characters.').max(80),
  description: z.string().trim().max(280).optional(),
  icon: z.enum(['grid', 'layers', 'box', 'chart']).default('grid'),
  accentColor: z.enum(['violet', 'cyan', 'emerald', 'amber', 'rose']).default('violet'),
});

const workspaceIcons = { grid: LayoutDashboard, layers: Layers, box: Box, chart: BarChart3 };
const workspaceAccentClasses = {
  violet: 'border-violet-500/20 bg-gradient-to-br from-violet-500/15 to-indigo-500/15 text-violet-600 dark:text-violet-300',
  cyan: 'border-cyan-500/20 bg-gradient-to-br from-cyan-500/15 to-sky-500/15 text-cyan-600 dark:text-cyan-300',
  emerald: 'border-emerald-500/20 bg-gradient-to-br from-emerald-500/15 to-teal-500/15 text-emerald-600 dark:text-emerald-300',
  amber: 'border-amber-500/20 bg-gradient-to-br from-amber-500/15 to-orange-500/15 text-amber-600 dark:text-amber-300',
  rose: 'border-rose-500/20 bg-gradient-to-br from-rose-500/15 to-pink-500/15 text-rose-600 dark:text-rose-300',
};

export default function WorkspacesPage() {
  const addNotification = useNotificationStore((s) => s.add);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [editWorkspace, setEditWorkspace] = useState(null);
  const [deleteWorkspace, setDeleteWorkspace] = useState(null);
  const [transferWorkspace, setTransferWorkspace] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('recent');

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef(null);

  useEffect(() => {
    if (!location.state?.openCreateWorkspace) return;
    setDialogOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.key, location.pathname, location.state, navigate]);

  const workspaces = useQuery({
    queryKey: ['workspaces', 'all'],
    queryFn: () => workspaceService.list({ includeArchived: true, includeDeleted: true }),
  });
  const transferMembers = useQuery({
    queryKey: ['workspaces', transferWorkspace?.id, 'members'],
    queryFn: () => workspaceService.members(transferWorkspace.id),
    enabled: Boolean(transferWorkspace),
  });

  const create = useMutation({
    mutationFn: workspaceService.create,
    onSuccess: async (workspace) => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      addNotification(`Created workspace "${workspace.name}"`, 'success');
      setDialogOpen(false);
      navigate(`/workspaces/${workspace.id}/dashboards`);
    },
  });

  const rename = useMutation({
    mutationFn: ({ id, ...input }) =>
      workspaceService.update(id, { ...input, description: input.description ?? null }),
    onSuccess: async (_res, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      addNotification(`Updated workspace "${variables.name}"`, 'info');
      setEditWorkspace(null);
    },
  });

  const remove = useMutation({
    mutationFn: workspaceService.delete,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      addNotification('Workspace deleted successfully', 'warning');
      setDeleteWorkspace(null);
    },
    onError: (error) => {
      console.error('Failed to delete workspace:', error);
      addNotification(error.message || 'Failed to delete workspace', 'warning');
      setDeleteWorkspace(null);
    }
  });

  const archive = useMutation({
    mutationFn: workspaceService.archive,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      addNotification('Workspace archived.', 'info');
      setContextMenu(null);
    },
    onError: (error) => addNotification(error.message || 'Workspace could not be archived.', 'warning'),
  });

  const restore = useMutation({
    mutationFn: workspaceService.restore,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      addNotification('Workspace restored.', 'success');
      setContextMenu(null);
    },
    onError: (error) => addNotification(error.message || 'Workspace could not be restored.', 'warning'),
  });

  const recover = useMutation({
    mutationFn: workspaceService.recoverWorkspace,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      addNotification('Workspace restored from trash. Public links and invitations stay revoked.', 'success');
      setContextMenu(null);
    },
    onError: (error) => addNotification(error.message || 'Workspace could not be restored from trash.', 'warning'),
  });

  const duplicate = useMutation({
    mutationFn: workspaceService.duplicate,
    onSuccess: async (workspace) => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      addNotification(`Created “${workspace.name}” with the same workspace settings.`, 'success');
      setContextMenu(null);
    },
    onError: (error) => addNotification(error.message || 'Workspace could not be duplicated.', 'warning'),
  });

  const leave = useMutation({
    mutationFn: workspaceService.leave,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      addNotification('You left the workspace.', 'info');
      setContextMenu(null);
    },
    onError: (error) => addNotification(error.message || 'You could not leave the workspace.', 'warning'),
  });

  const setFavorite = useMutation({
    mutationFn: ({ id, ...preferences }) => workspaceService.updatePreferences(id, preferences),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      addNotification(variables.isFavorite !== undefined
        ? variables.isFavorite ? 'Workspace added to favorites.' : 'Workspace removed from favorites.'
        : variables.isPinned ? 'Workspace pinned.' : 'Workspace unpinned.', 'info');
      setContextMenu(null);
    },
    onError: (error) => addNotification(error.message || 'Favorite could not be updated.', 'warning'),
  });

  const transferOwnership = useMutation({
    mutationFn: ({ workspaceId, memberId }) => workspaceService.transferOwnership(workspaceId, memberId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      addNotification('Workspace ownership transferred.', 'success');
      setTransferWorkspace(null);
    },
    onError: (error) => addNotification(error.message || 'Ownership could not be transferred.', 'warning'),
  });

  // Global click listener to close context menu
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleRightClick = (e, workspace) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      workspace,
    });
  };

  const visibleWorkspaces = (workspaces.data || [])
    .filter((workspace) => showDeleted ? Boolean(workspace.deletedAt) : !workspace.deletedAt && Boolean(workspace.archivedAt) === showArchived)
    .filter((workspace) => `${workspace.name} ${workspace.description || ''}`.toLowerCase().includes(search.trim().toLowerCase()))
    .sort((a, b) => sortBy === 'name'
      ? a.name.localeCompare(b.name)
      : sortBy === 'favorites'
        ? Number(b.isPinned) - Number(a.isPinned) || Number(b.isFavorite) - Number(a.isFavorite) || new Date(b.updatedAt) - new Date(a.updatedAt)
        : new Date(b.updatedAt) - new Date(a.updatedAt));

  return (
    <section>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-violet-600 dark:text-violet-400">
            Your organization
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">Workspaces</h1>
          <p className="mt-2 text-sm font-medium text-slate-600 dark:text-slate-400">
            Choose a space to build, share, and evolve your team’s operating system.
          </p>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4.5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-600/20 hover:bg-violet-500 transition cursor-pointer"
          >
            <Plus size={17} /> New workspace
          </button>
        </div>
      </div>

      {workspaces.isPending && <WorkspaceSkeleton />}
      {workspaces.isError && <ErrorState onRetry={() => void workspaces.refetch()} />}
      {workspaces.data && (
        <>
        <div className="mt-6 flex items-center gap-2 border-b border-slate-200 dark:border-white/10">
          {[{ label: 'Active', archived: false, deleted: false }, { label: 'Archived', archived: true, deleted: false }, { label: 'Trash', archived: false, deleted: true }].map((view) => (
            <button key={view.label} type="button" onClick={() => { setShowArchived(view.archived); setShowDeleted(view.deleted); }} className={`border-b-2 px-3 py-2.5 text-xs font-bold ${showDeleted === view.deleted && showArchived === view.archived ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-500'}`}>
              {view.label}
            </button>
          ))}
        </div>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative block min-w-0 flex-1 max-w-md">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search workspaces" aria-label="Search workspaces" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15 dark:border-white/10 dark:bg-slate-900" />
          </label>
          <label>
            <span className="sr-only">Sort workspaces</span>
            <select aria-label="Sort workspaces" value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 outline-none focus:border-violet-400 dark:border-white/10 dark:bg-slate-900 dark:text-slate-300">
              <option value="recent">Recently updated</option>
              <option value="name">Name A–Z</option>
              <option value="favorites">Pinned and favorite</option>
            </select>
          </label>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleWorkspaces.map((workspace) => (
            <WorkspaceCard
              key={workspace.id}
              workspace={workspace}
              isArchived={Boolean(workspace.archivedAt)}
              isDeleted={Boolean(workspace.deletedAt)}
              onOpen={() => {
                if (workspace.deletedAt) {
                  return ['OWNER', 'ADMIN'].includes(workspace.role)
                    ? recover.mutate(workspace.id)
                    : addNotification('Ask a workspace administrator to restore this workspace.', 'info');
                }
                if (workspace.archivedAt) {
                  return ['OWNER', 'ADMIN'].includes(workspace.role)
                    ? restore.mutate(workspace.id)
                    : addNotification('Ask a workspace administrator to restore this workspace.', 'info');
                }
                return navigate(`/workspaces/${workspace.id}/dashboards`);
              }}
              onContextMenu={(e) => handleRightClick(e, workspace)}
            />
          ))}
          {visibleWorkspaces.length === 0 && (search ? <p className="col-span-full rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/10">No workspaces match “{search}”.</p> : showDeleted ? <p className="col-span-full rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/10">Trash is empty.</p> : showArchived ? <p className="col-span-full rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-white/10">No archived workspaces.</p> : <EmptyState onCreate={() => setDialogOpen(true)} />)}
        </div>
        </>
      )}

      {/* Workspace actions */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 w-48 rounded-xl border border-slate-200 bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/95"
        >
          {contextMenu.workspace.deletedAt ? (
            ['OWNER', 'ADMIN'].includes(contextMenu.workspace.role)
              ? <button type="button" onClick={() => recover.mutate(contextMenu.workspace.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5"><RotateCcw size={13} /> Restore within 30 days</button>
              : <p className="px-2.5 py-2 text-xs text-slate-500">Ask an administrator to restore</p>
          ) : contextMenu.workspace.archivedAt ? (
            ['OWNER', 'ADMIN'].includes(contextMenu.workspace.role)
              ? <button type="button" onClick={() => restore.mutate(contextMenu.workspace.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5"><RotateCcw size={13} /> Restore workspace</button>
              : <p className="px-2.5 py-2 text-xs text-slate-500">Ask an administrator to restore</p>
          ) : (
            <>
              {['OWNER', 'ADMIN'].includes(contextMenu.workspace.role) && <button type="button" onClick={() => { setEditWorkspace(contextMenu.workspace); setContextMenu(null); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5"><Edit2 size={13} /> Edit workspace</button>}
          <button type="button" onClick={() => setFavorite.mutate({ id: contextMenu.workspace.id, isFavorite: !contextMenu.workspace.isFavorite })} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5"><Star size={13} className={contextMenu.workspace.isFavorite ? 'fill-amber-400 text-amber-400' : ''} /> {contextMenu.workspace.isFavorite ? 'Remove favorite' : 'Add favorite'}</button>
          <button type="button" onClick={() => setFavorite.mutate({ id: contextMenu.workspace.id, isPinned: !contextMenu.workspace.isPinned })} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5"><Pin size={13} className={contextMenu.workspace.isPinned ? 'fill-amber-400 text-amber-400' : ''} /> {contextMenu.workspace.isPinned ? 'Unpin workspace' : 'Pin workspace'}</button>
              <button type="button" onClick={() => duplicate.mutate(contextMenu.workspace.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5"><CopyIcon size={13} /> Duplicate settings</button>
              {['OWNER', 'ADMIN'].includes(contextMenu.workspace.role) && <button type="button" onClick={() => archive.mutate(contextMenu.workspace.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5"><Archive size={13} /> Archive workspace</button>}
              {contextMenu.workspace.role === 'OWNER' && <button type="button" onClick={() => { setTransferWorkspace(contextMenu.workspace); setContextMenu(null); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold hover:bg-slate-100 dark:hover:bg-white/5"><Users size={13} /> Transfer ownership</button>}
              {contextMenu.workspace.role === 'OWNER' && <button type="button" onClick={() => { setDeleteWorkspace(contextMenu.workspace); setContextMenu(null); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 size={13} /> Delete</button>}
              {contextMenu.workspace.role !== 'OWNER' && <button type="button" onClick={() => leave.mutate(contextMenu.workspace.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"><LogOut size={13} /> Leave workspace</button>}
            </>
          )}
        </div>
      )}

      {/* New Workspace Dialog */}
      {dialogOpen && (
        <WorkspaceDialog
          pending={create.isPending}
          error={create.error?.message}
          onClose={() => setDialogOpen(false)}
          onSubmit={(values) => create.mutate(values)}
        />
      )}

      {/* Edit Workspace Dialog */}
      {editWorkspace && (
        <EditWorkspaceDialog
          workspace={editWorkspace}
          pending={rename.isPending}
          onClose={() => setEditWorkspace(null)}
          onSubmit={(input) => rename.mutate({ id: editWorkspace.id, ...input })}
        />
      )}

      {/* Delete Workspace Confirmation */}
      {deleteWorkspace && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onMouseDown={() => setDeleteWorkspace(null)}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900"
          >
            <h3 className="text-base font-semibold text-rose-600">Delete Workspace</h3>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-5">
              Are you sure you want to delete <b>{deleteWorkspace.name}</b>? Its dashboards will move to Trash with it. You can restore it for 30 days; public links and pending invitations will be revoked.
            </p>
            <div className="mt-6 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDeleteWorkspace(null)}
                className="rounded-lg px-3 py-2 font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => remove.mutate(deleteWorkspace.id)}
                disabled={remove.isPending}
                className="rounded-lg bg-rose-600 px-3 py-2 font-semibold text-white hover:bg-rose-500 disabled:opacity-50"
              >
                {remove.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
      {transferWorkspace && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={() => setTransferWorkspace(null)}>
          <form onSubmit={(event) => { event.preventDefault(); const memberId = new FormData(event.currentTarget).get('memberId'); if (memberId) transferOwnership.mutate({ workspaceId: transferWorkspace.id, memberId }); }} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <div><h2 className="text-lg font-bold">Transfer workspace ownership</h2><p className="mt-1 text-xs leading-5 text-slate-500">You’ll become an administrator. The selected member will become the owner.</p></div>
            <select name="memberId" required defaultValue="" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950"><option value="" disabled>Select a member</option>{(transferMembers.data || []).filter((member) => member.role !== 'OWNER').map((member) => <option key={member.id} value={member.id}>{member.user.displayName || member.user.email} · {member.role}</option>)}</select>
            {transferOwnership.isError && <p className="text-xs text-rose-600">{transferOwnership.error.message}</p>}
            <div className="flex justify-end gap-2"><button type="button" onClick={() => setTransferWorkspace(null)} className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500">Cancel</button><button type="submit" disabled={transferOwnership.isPending || transferMembers.isPending} className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{transferOwnership.isPending ? 'Transferring…' : 'Transfer ownership'}</button></div>
          </form>
        </div>
      )}
    </section>
  );
}

function WorkspaceCard({ workspace, isArchived, isDeleted, onOpen, onContextMenu }) {
  const WorkspaceIcon = workspaceIcons[workspace.icon] || LayoutDashboard;
  const accentClass = workspaceAccentClasses[workspace.accentColor] || workspaceAccentClasses.violet;
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${isDeleted || isArchived ? 'Restore' : 'Open'} workspace ${workspace.name}`}
      onClick={(event) => { if (event.target === event.currentTarget) onOpen(); }}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen();
        }
        if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
          event.preventDefault();
          onContextMenu({ preventDefault: () => {}, clientX: event.currentTarget.getBoundingClientRect().right, clientY: event.currentTarget.getBoundingClientRect().top });
        }
      }}
      onContextMenu={onContextMenu}
      className="group relative cursor-pointer rounded-3xl border border-slate-200/90 bg-white/90 p-6 text-left shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-white/10 dark:bg-[#0c111e]/90 backdrop-blur-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`grid size-12 place-items-center rounded-2xl border transition-transform group-hover:scale-105 ${accentClass}`}>
          <WorkspaceIcon size={22} />
        </span>
        <span className="ml-auto rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {isDeleted ? 'Trash · 30 days' : isArchived ? 'Archived' : workspace.isPinned ? 'Pinned' : workspace.isFavorite ? '★ Favorite' : workspace.role}
        </span>
        <button type="button" aria-label={`More actions for ${workspace.name}`} onClick={(event) => { event.stopPropagation(); onContextMenu(event); }} className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white">
          <MoreHorizontal size={17} />
        </button>
      </div>
      <h2 className="mt-5 text-lg font-bold text-slate-900 dark:text-white tracking-tight">{workspace.name}</h2>
      <p className="mt-2 min-h-10 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {workspace.description || 'A focused visual workspace for collaborative modeling and data telemetry.'}
      </p>
      <span className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-violet-600 dark:text-violet-400 group-hover:text-violet-500">
        {isDeleted || isArchived ? 'Restore to open' : 'Open workspace'} <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
      </span>
    </div>
  );
}

function EditWorkspaceDialog({ workspace, pending, onClose, onSubmit }) {
  const { register, handleSubmit } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: workspace.name, description: workspace.description || '', icon: workspace.icon || 'grid', accentColor: workspace.accentColor || 'violet' },
  });

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-md"
      onMouseDown={onClose}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl border border-slate-200/90 bg-white p-7 shadow-2xl dark:border-white/10 dark:bg-[#0e1322] backdrop-blur-xl"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Rename workspace</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Name
          <input
            {...register('name')}
            autoFocus
            className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50/50 dark:bg-white/5 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none ring-violet-500/40 focus:ring-2 dark:border-white/10 focus:border-violet-500"
          />
        </label>
        <label className="mt-4 block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
          Description <span className="font-normal text-slate-400">(optional)</span>
          <textarea
            {...register('description')}
            rows={3}
            className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 dark:bg-white/5 px-3.5 py-2.5 text-sm text-slate-900 dark:text-white outline-none ring-violet-500/40 focus:ring-2 dark:border-white/10 focus:border-violet-500"
          />
        </label>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Icon
            <select {...register('icon')} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm normal-case dark:border-white/10 dark:bg-slate-950 dark:text-white">
              <option value="grid">Grid</option><option value="layers">Layers</option><option value="box">Box</option><option value="chart">Chart</option>
            </select>
          </label>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Accent color
            <select {...register('accentColor')} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm normal-case dark:border-white/10 dark:bg-slate-950 dark:text-white">
              <option value="violet">Violet</option><option value="cyan">Cyan</option><option value="emerald">Emerald</option><option value="amber">Amber</option><option value="rose">Rose</option>
            </select>
          </label>
        </div>
        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            disabled={pending}
            className="rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-violet-500 shadow-md shadow-violet-600/20 disabled:opacity-60 transition cursor-pointer"
          >
            {pending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div className="col-span-full rounded-3xl border border-dashed border-violet-300/80 bg-violet-50/50 p-12 text-center dark:border-violet-500/30 dark:bg-violet-500/5 backdrop-blur-sm">
      <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-violet-600 shadow-md dark:bg-slate-900 border border-violet-100 dark:border-violet-500/20">
        <Sparkles size={24} />
      </span>
      <h2 className="mt-4 text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">Your first workspace starts here</h2>
      <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
        Create a secure visual home for systems architecture, live metric telemetry, and collaborative team dashboards.
      </p>
      <button
        onClick={onCreate}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-violet-500 shadow-lg shadow-violet-600/25 transition cursor-pointer hover:scale-105 active:scale-95"
      >
        <FolderPlus size={16} /> Create workspace
      </button>
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center dark:border-rose-500/30 dark:bg-rose-500/10">
      <h2 className="font-semibold text-rose-700 dark:text-rose-200">
        Workspaces could not be loaded
      </h2>
      <button
        onClick={onRetry}
        className="mt-3 rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white"
      >
        Try again
      </button>
    </div>
  );
}

function WorkspaceSkeleton() {
  return (
    <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="h-56 animate-pulse rounded-2xl bg-slate-200 dark:bg-white/5" />
      ))}
    </div>
  );
}

function WorkspaceDialog({ pending, error, onClose, onSubmit }) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', icon: 'grid', accentColor: 'violet' },
  });
  return (
    <div
      className="fixed inset-0 z-30 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        onMouseDown={(event) => event.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900"
      >
        <div className="flex justify-between">
          <div>
            <h2 className="text-lg font-semibold">Create workspace</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Give your team a clear place to start.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>
        <label className="mt-6 block text-sm font-medium">
          Name
          <input
            {...form.register('name')}
            autoFocus
            className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 outline-none ring-violet-400 focus:ring-2 dark:border-white/10"
            placeholder="Product design"
          />
        </label>
        {form.formState.errors.name && (
          <p className="mt-1 text-xs text-rose-500">{form.formState.errors.name.message}</p>
        )}
        <label className="mt-4 block text-sm font-medium">
          Description <span className="font-normal text-slate-400">(optional)</span>
          <textarea
            {...form.register('description')}
            rows={3}
            className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 outline-none ring-violet-400 focus:ring-2 dark:border-white/10"
            placeholder="What does this team use Voxel for?"
          />
        </label>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium">Icon
            <select {...form.register('icon')} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950">
              <option value="grid">Grid</option><option value="layers">Layers</option><option value="box">Box</option><option value="chart">Chart</option>
            </select>
          </label>
          <label className="block text-sm font-medium">Accent color
            <select {...form.register('accentColor')} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950">
              <option value="violet">Violet</option><option value="cyan">Cyan</option><option value="emerald">Emerald</option><option value="amber">Amber</option><option value="rose">Rose</option>
            </select>
          </label>
        </div>
        {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            disabled={pending}
            className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? 'Creating…' : 'Create workspace'}
          </button>
        </div>
      </form>
    </div>
  );
}
