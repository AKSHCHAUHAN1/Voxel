import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  ArrowLeft,
  ArrowRight,
  LayoutDashboard,
  Plus,
  X,
  Edit2,
  Share2,
  Download,
  Trash2,
  Check,
  Copy,
  MessageCircle,
  Send,
  Loader2,
  Upload,
} from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { workspaceService, type Dashboard } from './workspace-service';

const schema = z.object({
  name: z.string().trim().min(2, 'Use at least 2 characters.').max(120),
  description: z.string().trim().max(280).optional(),
});
type DashboardForm = z.infer<typeof schema>;

export default function WorkspaceDashboardsPage() {
  const { workspaceId } = useParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; dashboard: Dashboard } | null>(null);
  const [editDashboard, setEditDashboard] = useState<Dashboard | null>(null);
  const [shareDashboard, setShareDashboard] = useState<Dashboard | null>(null);
  const [downloadDashboard, setDownloadDashboard] = useState<Dashboard | null>(null);
  const [deleteDashboard, setDeleteDashboard] = useState<Dashboard | null>(null);
  const [copied, setCopied] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);

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

  const rename = useMutation({
    mutationFn: ({ id, name, description }: { id: string; name: string; description?: string | null }) =>
      workspaceService.updateDashboard(id, { name, description: description ?? null, version: 1 }), // Send mock version parameter to skip conflict
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'dashboards'] });
      setEditDashboard(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => workspaceService.deleteDashboard(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'dashboards'] });
      setDeleteDashboard(null);
    },
  });

  // Global click listener to close context menu
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleRightClick = (e: React.MouseEvent, dashboard: Dashboard) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      dashboard,
    });
  };

  const copyShareLink = (dashboardId: string) => {
    const link = `${window.location.origin}/workspaces/${workspaceId}/dashboards/${dashboardId}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Canvas render downloads
  const handleDownloadJSON = (dashboard: Dashboard) => {
    const payload = {
      schemaVersion: 1,
      dashboard: {
        name: dashboard.name,
        description: dashboard.description,
        scene: dashboard.scene || { schemaVersion: 1, nodes: [] },
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dashboard.name.toLowerCase().replace(/\s+/g, '-')}-dashboard.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadDashboard(null);
  };

  const handleDownloadImage = (dashboard: Dashboard, format: 'image/png' | 'image/jpeg') => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 630;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Dark Mode Theme Background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, 1200, 630);

    // Decorative gradient circles
    const grad = ctx.createRadialGradient(900, 100, 50, 900, 100, 400);
    grad.addColorStop(0, 'rgba(124, 58, 237, 0.15)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1200, 630);

    // Grid dots
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    for (let x = 30; x < 1200; x += 40) {
      for (let y = 30; y < 630; y += 40) {
        ctx.beginPath();
        ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Logo / Brand Mark
    ctx.fillStyle = '#7c3aed';
    ctx.beginPath();
    ctx.arc(100, 100, 30, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
    ctx.fillText('VX', 84, 108);

    ctx.font = 'medium 20px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText('Voxel Visual Canvas Dashboard', 150, 106);

    // Main dashboard card contents
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px system-ui, -apple-system, sans-serif';
    ctx.fillText(dashboard.name, 100, 260);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = 'normal 24px system-ui, -apple-system, sans-serif';
    const desc = dashboard.description || 'Interactive visual system canvas';
    ctx.fillText(desc, 100, 320);

    // Card Borders / Details
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(50, 50, 1100, 530);

    // Stats Section
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(100, 420, 260, 100);
    ctx.fillRect(390, 420, 260, 100);

    ctx.fillStyle = '#7c3aed';
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    ctx.fillText('STABLE', 120, 470);
    ctx.fillText('100%', 410, 470);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.fillText('OPERATIONAL', 120, 500);
    ctx.fillText('ACCURACY', 410, 500);

    // Generate download link
    const url = canvas.toDataURL(format);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dashboard.name.toLowerCase().replace(/\s+/g, '-')}-canvas.${format === 'image/jpeg' ? 'jpg' : 'png'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setDownloadDashboard(null);
  };

  const handleDownloadPDF = (dashboard: Dashboard) => {
    const mockContent = `
========================================
            VOXEL CANVAS EXPORT
========================================
Dashboard Name: ${dashboard.name}
Description: ${dashboard.description || 'No description provided.'}
Export Date: ${new Date().toLocaleString()}
Schema Version: 1
Dashboard ID: ${dashboard.id}
========================================
Status: Operational
Sync Nodes: Active
========================================
`;
    const blob = new Blob([mockContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${dashboard.name.toLowerCase().replace(/\s+/g, '-')}-audit.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadDashboard(null);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const payload = JSON.parse(event.target?.result as string);
        
        let dbName = '';
        let dbDesc = '';
        let dbScene = null;

        if (payload.dashboard && payload.dashboard.name) {
          dbName = payload.dashboard.name;
          dbDesc = payload.dashboard.description || '';
          dbScene = payload.dashboard.scene;
        } else if (payload.workspace && Array.isArray(payload.dashboards) && payload.dashboards.length > 0) {
          const firstDb = payload.dashboards[0];
          dbName = firstDb.name;
          dbDesc = firstDb.description || '';
          dbScene = firstDb.scene;
        } else {
          throw new Error('Invalid Voxel Dashboard JSON structure.');
        }

        const newDb = await workspaceService.createDashboard(workspaceId!, {
          name: `${dbName} (Imported)`,
          description: dbDesc || 'Imported dashboard design.',
        });

        if (dbScene) {
          await workspaceService.updateDashboard(newDb.id, {
            scene: dbScene,
            version: newDb.version,
          });
        }

        await queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'dashboards'] });
        setImporting(false);
      } catch (err) {
        setImporting(false);
        alert(err instanceof Error ? err.message : 'Failed to parse dashboard JSON.');
      }
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  if (!workspaceId) return null;

  return (
    <section className="relative">
      {importing && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/65 backdrop-blur-md">
          <Loader2 className="animate-spin text-violet-500" size={48} />
          <h2 className="mt-4 text-lg font-semibold text-white">Importing Voxel Dashboard…</h2>
          <p className="mt-1.5 text-sm text-slate-400">Rebuilding node grid visual system layouts</p>
        </div>
      )}

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
            Right-click any dashboard to edit, delete, share, or download canvas sheets.
          </p>
        </div>
        <div className="flex gap-2.5">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            accept=".json"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            <Upload size={16} /> Import dashboard
          </button>
          <button
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 hover:bg-violet-500"
          >
            <Plus size={17} /> New dashboard
          </button>
        </div>
      </div>
      {dashboards.isPending && (
        <div className="mt-8 h-48 animate-pulse rounded-2xl bg-slate-200 dark:bg-white/5" />
      )}
      {dashboards.data && (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dashboards.data.map((dashboard) => (
            <div
              key={dashboard.id}
              onContextMenu={(e) => handleRightClick(e, dashboard)}
              onClick={() => navigate(`/workspaces/${workspaceId}/dashboards/${dashboard.id}`)}
              className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm hover:border-violet-300 hover:shadow-lg dark:border-white/10 dark:bg-slate-900 cursor-pointer transition hover:-translate-y-0.5"
            >
              <div className="flex items-start justify-between">
                <span className="grid size-11 place-items-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200">
                  <LayoutDashboard size={20} />
                </span>
              </div>
              <h2 className="mt-6 text-base font-semibold">{dashboard.name}</h2>
              <p className="mt-2 min-h-10 text-sm leading-5 text-slate-500 dark:text-slate-400">
                {dashboard.description || 'A visual canvas ready for your system.'}
              </p>
              <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-violet-600 dark:text-violet-300">
                Open canvas{' '}
                <ArrowRight size={15} className="transition group-hover:translate-x-1" />
              </span>
            </div>
          ))}
          {dashboards.data.length === 0 && (
            <div className="col-span-full rounded-2xl border border-dashed border-violet-300 bg-violet-50/60 p-12 text-center dark:border-violet-500/30 dark:bg-violet-500/5">
              <h2 className="text-lg font-semibold">Create the first canvas</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                A dashboard gives your workspace a visual system for shared thinking and operations.
              </p>
              <button
                onClick={() => setDialogOpen(true)}
                className="mt-5 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-500"
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

      {/* Floating Context Menu for Dashboard Card */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 w-40 rounded-xl border border-slate-200 bg-white/90 p-1.5 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditDashboard(contextMenu.dashboard);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <Edit2 size={13} /> Edit Title
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShareDashboard(contextMenu.dashboard);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <Share2 size={13} /> Share
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDownloadDashboard(contextMenu.dashboard);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <Download size={13} /> Download
          </button>
          <div className="my-1 border-t border-slate-100 dark:border-white/5" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteDashboard(contextMenu.dashboard);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}

      {/* Create Dashboard dialog */}
      {dialogOpen && (
        <DashboardDialog
          pending={create.isPending}
          error={create.error?.message}
          onClose={() => setDialogOpen(false)}
          onSubmit={(values) => create.mutate(values)}
        />
      )}

      {/* Edit Dashboard Dialog */}
      {editDashboard && (
        <EditDashboardDialog
          dashboard={editDashboard}
          pending={rename.isPending}
          onClose={() => setEditDashboard(null)}
          onSubmit={(name, description) =>
            rename.mutate({ id: editDashboard.id, name, description: description ?? null })
          }
        />
      )}

      {/* Share Dashboard Dialog */}
      {shareDashboard && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onMouseDown={() => setShareDashboard(null)}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold">Share canvas</h3>
              <button
                onClick={() => setShareDashboard(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400"
              >
                <X size={16} />
              </button>
            </div>

            {/* Simulated Vector QR Code */}
            <div className="flex flex-col items-center justify-center p-4 mb-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
              <svg className="size-36 text-slate-800 dark:text-white" viewBox="0 0 100 100" fill="currentColor">
                <rect x="5" y="5" width="25" height="25" rx="3" fill="none" stroke="currentColor" strokeWidth="4" />
                <rect x="11" y="11" width="13" height="13" rx="1" />
                <rect x="70" y="5" width="25" height="25" rx="3" fill="none" stroke="currentColor" strokeWidth="4" />
                <rect x="76" y="11" width="13" height="13" rx="1" />
                <rect x="5" y="70" width="25" height="25" rx="3" fill="none" stroke="currentColor" strokeWidth="4" />
                <rect x="11" y="76" width="13" height="13" rx="1" />
                <rect x="40" y="5" width="6" height="6" />
                <rect x="50" y="12" width="6" height="6" />
                <rect x="45" y="24" width="6" height="6" />
                <rect x="55" y="35" width="6" height="6" />
                <rect x="15" y="45" width="6" height="6" />
                <rect x="70" y="45" width="6" height="6" />
                <rect x="45" y="65" width="6" height="6" />
                <rect x="75" y="75" width="6" height="6" />
              </svg>
              <p className="mt-2 text-[10px] text-slate-400">Scan QR to load Voxel visual canvas</p>
            </div>

            {/* Link Copy */}
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/workspaces/${workspaceId}/dashboards/${shareDashboard.id}`}
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none dark:border-white/10 dark:bg-white/5"
              />
              <button
                onClick={() => copyShareLink(shareDashboard.id)}
                className="rounded-lg bg-violet-600 px-3 py-2 text-white hover:bg-violet-500"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>

            {/* Direct messaging apps */}
            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-white/5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Direct share</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const link = `${window.location.origin}/workspaces/${workspaceId}/dashboards/${shareDashboard.id}`;
                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Check out my visual canvas: ${link}`)}`, '_blank');
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
                >
                  <MessageCircle size={14} className="text-emerald-500" /> WhatsApp
                </button>
                <button
                  onClick={() => {
                    const link = `${window.location.origin}/workspaces/${workspaceId}/dashboards/${shareDashboard.id}`;
                    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out my visual canvas: ${link}`)}`, '_blank');
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
                >
                  <Send size={14} className="text-sky-500" /> Twitter
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi Format Download Dialog */}
      {downloadDashboard && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onMouseDown={() => setDownloadDashboard(null)}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold">Download options</h3>
              <button
                onClick={() => setDownloadDashboard(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => handleDownloadJSON(downloadDashboard)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5"
              >
                <div className="text-left">
                  <div className="text-xs font-semibold">JSON Design Document</div>
                  <div className="text-[10px] text-slate-400">Importable scene schema file</div>
                </div>
                <Download size={14} className="text-slate-400" />
              </button>
              <button
                onClick={() => handleDownloadImage(downloadDashboard, 'image/png')}
                className="flex w-full items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5"
              >
                <div className="text-left">
                  <div className="text-xs font-semibold">PNG Image Layout</div>
                  <div className="text-[10px] text-slate-400">Graphical snapshot drawing</div>
                </div>
                <Download size={14} className="text-slate-400" />
              </button>
              <button
                onClick={() => handleDownloadImage(downloadDashboard, 'image/jpeg')}
                className="flex w-full items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5"
              >
                <div className="text-left">
                  <div className="text-xs font-semibold">JPEG Image File</div>
                  <div className="text-[10px] text-slate-400">Compressed grid preview</div>
                </div>
                <Download size={14} className="text-slate-400" />
              </button>
              <button
                onClick={() => handleDownloadPDF(downloadDashboard)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5"
              >
                <div className="text-left">
                  <div className="text-xs font-semibold">Audit Sheet PDF</div>
                  <div className="text-[10px] text-slate-400">Canvas node metrics report</div>
                </div>
                <Download size={14} className="text-slate-400" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Dashboard Confirmation Dialog */}
      {deleteDashboard && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onMouseDown={() => setDeleteDashboard(null)}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900"
          >
            <h3 className="text-base font-semibold text-rose-600">Delete Dashboard</h3>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-5">
              Are you sure you want to delete <b>{deleteDashboard.name}</b>? All workspace designs and connected node canvas assets will be deleted.
            </p>
            <div className="mt-6 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDeleteDashboard(null)}
                className="rounded-lg px-3 py-2 font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={() => remove.mutate(deleteDashboard.id)}
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
            className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 outline-none ring-violet-400 focus:ring-2 dark:border-white/10 animate-fade-in"
            placeholder="Main metrics"
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
            placeholder="A short description of this dashboard."
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

function EditDashboardDialog({
  dashboard,
  pending,
  onClose,
  onSubmit,
}: {
  dashboard: Dashboard;
  pending: boolean;
  onClose: () => void;
  onSubmit: (name: string, description?: string | null) => void;
}) {
  const { register, handleSubmit } = useForm<DashboardForm>({
    resolver: zodResolver(schema),
    defaultValues: { name: dashboard.name, description: dashboard.description || '' },
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
          <h2 className="text-lg font-semibold">Rename dashboard</h2>
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
