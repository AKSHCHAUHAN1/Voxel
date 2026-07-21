import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  ArrowRight,
  FolderPlus,
  LayoutDashboard,
  Plus,
  Sparkles,
  X,
  Edit2,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { workspaceService } from './workspace-service';

const schema = z.object({
  name: z.string().trim().min(2, 'Use at least 2 characters.').max(80),
  description: z.string().trim().max(280).optional(),
});

export default function WorkspacesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [editWorkspace, setEditWorkspace] = useState(null);
  const [deleteWorkspace, setDeleteWorkspace] = useState(null);

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const menuRef = useRef(null);

  const workspaces = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspaceService.list,
  });

  const create = useMutation({
    mutationFn: workspaceService.create,
    onSuccess: async (workspace) => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setDialogOpen(false);
      navigate(`/workspaces/${workspace.id}/dashboards`);
    },
  });

  const rename = useMutation({
    mutationFn: ({ id, name, description }) =>
      workspaceService.update(id, { name, description: description ?? null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setEditWorkspace(null);
    },
  });

  const remove = useMutation({
    mutationFn: workspaceService.delete,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      setDeleteWorkspace(null);
    },
    onError: (error) => {
      console.error('Failed to delete workspace:', error);
      alert(error.message || 'Failed to delete workspace');
      setDeleteWorkspace(null);
    }
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

  return (
    <section>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-violet-500">
            Your organization
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Workspaces</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Choose a space to build, share, and evolve your team’s operating system.
          </p>
        </div>
        <div className="flex gap-2.5">
          <button
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 hover:bg-violet-500"
          >
            <Plus size={17} /> New workspace
          </button>
        </div>
      </div>

      {workspaces.isPending && <WorkspaceSkeleton />}
      {workspaces.isError && <ErrorState onRetry={() => void workspaces.refetch()} />}
      {workspaces.data && (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workspaces.data.map((workspace) => (
            <WorkspaceCard
              key={workspace.id}
              workspace={workspace}
              onOpen={() => navigate(`/workspaces/${workspace.id}/dashboards`)}
              onContextMenu={(e) => handleRightClick(e, workspace)}
            />
          ))}
          {workspaces.data.length === 0 && <EmptyState onCreate={() => setDialogOpen(true)} />}
        </div>
      )}

      {/* Floating Context Menu - Only Edit Title and Delete for Workspaces */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 w-36 rounded-xl border border-slate-200 bg-white/90 p-1.5 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90"
        >
          <button
            onClick={() => {
              setEditWorkspace(contextMenu.workspace);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <Edit2 size={13} /> Edit Title
          </button>
          <div className="my-1 border-t border-slate-100 dark:border-white/5" />
          <button
            onClick={() => {
              setDeleteWorkspace(contextMenu.workspace);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
          >
            <Trash2 size={13} /> Delete
          </button>
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
          onSubmit={(name, description) =>
            rename.mutate({ id: editWorkspace.id, name, description: description ?? null })
          }
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
              Are you sure you want to delete <b>{deleteWorkspace.name}</b>? All dashboard designs
              and connected node canvas assets will be soft-deleted. This action can be undone by
              system administrators.
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
    </section>
  );
}

function WorkspaceCard({ workspace, onOpen, onContextMenu }) {
  return (
    <button
      onClick={onOpen}
      onContextMenu={onContextMenu}
      className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-lg dark:border-white/10 dark:bg-slate-900 dark:hover:border-violet-400/40"
    >
      <div className="flex items-start justify-between">
        <span className="grid size-11 place-items-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
          <LayoutDashboard size={20} />
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-white/5 dark:text-slate-400">
          {workspace.role}
        </span>
      </div>
      <h2 className="mt-6 text-base font-semibold">{workspace.name}</h2>
      <p className="mt-2 min-h-10 text-sm leading-5 text-slate-500 dark:text-slate-400">
        {workspace.description || 'A focused visual space for this team.'}
      </p>
      <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-violet-600 dark:text-violet-300">
        Open workspace <ArrowRight size={15} className="transition group-hover:translate-x-1" />
      </span>
    </button>
  );
}

function EditWorkspaceDialog({ workspace, pending, onClose, onSubmit }) {
  const { register, handleSubmit } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { name: workspace.name, description: workspace.description || '' },
  });

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <form
        onSubmit={handleSubmit((data) => onSubmit(data.name, data.description ?? null))}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Rename workspace</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>
        <label className="block text-sm font-medium">
          Name
          <input
            {...register('name')}
            autoFocus
            className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 outline-none ring-violet-400 focus:ring-2 dark:border-white/10"
          />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Description <span className="font-normal text-slate-400">(optional)</span>
          <textarea
            {...register('description')}
            rows={3}
            className="mt-2 w-full resize-none rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 outline-none ring-violet-400 focus:ring-2 dark:border-white/10"
          />
        </label>
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
            {pending ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

function EmptyState({ onCreate }) {
  return (
    <div className="col-span-full rounded-2xl border border-dashed border-violet-300 bg-violet-50/70 p-12 text-center dark:border-violet-500/40 dark:bg-violet-500/5">
      <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-violet-600 shadow-sm dark:bg-slate-900">
        <Sparkles size={21} />
      </span>
      <h2 className="mt-4 text-lg font-semibold">Your first workspace starts here</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500 dark:text-slate-400">
        Create a secure home for visual systems, shared context, and the decisions that move your
        work forward.
      </p>
      <button
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white"
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
    defaultValues: { name: '', description: '' },
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
