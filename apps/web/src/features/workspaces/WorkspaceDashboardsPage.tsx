import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { ArrowLeft, ArrowRight, LayoutDashboard, Plus, X } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { workspaceService } from './workspace-service';

const schema = z.object({
  name: z.string().trim().min(2, 'Use at least 2 characters.').max(120),
  description: z.string().trim().max(280).optional(),
});
type DashboardForm = z.infer<typeof schema>;

export default function WorkspaceDashboardsPage() {
  const { workspaceId } = useParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const dashboards = useQuery({
    queryKey: ['workspaces', workspaceId, 'dashboards'],
    queryFn: () => workspaceService.dashboards(workspaceId!),
    enabled: Boolean(workspaceId),
  });
  const create = useMutation({
    mutationFn: (input: DashboardForm) => workspaceService.createDashboard(workspaceId!, input),
    onSuccess: async (dashboard) => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'dashboards'] });
      navigate(`/workspaces/${workspaceId}/dashboards/${dashboard.id}`);
    },
  });
  if (!workspaceId) return null;
  return (
    <section>
      <Link
        to="/workspaces"
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-violet-600"
      >
        <ArrowLeft size={16} /> All workspaces
      </Link>
      <div className="mt-6 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-violet-500">
            Workspace
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Dashboards</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Create focused canvases for the systems your team operates together.
          </p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20"
        >
          <Plus size={17} /> New dashboard
        </button>
      </div>
      {dashboards.isPending && (
        <div className="mt-8 h-48 animate-pulse rounded-2xl bg-slate-200 dark:bg-white/5" />
      )}
      {dashboards.data && (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dashboards.data.map((dashboard) => (
            <button
              key={dashboard.id}
              onClick={() => navigate(`/workspaces/${workspaceId}/dashboards/${dashboard.id}`)}
              className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-violet-300 hover:shadow-lg dark:border-white/10 dark:bg-slate-900"
            >
              <span className="grid size-11 place-items-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
                <LayoutDashboard size={20} />
              </span>
              <h2 className="mt-6 text-base font-semibold">{dashboard.name}</h2>
              <p className="mt-2 min-h-10 text-sm leading-5 text-slate-500 dark:text-slate-400">
                {dashboard.description || 'A visual canvas ready for your system.'}
              </p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-violet-600 dark:text-violet-300">
                Open canvas{' '}
                <ArrowRight size={15} className="transition group-hover:translate-x-1" />
              </span>
            </button>
          ))}
          {dashboards.data.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-violet-300 bg-violet-50/60 p-12 text-center dark:border-violet-500/30 dark:bg-violet-500/5">
              <h2 className="text-lg font-semibold">Create the first canvas</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                A dashboard gives your workspace a visual system for shared thinking and operations.
              </p>
              <button
                onClick={() => setDialogOpen(true)}
                className="mt-5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                New dashboard
              </button>
            </div>
          )}
        </div>
      )}
      {dashboards.isError && (
        <div className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
          Dashboards could not be loaded.{' '}
          <button onClick={() => void dashboards.refetch()} className="font-semibold underline">
            Try again
          </button>
        </div>
      )}
      {dialogOpen && (
        <DashboardDialog
          pending={create.isPending}
          error={create.error?.message}
          onClose={() => setDialogOpen(false)}
          onSubmit={(values) => create.mutate(values)}
        />
      )}
    </section>
  );
}
function DashboardDialog({
  pending,
  error,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  error?: string | undefined;
  onClose: () => void;
  onSubmit: (values: DashboardForm) => void;
}) {
  const form = useForm<DashboardForm>({
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
            <h2 className="text-lg font-semibold">Create dashboard</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Begin with a blank Voxel canvas.
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
            placeholder="Quarterly planning"
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
            placeholder="What will this canvas help the team do?"
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
            {pending ? 'Creating…' : 'Create dashboard'}
          </button>
        </div>
      </form>
    </div>
  );
}
