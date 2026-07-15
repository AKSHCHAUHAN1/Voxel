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
  Share2,
  Download,
  Trash2,
  Copy,
  Check,
  Upload,
  Loader2,
  Mail,
  Send,
  MessageCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { workspaceService, type Workspace } from './workspace-service';

const schema = z.object({
  name: z.string().trim().min(2, 'Use at least 2 characters.').max(80),
  description: z.string().trim().max(280).optional(),
});
type WorkspaceForm = z.infer<typeof schema>;

export default function WorkspacesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; workspace: Workspace } | null>(null);
  const [editWorkspace, setEditWorkspace] = useState<Workspace | null>(null);
  const [shareWorkspace, setShareWorkspace] = useState<Workspace | null>(null);
  const [downloadWorkspace, setDownloadWorkspace] = useState<Workspace | null>(null);
  const [deleteWorkspace, setDeleteWorkspace] = useState<Workspace | null>(null);
  const [importing, setImporting] = useState(false);
  const [copied, setCopied] = useState(false);

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    mutationFn: ({ id, name, description }: { id: string; name: string; description?: string | null }) =>
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

  const handleRightClick = (e: React.MouseEvent, workspace: Workspace) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      workspace,
    });
  };

  // 1. Download Workspace Data as JSON
  const handleDownloadJSON = async (workspace: Workspace) => {
    try {
      const dashboards = await workspaceService.dashboards(workspace.id);
      const payload = {
        schemaVersion: 1,
        workspace: {
          name: workspace.name,
          description: workspace.description,
        },
        dashboards: dashboards.map((d) => ({
          name: d.name,
          description: d.description,
          scene: d.scene,
        })),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workspace.name.toLowerCase().replace(/\s+/g, '-')}-workspace.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadWorkspace(null);
    } catch (err) {
      console.error('Failed to download workspace:', err);
    }
  };

  // 2. Download Workspace Canvas Summary as PNG/JPEG
  const handleDownloadImage = (workspace: Workspace, format: 'image/png' | 'image/jpeg') => {
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
    ctx.fillText('Voxel visual systems platform', 150, 106);

    // Main workspace card contents
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 54px system-ui, -apple-system, sans-serif';
    ctx.fillText(workspace.name, 100, 260);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = 'normal 24px system-ui, -apple-system, sans-serif';
    const desc = workspace.description || 'A focused visual operating system workspace.';
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
    ctx.fillText('ACTIVE', 120, 470);
    ctx.fillText('100%', 410, 470);

    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
    ctx.fillText('STATUS', 120, 500);
    ctx.fillText('ENCRYPTED', 410, 500);

    // Generate downlaod link
    const url = canvas.toDataURL(format);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workspace.name.toLowerCase().replace(/\s+/g, '-')}-overview.${format === 'image/jpeg' ? 'jpg' : 'png'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setDownloadWorkspace(null);
  };

  // 3. Download Simulated PDF
  const handleDownloadPDF = (workspace: Workspace) => {
    const mockContent = `
========================================
           VOXEL WORKSPACE EXPORT
========================================
Workspace: ${workspace.name}
Description: ${workspace.description || 'N/A'}
Role: ${workspace.role}
Exported At: ${new Date().toLocaleString()}
Encryption: End-to-End Visual Sandbox Encrypted

Generated using Voxel visual systems.
    `;
    const blob = new Blob([mockContent.trim()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workspace.name.toLowerCase().replace(/\s+/g, '-')}-workspace.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setDownloadWorkspace(null);
  };

  // 4. Import Workspace Parser Logic
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        const payload = JSON.parse(event.target?.result as string);
        if (!payload.workspace || !payload.workspace.name) {
          throw new Error('Invalid Voxel workspace JSON structure.');
        }

        // Create the imported workspace card
        const newWs = await workspaceService.create({
          name: `${payload.workspace.name} (Imported)`,
          description: payload.workspace.description || 'Imported voxel workspace design.',
        });

        // sequentially import each dashboard scene configuration
        if (payload.dashboards && Array.isArray(payload.dashboards)) {
          for (const db of payload.dashboards) {
            const newDb = await workspaceService.createDashboard(newWs.id, {
              name: db.name,
              description: db.description || '',
            });
            if (db.scene) {
              await workspaceService.updateDashboard(newDb.id, {
                scene: db.scene,
                version: newDb.version,
              });
            }
          }
        }

        await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
        setImporting(false);
        navigate(`/workspaces/${newWs.id}/dashboards`);
      } catch (err) {
        setImporting(false);
        alert(err instanceof Error ? err.message : 'Failed to parse workspace JSON.');
      }
    };

    reader.readAsText(file);
    e.target.value = ''; // clear input
  };

  const copyShareLink = (workspaceId: string) => {
    const url = `${window.location.origin}/workspaces/${workspaceId}/dashboards`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative">
      {importing && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/65 backdrop-blur-md">
          <Loader2 className="animate-spin text-violet-500" size={48} />
          <h2 className="mt-4 text-lg font-semibold text-white">Importing Voxel Workspace…</h2>
          <p className="mt-1.5 text-sm text-slate-400">Rebuilding node grid visual system layouts</p>
        </div>
      )}

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
            <Upload size={16} /> Import
          </button>
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

      {/* Floating Context Menu - "Workspace" word removed */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 w-40 rounded-xl border border-slate-200 bg-white/90 p-1.5 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90"
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
          <button
            onClick={() => {
              setShareWorkspace(contextMenu.workspace);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <Share2 size={13} /> Share
          </button>
          <button
            onClick={() => {
              setDownloadWorkspace(contextMenu.workspace);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <Download size={13} /> Download
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

      {/* Advanced Share Modal (QR, App Share, Link Copy) */}
      {shareWorkspace && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onMouseDown={() => setShareWorkspace(null)}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold">Share design</h3>
              <button
                onClick={() => setShareWorkspace(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400"
              >
                <X size={16} />
              </button>
            </div>

            {/* Mock Vector QR Code */}
            <div className="flex flex-col items-center justify-center p-4 mb-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
              <svg className="size-36 text-slate-800 dark:text-white" viewBox="0 0 100 100" fill="currentColor">
                {/* QR Finder patterns top-left */}
                <rect x="5" y="5" width="25" height="25" rx="3" fill="none" stroke="currentColor" strokeWidth="4" />
                <rect x="11" y="11" width="13" height="13" rx="1" />
                {/* Finder pattern top-right */}
                <rect x="70" y="5" width="25" height="25" rx="3" fill="none" stroke="currentColor" strokeWidth="4" />
                <rect x="76" y="11" width="13" height="13" rx="1" />
                {/* Finder pattern bottom-left */}
                <rect x="5" y="70" width="25" height="25" rx="3" fill="none" stroke="currentColor" strokeWidth="4" />
                <rect x="11" y="76" width="13" height="13" rx="1" />
                {/* Mock data pixels */}
                <rect x="40" y="5" width="6" height="6" />
                <rect x="50" y="12" width="6" height="6" />
                <rect x="45" y="24" width="6" height="6" />
                <rect x="55" y="35" width="6" height="6" />
                <rect x="15" y="45" width="6" height="6" />
                <rect x="25" y="55" width="6" height="6" />
                <rect x="70" y="45" width="6" height="6" />
                <rect x="80" y="55" width="6" height="6" />
                <rect x="45" y="65" width="6" height="6" />
                <rect x="75" y="75" width="6" height="6" />
                <rect x="90" y="85" width="6" height="6" />
                <rect x="50" y="85" width="6" height="6" />
                <rect x="85" y="40" width="6" height="6" />
              </svg>
              <p className="mt-2 text-[10px] text-slate-400">Scan QR to open canvas dashboard</p>
            </div>

            {/* Direct Copy Input */}
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/workspaces/${shareWorkspace.id}/dashboards`}
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none dark:border-white/10 dark:bg-white/5"
              />
              <button
                onClick={() => copyShareLink(shareWorkspace.id)}
                className="rounded-lg bg-violet-600 px-3 py-2 text-white hover:bg-violet-500"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>

            {/* App Share links */}
            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-white/5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Share directly to apps</p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const link = `${window.location.origin}/workspaces/${shareWorkspace.id}/dashboards`;
                    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`Check out my visual workspace on Voxel: ${link}`)}`, '_blank');
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
                >
                  <MessageCircle size={14} className="text-emerald-500" /> WhatsApp
                </button>
                <button
                  onClick={() => {
                    const link = `${window.location.origin}/workspaces/${shareWorkspace.id}/dashboards`;
                    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(`Check out my visual workspace on Voxel: ${link}`)}`, '_blank');
                  }}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-semibold hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
                >
                  <Send size={14} className="text-sky-500" /> Twitter
                </button>
                <button
                  onClick={() => {
                    const link = `${window.location.origin}/workspaces/${shareWorkspace.id}/dashboards`;
                    window.open(`mailto:?subject=Voxel Workspace Share&body=${encodeURIComponent(`Check out my visual workspace on Voxel: ${link}`)}`, '_blank');
                  }}
                  className="grid place-items-center size-9 rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-white/10 dark:hover:bg-white/5"
                >
                  <Mail size={14} className="text-slate-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Format Download Options Modal */}
      {downloadWorkspace && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onMouseDown={() => setDownloadWorkspace(null)}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-slate-900"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold">Download options</h3>
              <button
                onClick={() => setDownloadWorkspace(null)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Select your preferred export layout format.
            </p>
            <div className="space-y-2">
              <button
                onClick={() => handleDownloadJSON(downloadWorkspace)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5"
              >
                <div className="text-left">
                  <div className="text-xs font-semibold">JSON Design Document</div>
                  <div className="text-[10px] text-slate-400">Importable schema backup file</div>
                </div>
                <Download size={14} className="text-slate-400" />
              </button>
              <button
                onClick={() => handleDownloadImage(downloadWorkspace, 'image/png')}
                className="flex w-full items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5"
              >
                <div className="text-left">
                  <div className="text-xs font-semibold">PNG Image File</div>
                  <div className="text-[10px] text-slate-400">High-resolution graphical preview</div>
                </div>
                <Download size={14} className="text-slate-400" />
              </button>
              <button
                onClick={() => handleDownloadImage(downloadWorkspace, 'image/jpeg')}
                className="flex w-full items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5"
              >
                <div className="text-left">
                  <div className="text-xs font-semibold">JPEG Graphic Sheet</div>
                  <div className="text-[10px] text-slate-400">Standard compressed size web graphic</div>
                </div>
                <Download size={14} className="text-slate-400" />
              </button>
              <button
                onClick={() => handleDownloadPDF(downloadWorkspace)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5"
              >
                <div className="text-left">
                  <div className="text-xs font-semibold">PDF Document</div>
                  <div className="text-[10px] text-slate-400">Audit sheet metadata layout</div>
                </div>
                <Download size={14} className="text-slate-400" />
              </button>
            </div>
          </div>
        </div>
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
              Are you sure you want to delete <b>{deleteWorkspace.name}</b>? All dashboard designs and connected node canvas assets will be soft-deleted. This action can be undone by system administrators.
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

function WorkspaceCard({
  workspace,
  onOpen,
  onContextMenu,
}: {
  workspace: Workspace;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
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

function EditWorkspaceDialog({
  workspace,
  pending,
  onClose,
  onSubmit,
}: {
  workspace: Workspace;
  pending: boolean;
  onClose: () => void;
  onSubmit: (name: string, description?: string | null) => void;
}) {
  const { register, handleSubmit } = useForm<WorkspaceForm>({
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

function EmptyState({ onCreate }: { onCreate: () => void }) {
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

function ErrorState({ onRetry }: { onRetry: () => void }) {
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

function WorkspaceDialog({
  pending,
  error,
  onClose,
  onSubmit,
}: {
  pending: boolean;
  error?: string | undefined;
  onClose: () => void;
  onSubmit: (values: WorkspaceForm) => void;
}) {
  const form = useForm<WorkspaceForm>({
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
