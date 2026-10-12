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
  Loader2,
  Upload,
  Archive,
  RotateCcw,
  Star,
  Pin,
  MoreHorizontal,
  Search,
  Bookmark,
  FileText,
  HardDrive,
  Image as ImageIcon,
} from 'lucide-react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { workspaceService } from './workspace-service';
import QRCode from 'qrcode';

const schema = z.object({
  name: z.string().trim().min(2, 'Use at least 2 characters.').max(120),
  description: z.string().trim().max(280).optional(),
});

const cardExportColors = {
  slate: '#ffffff', violet: '#eef2ff', emerald: '#ecfdf5', rose: '#fff1f2',
  amber: '#fffbeb', indigo: '#eef2ff', cyan: '#ecfeff',
};

function sceneNodeSize(node) {
  const widthBySize = { small: 220, medium: 280, large: 340, wide: 440 };
  const heightByType = { image: 240, chart: 220, table: 260, code: 220 };
  return {
    width: Math.max(180, Math.min(1200, Number(node.customWidth) || widthBySize[node.size] || 280)),
    height: Math.max(120, Math.min(1200, Number(node.customHeight) || heightByType[node.type] || 180)),
  };
}

function drawWrappedText(ctx, value, x, y, maxWidth, lineHeight, maxLines = 4) {
  const words = String(value ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines && visible.length) visible[visible.length - 1] += '…';
  visible.forEach((text, index) => ctx.fillText(text, x, y + index * lineHeight, maxWidth));
}

function createDashboardSnapshot(dashboard, format) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas export is unavailable in this browser.');
  const nodes = Array.isArray(dashboard.scene?.nodes) ? dashboard.scene.nodes : [];
  const dimensions = nodes.map((node) => ({ node, ...sceneNodeSize(node) }));
  const minLeft = Math.min(0, ...dimensions.map(({ node }) => Number(node.x) || 0));
  const minTop = Math.min(0, ...dimensions.map(({ node }) => Number(node.y) || 0));
  const maxRight = Math.max(1080, ...dimensions.map(({ node, width }) => (Number(node.x) || 0) + width));
  const maxBottom = Math.max(520, ...dimensions.map(({ node, height }) => (Number(node.y) || 0) + height));
  const boardWidth = Math.max(1080, maxRight - minLeft + 80);
  const boardHeight = Math.max(520, maxBottom - minTop + 80);
  const scale = Math.min(1, 2500 / boardWidth, 1500 / boardHeight);
  const margin = 64;
  const headerHeight = 150;
  canvas.width = Math.max(1000, Math.ceil(boardWidth * scale + margin * 2));
  canvas.height = Math.max(700, Math.ceil(boardHeight * scale + headerHeight + margin));

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#7c3aed';
  ctx.font = '700 13px system-ui, sans-serif';
  ctx.fillText('VOXEL · DASHBOARD', margin, 42);
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 30px system-ui, sans-serif';
  ctx.fillText(String(dashboard.name || 'Untitled dashboard').slice(0, 80), margin, 84, canvas.width - margin * 2);
  ctx.fillStyle = '#64748b';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText(String(dashboard.description || `${nodes.length} widgets`).slice(0, 180), margin, 112, canvas.width - margin * 2);

  const originX = margin - minLeft * scale;
  const originY = headerHeight - minTop * scale;
  const centerFor = (node) => {
    const { width, height } = sceneNodeSize(node);
    return { x: originX + ((Number(node.x) || 0) + width / 2) * scale, y: originY + ((Number(node.y) || 0) + height / 2) * scale };
  };
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  (dashboard.scene?.connections || []).forEach((connection) => {
    const from = nodes.find((node) => node.id === connection.fromId);
    const to = nodes.find((node) => node.id === connection.toId);
    if (!from || !to) return;
    const start = centerFor(from);
    const end = centerFor(to);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  });

  dimensions.forEach(({ node, width, height }) => {
    const x = originX + (Number(node.x) || 0) * scale;
    const y = originY + (Number(node.y) || 0) * scale;
    const w = width * scale;
    const h = height * scale;
    const radius = Math.min(16, 16 * scale);
    ctx.fillStyle = cardExportColors[node.color] || '#ffffff';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, radius);
    else ctx.rect(x, y, w, h);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#64748b';
    ctx.font = `700 ${Math.max(10, 11 * scale)}px system-ui, sans-serif`;
    ctx.fillText(String(node.type || 'widget').toUpperCase(), x + 16 * scale, y + 24 * scale, w - 32 * scale);
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 ${Math.max(12, 15 * scale)}px system-ui, sans-serif`;
    ctx.fillText(String(node.title || 'Untitled widget').slice(0, 80), x + 16 * scale, y + 52 * scale, w - 32 * scale);
    const value = node.content ?? node.description ?? node.code ?? node.rows ?? node.url ?? '';
    ctx.fillStyle = '#475569';
    ctx.font = `${Math.max(10, 12 * scale)}px system-ui, sans-serif`;
    drawWrappedText(ctx, value, x + 16 * scale, y + 78 * scale, w - 32 * scale, Math.max(14, 17 * scale), 4);
  });

  return canvas.toDataURL(format, format === 'image/jpeg' ? 0.92 : undefined);
}

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));

import { useNotificationStore } from '@/store/notification-store';

export default function WorkspaceDashboardsPage() {
  const addNotification = useNotificationStore((s) => s.add);
  const { workspaceId } = useParams();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('recent');
  const [contextMenu, setContextMenu] = useState(null);
  const [editDashboard, setEditDashboard] = useState(null);
  const [shareDashboard, setShareDashboard] = useState(null);
  const [downloadDashboard, setDownloadDashboard] = useState(null);
  const [deleteDashboard, setDeleteDashboard] = useState(null);
  const [templateDashboard, setTemplateDashboard] = useState(null);
  const [moveDashboard, setMoveDashboard] = useState(null);
  const [copied, setCopied] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [sharePermission, setSharePermission] = useState('VIEW');
  const [shareExpiry, setShareExpiry] = useState(30);
  const [importing, setImporting] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const fileInputRef = useRef(null);
  const storageFileInputRef = useRef(null);
  const coverInputRef = useRef(null);

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef(null);

  useEffect(() => {
    const state = location.state;
    if (!state?.openCreateDashboard && !state?.showTemplates) return;
    if (state.openCreateDashboard) {
      setShowDeleted(false);
      setShowTemplates(false);
      setDialogOpen(true);
    }
    if (state.showTemplates) {
      setShowDeleted(false);
      setShowTemplates(true);
    }
    navigate(location.pathname, { replace: true, state: null });
  }, [location.key, location.pathname, location.state, navigate]);

  const dashboards = useQuery({
    queryKey: ['workspaces', workspaceId, 'dashboards', showDeleted],
    queryFn: () => workspaceService.dashboards(workspaceId, { includeDeleted: showDeleted }),
    enabled: Boolean(workspaceId),
  });
  const templates = useQuery({
    queryKey: ['workspaces', workspaceId, 'templates'],
    queryFn: () => workspaceService.templates(workspaceId),
    enabled: Boolean(workspaceId),
  });
  const workspaceList = useQuery({ queryKey: ['workspaces'], queryFn: workspaceService.list });
  const workspaceRole = workspaceList.data?.find((workspace) => workspace.id === workspaceId)?.role;
  const activeWorkspace = workspaceList.data?.find((workspace) => workspace.id === workspaceId);
  const canEditWorkspace = ['OWNER', 'ADMIN', 'EDITOR'].includes(workspaceRole);
  const canManageWorkspace = ['OWNER', 'ADMIN'].includes(workspaceRole);
  const canPublishTemplate = ['OWNER', 'ADMIN'].includes(workspaceRole);
  const activity = useQuery({
    queryKey: ['workspaces', workspaceId, 'activity'],
    queryFn: () => workspaceService.activity(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 30_000,
  });
  const recentComments = useQuery({
    queryKey: ['workspaces', workspaceId, 'comments'],
    queryFn: () => workspaceService.workspaceComments(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 15_000,
  });
  const workspaceFiles = useQuery({
    queryKey: ['workspaces', workspaceId, 'files'],
    queryFn: () => workspaceService.files(workspaceId),
    enabled: Boolean(workspaceId) && !showDeleted && !showTemplates,
  });
  const uploadWorkspaceFile = useMutation({
    mutationFn: (file) => workspaceService.uploadFile(workspaceId, file),
    onSuccess: async (file) => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'files'] });
      addNotification(`Uploaded “${file.name}”.`, 'success');
    },
    onError: (error) => addNotification(error.message || 'File could not be uploaded.', 'warning'),
  });
  const deleteWorkspaceFile = useMutation({
    mutationFn: (fileId) => workspaceService.deleteFile(workspaceId, fileId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'files'] });
      addNotification('File deleted and workspace storage released.', 'success');
    },
    onError: (error) => addNotification(error.message || 'File could not be deleted.', 'warning'),
  });
  const uploadCoverImage = useMutation({
    mutationFn: (file) => workspaceService.uploadCoverImage(workspaceId, file),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
        queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'files'] }),
      ]);
      addNotification('Workspace cover updated.', 'success');
    },
    onError: (error) => addNotification(error.message || 'Workspace cover could not be uploaded.', 'warning'),
  });
  const visibleDashboards = [...(dashboards.data || [])]
    .filter((dashboard) => `${dashboard.name} ${dashboard.description || ''}`.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    .filter((dashboard) => showDeleted || statusFilter === 'ALL' || (statusFilter === 'FAVORITES' ? dashboard.isFavorite : dashboard.status === statusFilter))
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
      return Number(b.isPinned) - Number(a.isPinned) || Number(b.isFavorite) - Number(a.isFavorite) || new Date(b.updatedAt) - new Date(a.updatedAt);
    });
  const visibleTemplates = [...(templates.data || [])]
    .filter((template) => `${template.name} ${template.description || ''} ${template.category} ${(template.tags || []).join(' ')}`.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    .sort((a, b) => sortBy === 'name'
      ? a.name.localeCompare(b.name)
      : sortBy === 'oldest'
        ? new Date(a.createdAt) - new Date(b.createdAt)
        : Number(b.isFavorite) - Number(a.isFavorite) || new Date(b.updatedAt) - new Date(a.updatedAt));

  const create = useMutation({
    mutationFn: (input) => workspaceService.createDashboard(workspaceId, input),
    onSuccess: async (dashboard) => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'dashboards'] });
      addNotification(`Created dashboard "${dashboard.name}"`, 'success');
      navigate(`/workspaces/${workspaceId}/dashboards/${dashboard.id}`);
    },
  });

  const rename = useMutation({
    mutationFn: ({ id, name, description, version }) =>
      workspaceService.updateDashboard(id, { name, description: description ?? null, version }),
    onSuccess: async (_res, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'dashboards'] });
      addNotification(`Updated dashboard "${variables.name}"`, 'info');
      setEditDashboard(null);
    },
  });

  const remove = useMutation({
    mutationFn: (id) => workspaceService.deleteDashboard(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'dashboards'] });
      addNotification('Dashboard moved to Trash. You can restore it for 30 days; public share links were revoked.', 'warning');
      setDeleteDashboard(null);
    },
    onError: (error) => {
      console.error('Failed to delete dashboard:', error);
      addNotification(error.message || 'Failed to delete dashboard', 'warning');
      setDeleteDashboard(null);
    }
  });

  const recoverDashboard = useMutation({
    mutationFn: workspaceService.recoverDashboard,
    onSuccess: async (dashboard) => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'dashboards'] });
      addNotification(`Restored “${dashboard.name}”. Its old share links stay revoked.`, 'success');
      setContextMenu(null);
    },
    onError: (error) => addNotification(error.message || 'Dashboard could not be restored from trash.', 'warning'),
  });

  const saveTemplate = useMutation({
    mutationFn: (input) => workspaceService.createTemplate(workspaceId, { ...input, dashboardId: templateDashboard.id }),
    onSuccess: async (template) => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'templates'] });
      addNotification(`Saved “${template.name}” to the template library.`, 'success');
      setTemplateDashboard(null);
    },
    onError: (error) => addNotification(error.message || 'Template could not be saved.', 'warning'),
  });

  const favoriteTemplate = useMutation({
    mutationFn: ({ id, isFavorite }) => workspaceService.favoriteTemplate(workspaceId, id, isFavorite),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'templates'] }),
    onError: (error) => addNotification(error.message || 'Template favorite could not be saved.', 'warning'),
  });

  const publishTemplate = useMutation({
    mutationFn: ({ id, isPublished }) => workspaceService.updateTemplate(workspaceId, id, { isPublished }),
    onSuccess: async (template) => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'templates'] });
      addNotification(template.isPublished ? 'Template published to the workspace.' : 'Template unpublished.', 'success');
    },
    onError: (error) => addNotification(error.message || 'Template publication could not be updated.', 'warning'),
  });

  const useTemplate = useMutation({
    mutationFn: (templateId) => workspaceService.useTemplate(workspaceId, templateId, {}),
    onSuccess: async (dashboard) => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'dashboards'] });
      addNotification(`Created “${dashboard.name}” from a template.`, 'success');
      navigate(`/workspaces/${workspaceId}/dashboards/${dashboard.id}`);
    },
    onError: (error) => addNotification(error.message || 'Dashboard could not be created from this template.', 'warning'),
  });

  const changeStatus = useMutation({
    mutationFn: ({ id, status }) => workspaceService.updateDashboardStatus(id, status),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'dashboards'] });
      addNotification(variables.status === 'ARCHIVED' ? 'Dashboard archived.' : variables.status === 'PUBLISHED' ? 'Dashboard published.' : 'Dashboard restored to drafts.', 'success');
      setContextMenu(null);
    },
    onError: (error) => addNotification(error.message || 'Dashboard status could not be updated.', 'warning'),
  });

  const duplicateDashboard = useMutation({
    mutationFn: workspaceService.duplicateDashboard,
    onSuccess: async (dashboard) => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'dashboards'] });
      addNotification(`Created “${dashboard.name}” from the selected dashboard.`, 'success');
      setContextMenu(null);
    },
    onError: (error) => addNotification(error.message || 'Dashboard could not be duplicated.', 'warning'),
  });

  const updateDashboardPreference = useMutation({
    mutationFn: ({ id, ...input }) => workspaceService.updateDashboardPreferences(id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'dashboards'] });
      setContextMenu(null);
    },
    onError: (error) => addNotification(error.message || 'Dashboard preference could not be saved.', 'warning'),
  });

  const move = useMutation({
    mutationFn: ({ dashboardId, targetWorkspaceId }) => workspaceService.moveDashboard(dashboardId, targetWorkspaceId),
    onSuccess: async (dashboard) => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      addNotification(`Moved “${dashboard.name}” to another workspace. Active share links were revoked.`, 'success');
      setMoveDashboard(null);
      setContextMenu(null);
    },
    onError: (error) => addNotification(error.message || 'Dashboard could not be moved.', 'warning'),
  });

  const shareList = useQuery({
    queryKey: ['dashboard', shareDashboard?.id, 'shares'],
    queryFn: () => workspaceService.shares(shareDashboard.id),
    enabled: Boolean(shareDashboard),
  });

  const createShare = useMutation({
    mutationFn: () => workspaceService.createShare(shareDashboard.id, {
      permission: sharePermission,
      expiresInDays: Number(shareExpiry),
    }),
    onSuccess: async (result) => {
      setShareUrl(result.shareUrl);
      await navigator.clipboard.writeText(result.shareUrl).catch(() => {});
      await queryClient.invalidateQueries({ queryKey: ['dashboard', shareDashboard.id, 'shares'] });
      addNotification('Secure share link created and copied.', 'success');
    },
    onError: (error) => addNotification(error.message || 'Share link could not be created.', 'warning'),
  });

  const revokeShare = useMutation({
    mutationFn: (shareId) => workspaceService.revokeShare(shareDashboard.id, shareId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dashboard', shareDashboard.id, 'shares'] });
      addNotification('Share link revoked.', 'info');
    },
    onError: (error) => addNotification(error.message || 'Share link could not be revoked.', 'warning'),
  });

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (shareUrl) {
      QRCode.toDataURL(shareUrl, {
        margin: 2,
        width: 250,
        color: {
          dark: '#ffffff',
          light: '#1e293b',
        },
      })
        .then((url) => {
          setQrCodeUrl(url);
        })
        .catch((err) => {
          console.error(err);
        });
    } else {
      setQrCodeUrl('');
    }
  }, [shareUrl]);

  const handleRightClick = (e, dashboard) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      dashboard,
    });
  };

  const copyShareLink = () => {
    if (!shareUrl) return;
    const link = shareUrl;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Canvas render downloads
  const handleDownloadJSON = (dashboard) => {
    const payload = {
      schemaVersion: 2,
      dashboard: {
        name: dashboard.name,
        description: dashboard.description,
        scene: dashboard.scene || { schemaVersion: 2, nodes: [], connections: [] },
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

  const handleDownloadImage = (dashboard, format) => {
    try {
      const dataUrl = createDashboardSnapshot(dashboard, format);
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${dashboard.name.toLowerCase().replace(/\s+/g, '-')}-dashboard.${format === 'image/jpeg' ? 'jpg' : 'png'}`;
      link.click();
      setDownloadDashboard(null);
      addNotification('Dashboard layout exported as an image.', 'success');
    } catch (error) {
      addNotification(error.message || 'The dashboard image could not be exported.', 'error');
    }
  };

  const handleDownloadPDF = (dashboard) => {
    const nodes = Array.isArray(dashboard.scene?.nodes) ? dashboard.scene.nodes : [];
    const cards = nodes.map((node) => {
      const value = [node.content, node.unit, node.target != null ? `Target: ${node.target}` : '', node.description, node.code, node.rows, node.url].filter(Boolean).join('\n');
      return `<article><p class="type">${escapeHtml(node.type || 'widget')}</p><h2>${escapeHtml(node.title || 'Untitled widget')}</h2><pre>${escapeHtml(value)}</pre></article>`;
    }).join('');
    const printableDocument = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(dashboard.name)} · Voxel</title><style>
      *{box-sizing:border-box}body{margin:0;padding:40px;color:#0f172a;font:14px/1.5 Inter,system-ui,sans-serif;background:#fff}header{border-bottom:1px solid #e2e8f0;margin-bottom:24px;padding-bottom:18px}header p{color:#64748b;margin:4px 0}h1{font-size:28px;margin:0}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}article{break-inside:avoid;border:1px solid #cbd5e1;border-radius:12px;padding:16px;min-height:120px}article h2{font-size:16px;margin:6px 0 12px}.type{color:#7c3aed;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;margin:0}pre{white-space:pre-wrap;word-break:break-word;font:12px/1.5 ui-monospace,monospace;color:#475569;margin:0}@media print{body{padding:0}article{border-color:#cbd5e1}main{gap:10px}}@page{margin:16mm}
    </style></head><body><header><h1>${escapeHtml(dashboard.name)}</h1><p>${escapeHtml(dashboard.description || '')}</p><p>${nodes.length} widgets · Exported ${escapeHtml(new Date().toLocaleString())}</p></header><main>${cards || '<p>This dashboard has no widgets yet.</p>'}</main><script>window.addEventListener('load',()=>setTimeout(()=>window.print(),250));</script></body></html>`;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      addNotification('Allow pop-ups to open the printable dashboard report.', 'warning');
      return;
    }
    printWindow.opener = null;
    printWindow.document.open();
    printWindow.document.write(printableDocument);
    printWindow.document.close();
    setDownloadDashboard(null);
  };

  const handleImportFile = async (event) => {
    const fileInput = event.target;
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      addNotification('Dashboard JSON must be 2 MB or smaller.', 'warning');
      return;
    }

    setImporting(true);
    try {
      const payload = JSON.parse(await file.text());
      if (payload?.schemaVersion !== undefined && payload.schemaVersion !== 2) {
        throw new Error(`Dashboard file version ${payload.schemaVersion} is not supported.`);
      }

      let importedDashboard;
      if (payload?.dashboard && typeof payload.dashboard === 'object') {
        importedDashboard = payload.dashboard;
      } else if (payload?.workspace && Array.isArray(payload.dashboards) && payload.dashboards.length > 0) {
        importedDashboard = payload.dashboards[0];
      }
      if (!importedDashboard || typeof importedDashboard.name !== 'string' || !importedDashboard.scene) {
        throw new Error('Choose a Voxel dashboard JSON file with a name and scene.');
      }
      if (importedDashboard.scene.schemaVersion !== 2 || !Array.isArray(importedDashboard.scene.nodes)) {
        throw new Error('This dashboard scene version is not supported.');
      }

      const dashboardName = importedDashboard.name.trim();
      if (dashboardName.length < 2 || dashboardName.length > 109) {
        throw new Error('The imported dashboard name must be between 2 and 109 characters.');
      }
      const imported = await workspaceService.importDashboard(workspaceId, {
        name: `${dashboardName} (Imported)`,
        description: typeof importedDashboard.description === 'string'
          ? importedDashboard.description.slice(0, 280)
          : 'Imported dashboard design.',
        scene: importedDashboard.scene,
      });
      await queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'dashboards'] });
      addNotification(`“${imported.name}” was imported with its first history version.`, 'success');
    } catch (error) {
      addNotification(error instanceof Error ? error.message : 'Failed to import dashboard JSON.', 'warning');
    } finally {
      setImporting(false);
    }
  };

  const handleStorageUpload = (event) => {
    const file = event.target.files?.[0];
    if (file) uploadWorkspaceFile.mutate(file);
    event.target.value = '';
  };

  const handleCoverUpload = (event) => {
    const file = event.target.files?.[0];
    if (file) uploadCoverImage.mutate(file);
    event.target.value = '';
  };

  const handleStorageDownload = async (file) => {
    try {
      const blob = await workspaceService.downloadFile(workspaceId, file.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (error) {
      addNotification(error.message || 'File could not be downloaded.', 'warning');
    }
  };

  if (!workspaceId) return null;

  return (
    <section className="relative">
      {importing && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/65 backdrop-blur-md">
          <Loader2 className="animate-spin text-violet-500" size={48} />
          <h2 className="mt-4 text-lg font-semibold text-white">Importing Voxel Dashboard…</h2>
          <p className="mt-1.5 text-sm text-slate-400">
            Rebuilding node grid visual system layouts
          </p>
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
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">{showTemplates ? 'Templates' : showDeleted ? 'Trash' : 'Dashboards'}</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {showDeleted ? 'Restore recently deleted dashboards within 30 days.' : showTemplates ? 'Save and reuse dashboard layouts across this workspace.' : 'Build, share, and manage visual workspaces.'}
          </p>
        </div>
        <div className="flex gap-2.5">
          {!showDeleted && !showTemplates && canEditWorkspace && <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportFile}
            accept=".json"
            className="hidden"
          />}
          {!showDeleted && !showTemplates && <input
            type="file"
            ref={storageFileInputRef}
            onChange={handleStorageUpload}
            accept="image/png,image/jpeg,image/gif,image/webp,application/pdf,text/csv,application/json,text/markdown,.md,.markdown"
            className="hidden"
          />}
          {!showDeleted && !showTemplates && canManageWorkspace && <input
            type="file"
            ref={coverInputRef}
            onChange={handleCoverUpload}
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="hidden"
          />}

          {!showDeleted && !showTemplates && canEditWorkspace && <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:hover:bg-slate-800"
          >
            <Upload size={16} /> Import dashboard
          </button>}
          {!showDeleted && canEditWorkspace && <button
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 hover:bg-violet-500"
          >
            <Plus size={17} /> New dashboard
          </button>}
        </div>
      </div>
      {!showDeleted && !showTemplates && dashboards.data && <WorkspaceOverview
        dashboards={dashboards.data}
        activity={activity}
        recentComments={recentComments}
        coverImageUrl={activeWorkspace?.coverImageUrl}
        canManageCover={canManageWorkspace}
        coverUploadPending={uploadCoverImage.isPending}
        onUploadCover={() => coverInputRef.current?.click()}
        storage={workspaceFiles}
        storageCanUpload={workspaceFiles.data?.canUpload ?? canEditWorkspace}
        storageUploadPending={uploadWorkspaceFile.isPending}
        storageDeletePending={deleteWorkspaceFile.isPending}
        onRetryStorage={() => void workspaceFiles.refetch()}
        onUploadStorageFile={() => storageFileInputRef.current?.click()}
        onDownloadStorageFile={handleStorageDownload}
        onDeleteStorageFile={(file) => {
          if (window.confirm(`Permanently delete “${file.name}” and release its storage?`)) deleteWorkspaceFile.mutate(file.id);
        }}
        templates={templates.data || []}
        templatesPending={templates.isPending}
        templatesError={templates.isError}
        onBrowseTemplates={() => setShowTemplates(true)}
        onRetryTemplates={() => void templates.refetch()}
        onUseTemplate={(templateId) => useTemplate.mutate(templateId)}
        onOpenComments={(comment) => navigate(`/workspaces/${workspaceId}/dashboards/${comment.dashboardId}`, { state: { openComments: true } })}
      />}
      <div className="mt-6 flex items-center gap-2 border-b border-slate-200 dark:border-white/10">
        {[{ label: 'Dashboards', key: 'dashboards' }, { label: 'Templates', key: 'templates' }, { label: 'Trash', key: 'trash' }].map((view) => (
          <button
            key={view.label}
            type="button"
            onClick={() => { setShowDeleted(view.key === 'trash'); setShowTemplates(view.key === 'templates'); }}
            className={`border-b-2 px-3 py-2.5 text-xs font-bold ${(view.key === 'trash' ? showDeleted : view.key === 'templates' ? showTemplates : !showDeleted && !showTemplates) ? 'border-violet-600 text-violet-600' : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
          >
            {view.label}
          </button>
        ))}
      </div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="relative block min-w-0 flex-1 sm:max-w-md">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder={showTemplates ? 'Search templates' : 'Search dashboards'} aria-label={showTemplates ? 'Search templates' : 'Search dashboards'} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/15 dark:border-white/10 dark:bg-slate-900" />
        </label>
        {!showDeleted && !showTemplates && <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="sr-only">Filter dashboards by status</span>
          <select aria-label="Filter dashboards by status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-violet-400 dark:border-white/10 dark:bg-slate-900">
            <option value="ALL">All statuses</option>
            <option value="FAVORITES">Favorites</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>}
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="sr-only">Sort {showTemplates ? 'templates' : 'dashboards'}</span>
          <select aria-label={`Sort ${showTemplates ? 'templates' : 'dashboards'}`} value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs outline-none focus:border-violet-400 dark:border-white/10 dark:bg-slate-900">
            <option value="recent">Recently updated</option>
            <option value="name">Name A–Z</option>
            <option value="oldest">Oldest first</option>
          </select>
        </label>
      </div>
      {!showTemplates && dashboards.isPending && (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-white/5" />
          ))}
        </div>
      )}
      {showTemplates && templates.isPending && (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Loading templates">
          {[1, 2, 3].map((index) => <div key={index} className="h-48 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-white/5" />)}
        </div>
      )}
      {showTemplates && templates.data && (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleTemplates.map((template) => (
            <article key={template.id} className="rounded-3xl border border-slate-200/90 bg-white/90 p-6 shadow-sm dark:border-white/10 dark:bg-[#0c111e]/90">
              <div className="flex items-start justify-between gap-3">
                <span className="grid size-12 place-items-center rounded-2xl border border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-300"><Bookmark size={21} /></span>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${template.isPublished ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300' : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'}`}>{template.isPublished ? 'Workspace' : 'Private draft'}</span>
              </div>
              <h2 className="mt-5 text-lg font-bold tracking-tight text-slate-900 dark:text-white">{template.name}</h2>
              <p className="mt-2 min-h-10 text-xs leading-relaxed text-slate-500 dark:text-slate-400">{template.description || 'Reusable dashboard layout'}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="rounded-md bg-violet-500/10 px-2 py-1 text-[10px] font-semibold text-violet-600 dark:text-violet-300">{template.category}</span>
                {(template.tags || []).map((tag) => <span key={tag} className="rounded-md bg-slate-100 px-2 py-1 text-[10px] text-slate-500 dark:bg-white/5">{tag}</span>)}
              </div>
              <div className="mt-5 flex items-center justify-between gap-2">
                <span className="text-[10px] text-slate-400">By {template.createdBy || 'Voxel member'}</span>
                <div className="flex items-center gap-2">
                  <button type="button" aria-label={`${template.isFavorite ? 'Remove' : 'Add'} ${template.name} ${template.isFavorite ? 'from' : 'to'} favorites`} onClick={() => favoriteTemplate.mutate({ id: template.id, isFavorite: !template.isFavorite })} className="grid size-9 place-items-center rounded-lg text-amber-500 hover:bg-amber-500/10"><Star size={16} className={template.isFavorite ? 'fill-amber-400' : ''} /></button>
                  {canPublishTemplate && <button type="button" disabled={publishTemplate.isPending} onClick={() => publishTemplate.mutate({ id: template.id, isPublished: !template.isPublished })} className="rounded-xl border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">{template.isPublished ? 'Unpublish' : 'Publish'}</button>}
                  {canEditWorkspace && <button type="button" disabled={useTemplate.isPending} onClick={() => useTemplate.mutate(template.id)} className="rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50">Use template</button>}
                </div>
              </div>
            </article>
          ))}
          {visibleTemplates.length === 0 && <div className="col-span-full rounded-3xl border border-dashed border-violet-300/80 bg-violet-50/50 p-12 text-center dark:border-violet-500/30 dark:bg-violet-500/5"><Bookmark className="mx-auto text-violet-500" size={24} /><h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">{templates.data.length ? 'No templates match your search' : 'No templates yet'}</h2><p className="mt-2 text-xs leading-5 text-slate-500">{templates.data.length ? 'Try another search term.' : 'Save a dashboard from its actions menu to make a reusable template.'}</p></div>}
        </div>
      )}
      {showTemplates && templates.isError && <div role="alert" className="mt-8 rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">Templates could not be loaded. <button type="button" onClick={() => void templates.refetch()} className="font-semibold underline">Try again</button></div>}
      {!showTemplates && dashboards.data && (
        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleDashboards.map((dashboard) => (
            <div
              key={dashboard.id}
              role="button"
              tabIndex={0}
              aria-label={`${dashboard.deletedAt ? 'Restore' : 'Open'} dashboard ${dashboard.name}`}
              onContextMenu={(e) => handleRightClick(e, dashboard)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key !== 'Enter' && event.key !== ' ') return;
                event.preventDefault();
                if (!dashboard.deletedAt) return navigate(`/workspaces/${workspaceId}/dashboards/${dashboard.id}`);
                if (canEditWorkspace) return recoverDashboard.mutate(dashboard.id);
                addNotification('Ask a workspace editor or administrator to restore this dashboard.', 'info');
              }}
              onClick={() => {
                if (!dashboard.deletedAt) return navigate(`/workspaces/${workspaceId}/dashboards/${dashboard.id}`);
                if (canEditWorkspace) return recoverDashboard.mutate(dashboard.id);
                addNotification('Ask a workspace editor or administrator to restore this dashboard.', 'info');
              }}
              className={`group relative cursor-pointer rounded-3xl border border-slate-200/90 bg-white/90 p-6 text-left shadow-sm transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:border-white/10 dark:bg-[#0c111e]/90 backdrop-blur-xl ${dashboard.deletedAt ? 'opacity-80 hover:border-violet-500/50' : 'hover:-translate-y-1 hover:border-violet-500/50 hover:shadow-xl hover:shadow-violet-500/10'}`}
            >
              <div className="flex items-start justify-between">
                <span className="grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-500/15 to-indigo-500/15 text-violet-600 dark:text-violet-300 border border-violet-500/20 group-hover:scale-105 transition-transform">
                  <LayoutDashboard size={22} />
                </span>
                <span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider ${dashboard.deletedAt ? 'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-400' : dashboard.status === 'PUBLISHED' ? 'border-emerald-200/60 bg-emerald-50 text-emerald-600 dark:border-emerald-800/30 dark:bg-emerald-950/40 dark:text-emerald-400' : dashboard.status === 'ARCHIVED' ? 'border-slate-200 bg-slate-100 text-slate-500 dark:border-white/10 dark:bg-white/5' : 'border-violet-200/60 bg-violet-50 text-violet-600 dark:border-violet-800/30 dark:bg-violet-950/40 dark:text-violet-400'}`}>
                  {dashboard.deletedAt ? 'Trash · 30 days' : dashboard.status || 'DRAFT'}
                </span>
                <span className="flex items-center gap-1.5 text-amber-500" aria-label={`${dashboard.isPinned ? 'Pinned. ' : ''}${dashboard.isFavorite ? 'Favorite' : ''}`}>
                  {dashboard.isPinned && <Pin size={13} className="fill-amber-400" />}
                  {dashboard.isFavorite && <Star size={13} className="fill-amber-400" />}
                </span>
                <button
                  type="button"
                  aria-label={`More actions for ${dashboard.name}`}
                  onClick={(event) => { event.stopPropagation(); handleRightClick(event, dashboard); }}
                  className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-white"
                >
                  <MoreHorizontal size={17} />
                </button>
              </div>
              <h2 className="mt-5 text-lg font-bold text-slate-900 dark:text-white tracking-tight">{dashboard.name}</h2>
              <p className="mt-2 min-h-10 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {dashboard.description || 'A visual system for metrics, pipeline logic, and live telemetry.'}
              </p>
              <span className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-violet-600 dark:text-violet-400 group-hover:text-violet-500">
                {dashboard.deletedAt ? canEditWorkspace ? <><RotateCcw size={14} /> Restore to open</> : 'Restore requires an editor' : <>Open canvas <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" /></>}
              </span>
            </div>
          ))}
          {visibleDashboards.length === 0 && (
            <div className="col-span-full rounded-3xl border border-dashed border-violet-300/80 bg-violet-50/50 p-12 text-center dark:border-violet-500/30 dark:bg-violet-500/5 backdrop-blur-sm">
              <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white text-violet-600 shadow-md dark:bg-slate-900 border border-violet-100 dark:border-violet-500/20">
                <LayoutDashboard size={24} />
              </span>
              <h2 className="mt-4 text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">{showDeleted ? 'Trash is empty' : dashboards.data.length === 0 ? 'Create the first canvas' : 'No dashboards match your filters'}</h2>
              <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-500 dark:text-slate-400 font-medium">
                {showDeleted ? 'Deleted dashboards will appear here for 30 days and can be restored by an editor or workspace administrator.' : dashboards.data.length === 0 ? 'A dashboard gives your workspace a visual system for live metrics, formulas, node pipelines, and team operations.' : 'Try a different search or status filter.'}
              </p>
              {!showDeleted && canEditWorkspace && dashboards.data.length === 0 && <button
                onClick={() => setDialogOpen(true)}
                className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-violet-500 shadow-lg shadow-violet-600/25 transition cursor-pointer hover:scale-105 active:scale-95"
              >
                <Plus size={16} /> New dashboard
              </button>}
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
          className="fixed z-50 w-52 rounded-xl border border-slate-200 bg-white/90 p-1.5 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/90"
        >
          {contextMenu.dashboard.deletedAt ? (
            <>
              {canEditWorkspace && <button type="button" onClick={() => recoverDashboard.mutate(contextMenu.dashboard.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-white/5">
                <RotateCcw size={13} /> Restore within 30 days
              </button>}
              <button type="button" onClick={() => { setDownloadDashboard(contextMenu.dashboard); setContextMenu(null); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-white/5">
                <Download size={13} /> Download backup
              </button>
            </>
          ) : <>
          {canEditWorkspace && <button
            onClick={(e) => {
              e.stopPropagation();
              setEditDashboard(contextMenu.dashboard);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <Edit2 size={13} /> Edit Title
          </button>}
          <button type="button" onClick={() => updateDashboardPreference.mutate({ id: contextMenu.dashboard.id, isFavorite: !contextMenu.dashboard.isFavorite })} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-white/5">
            <Star size={13} className={contextMenu.dashboard.isFavorite ? 'fill-amber-400 text-amber-500' : ''} /> {contextMenu.dashboard.isFavorite ? 'Remove favorite' : 'Add favorite'}
          </button>
          <button type="button" onClick={() => updateDashboardPreference.mutate({ id: contextMenu.dashboard.id, isPinned: !contextMenu.dashboard.isPinned })} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-white/5">
            <Pin size={13} className={contextMenu.dashboard.isPinned ? 'fill-amber-400 text-amber-500' : ''} /> {contextMenu.dashboard.isPinned ? 'Unpin dashboard' : 'Pin dashboard'}
          </button>
          {canEditWorkspace && <button type="button" onClick={() => duplicateDashboard.mutate(contextMenu.dashboard.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-white/5">
            <Copy size={13} /> Duplicate dashboard
          </button>}
          {canEditWorkspace && <button type="button" onClick={() => { setTemplateDashboard(contextMenu.dashboard); setContextMenu(null); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-white/5">
            <Bookmark size={13} /> Save as template
          </button>}
          {(workspaceRole === 'OWNER' || workspaceRole === 'ADMIN') && workspaceList.data?.some((workspace) => workspace.id !== workspaceId) && <button type="button" onClick={() => { setMoveDashboard(contextMenu.dashboard); setContextMenu(null); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-white/5">
            Move to workspace…
          </button>}
          {canEditWorkspace && <button type="button" onClick={() => changeStatus.mutate({ id: contextMenu.dashboard.id, status: contextMenu.dashboard.status === 'ARCHIVED' ? 'DRAFT' : contextMenu.dashboard.status === 'DRAFT' ? 'PUBLISHED' : 'ARCHIVED' })} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-white/5">
            {contextMenu.dashboard.status === 'ARCHIVED' ? <RotateCcw size={13} /> : contextMenu.dashboard.status === 'DRAFT' ? <Check size={13} /> : <Archive size={13} />}
            {contextMenu.dashboard.status === 'ARCHIVED' ? 'Restore to draft' : contextMenu.dashboard.status === 'DRAFT' ? 'Publish dashboard' : 'Archive dashboard'}
          </button>}
          {canEditWorkspace && <button
            onClick={(e) => {
              e.stopPropagation();
              setShareUrl('');
              setSharePermission('VIEW');
              setShareDashboard(contextMenu.dashboard);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs hover:bg-slate-100 dark:hover:bg-white/5"
          >
            <Share2 size={13} /> Share
          </button>}
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
          {canEditWorkspace && <button
            onClick={(e) => {
              e.stopPropagation();
              setDeleteDashboard(contextMenu.dashboard);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
          >
            <Trash2 size={13} /> Delete
          </button>}
          </>}
        </div>
      )}

      {/* Create Dashboard dialog */}
      {moveDashboard && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={() => setMoveDashboard(null)}>
          <form onSubmit={(event) => { event.preventDefault(); const targetWorkspaceId = new FormData(event.currentTarget).get('workspaceId'); if (targetWorkspaceId) move.mutate({ dashboardId: moveDashboard.id, targetWorkspaceId }); }} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900">
            <h2 className="text-base font-bold">Move “{moveDashboard.name}”</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Choose a workspace where you have edit access. Existing share links will be revoked.</p>
            <select name="workspaceId" required defaultValue="" className="mt-5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-slate-950">
              <option value="" disabled>Select workspace</option>
              {(workspaceList.data || []).filter((workspace) => workspace.id !== workspaceId && ['OWNER', 'ADMIN', 'EDITOR'].includes(workspace.role)).map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setMoveDashboard(null)} className="rounded-lg px-3 py-2 text-xs font-bold text-slate-500">Cancel</button>
              <button type="submit" disabled={move.isPending} className="rounded-lg bg-violet-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{move.isPending ? 'Moving…' : 'Move dashboard'}</button>
            </div>
          </form>
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
      {templateDashboard && <TemplateDialog
        dashboard={templateDashboard}
        pending={saveTemplate.isPending}
        canPublish={canPublishTemplate}
        onClose={() => setTemplateDashboard(null)}
        onSubmit={(values) => saveTemplate.mutate(values)}
      />}

      {/* Edit Dashboard Dialog */}
      {editDashboard && (
        <EditDashboardDialog
          dashboard={editDashboard}
          pending={rename.isPending}
          onClose={() => setEditDashboard(null)}
          onSubmit={(name, description) =>
            rename.mutate({ id: editDashboard.id, name, description: description ?? null, version: editDashboard.version })
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

            <div className="mb-4 grid grid-cols-2 gap-2.5">
              <label className="space-y-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Access
                <select value={sharePermission} onChange={(event) => setSharePermission(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold normal-case tracking-normal text-slate-800 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100">
                  <option value="VIEW">View only</option>
                  <option value="EDIT">Can edit</option>
                </select>
              </label>
              <label className="space-y-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Expires in
                <select value={shareExpiry} onChange={(event) => setShareExpiry(Number(event.target.value))} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold normal-case tracking-normal text-slate-800 dark:border-white/10 dark:bg-slate-950 dark:text-slate-100">
                  <option value={1}>1 day</option>
                  <option value={7}>7 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={365}>1 year</option>
                </select>
              </label>
            </div>
            <button
              type="button"
              onClick={() => createShare.mutate()}
              disabled={createShare.isPending}
              className="mb-4 w-full rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-violet-600/20 hover:bg-violet-500 disabled:cursor-wait disabled:opacity-60"
            >
              {createShare.isPending ? 'Creating secure link…' : 'Create share link'}
            </button>

            {/* Real dynamic QR Code */}
            {shareUrl && <div className="flex flex-col items-center justify-center p-4 mb-4 rounded-xl bg-slate-50 dark:bg-[#1e293b] border border-slate-100 dark:border-white/5">
              {qrCodeUrl ? (
                <img
                  src={qrCodeUrl}
                  alt="Voxel canvas QR Code"
                  className="size-36 object-contain"
                />
              ) : <div className="size-36 flex items-center justify-center"><Loader2 size={20} className="animate-spin text-violet-500" /></div>}
              <p className="mt-2 text-[10px] text-slate-400">Scan to open this secure share link</p>
            </div>}

            {/* Link Copy */}
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none dark:border-white/10 dark:bg-white/5"
              />

              <button
                onClick={copyShareLink}
                disabled={!shareUrl}
                className="rounded-lg bg-violet-600 px-3 py-2 text-white hover:bg-violet-500 transition cursor-pointer disabled:opacity-40"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>

            {shareList.isPending ? <p className="mt-4 text-[10px] text-slate-500">Loading active links…</p> : (shareList.data || []).length > 0 && (
              <div className="mt-4 space-y-2 border-t border-slate-100 pt-4 dark:border-white/5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active links</p>
                {shareList.data.map((share) => (
                  <div key={share.id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-white/5">
                    <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">{share.permission === 'EDIT' ? 'Can edit' : 'View only'} · Expires {new Date(share.expiresAt).toLocaleDateString()}</span>
                    <button type="button" disabled={revokeShare.isPending} onClick={() => revokeShare.mutate(share.id)} className="text-[10px] font-bold text-rose-600 disabled:opacity-50">Revoke</button>
                  </div>
                ))}
              </div>
            )}

            {/* Direct messaging apps */}
            <div className="mt-5 border-t border-slate-100 pt-4 dark:border-white/5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Direct share
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {/* WhatsApp */}
                <button
                  onClick={() => {
                    const link = shareUrl;
                    if (!link) return;
                    window.open(
                      `https://api.whatsapp.com/send?text=${encodeURIComponent(`Check out my visual canvas: ${link}`)}`,
                      '_blank',
                    );
                  }}
                  disabled={!shareUrl}
                  className="flex items-center justify-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 py-2.5 px-3.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer shadow-xs active:scale-[0.98] disabled:opacity-40"
                >
                  <svg className="size-5 shrink-0" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C6.48 2 2 6.48 2 12c0 2.17.69 4.18 1.86 5.83L2.5 21.5l3.81-1.33A9.94 9.94 0 0012 22c5.52 0 10-4.48 10-10S17.52 2 12 2z" fill="#25D366" />
                    <path d="M17.5 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.26-.46-2.39-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.91-2.2-.25-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.88 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35z" fill="#FFFFFF" />
                  </svg>
                  <span>WhatsApp</span>
                </button>

                {/* X */}
                <button
                  onClick={() => {
                    const link = shareUrl;
                    if (!link) return;
                    window.open(
                      `https://x.com/intent/tweet?text=${encodeURIComponent(`Check out my visual canvas: ${link}`)}`,
                      '_blank',
                    );
                  }}
                  disabled={!shareUrl}
                  className="flex items-center justify-center gap-2.5 rounded-xl border border-slate-300 dark:border-white/15 bg-slate-100 dark:bg-white/10 py-2.5 px-3.5 text-xs font-bold text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-white/20 transition-all cursor-pointer shadow-xs active:scale-[0.98] disabled:opacity-40"
                >
                  <svg className="size-4 shrink-0 fill-current" viewBox="0 0 24 24">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  <span>X</span>
                </button>

                {/* Telegram */}
                <button
                  onClick={() => {
                    const link = shareUrl;
                    if (!link) return;
                    window.open(
                      `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent('Check out my visual canvas!')}`,
                      '_blank',
                    );
                  }}
                  disabled={!shareUrl}
                  className="flex items-center justify-center gap-2.5 rounded-xl border border-sky-500/20 bg-sky-500/10 py-2.5 px-3.5 text-xs font-bold text-sky-600 dark:text-sky-400 hover:bg-sky-500/20 transition-all cursor-pointer shadow-xs active:scale-[0.98] disabled:opacity-40"
                >
                  <svg className="size-5 shrink-0" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="12" fill="#229ED9" />
                    <path d="M5.4 11.9L16.8 7.3c.5-.2 1 .1.9.7l-1.9 9.1c-.1.6-.7.8-1.2.5l-3.3-2.4-1.6 1.5c-.2.2-.4.4-.8.4l.2-3.4 6.2-5.6c.3-.3-.1-.4-.4-.2L7.3 13.9l-3.3-1c-.6-.2-.6-.6.1-.9z" fill="#FFFFFF" />
                  </svg>
                  <span>Telegram</span>
                </button>

                {/* Gmail */}
                <button
                  onClick={() => {
                    const link = shareUrl;
                    if (!link) return;
                    window.open(
                      `mailto:?subject=${encodeURIComponent('Voxel Visual Canvas')}&body=${encodeURIComponent(`Check out my visual canvas: ${link}`)}`,
                      '_blank',
                    );
                  }}
                  disabled={!shareUrl}
                  className="flex items-center justify-center gap-2.5 rounded-xl border border-rose-500/20 bg-rose-500/10 py-2.5 px-3.5 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer shadow-xs active:scale-[0.98] disabled:opacity-40"
                >
                  <svg className="size-5 shrink-0" viewBox="0 0 24 24" fill="none">
                    <path d="M22.5 5.25v13.5c0 .966-.784 1.75-1.75 1.75h-2.5V8.536l-6.25 4.687L5.75 8.536V20.5h-2.5C2.284 20.5 1.5 19.716 1.5 18.75V5.25c0-1.272 1.458-1.996 2.45-1.25L12 10.064l8.05-6.064c.992-.746 2.45.022 2.45 1.25z" fill="#4285F4" />
                    <path d="M1.5 5.25c0-.443.176-.868.49-1.182.314-.313.739-.489 1.182-.489H5.75v16.921H3.172A1.672 1.672 0 011.5 18.828V5.25z" fill="#34A853" />
                    <path d="M22.5 5.25v13.578c0 .443-.176.868-.49 1.182a1.672 1.672 0 01-1.182.49H18.25V3.579h2.572c.443 0 .868.176 1.182.489.314.314.49.739.49 1.182z" fill="#EA4335" />
                    <path d="M12 10.064L3.95 3.999C2.958 3.253 1.5 3.978 1.5 5.25v.75L12 13.5l10.5-7.5v-.75c0-1.272-1.458-1.996-2.45-1.25L12 10.064z" fill="#FBBC04" />
                  </svg>
                  <span>Gmail</span>
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
                  <div className="text-xs font-semibold">PNG Dashboard Layout</div>
                  <div className="text-[10px] text-slate-400">Image of widget positions and values</div>
                </div>
                <Download size={14} className="text-slate-400" />
              </button>
              <button
                onClick={() => handleDownloadImage(downloadDashboard, 'image/jpeg')}
                className="flex w-full items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5"
              >
                <div className="text-left">
                  <div className="text-xs font-semibold">JPEG Dashboard Layout</div>
                  <div className="text-[10px] text-slate-400">Compressed image of widget positions</div>
                </div>
                <Download size={14} className="text-slate-400" />
              </button>
              <button
                onClick={() => handleDownloadPDF(downloadDashboard)}
                className="flex w-full items-center justify-between rounded-xl border border-slate-100 p-3 hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5"
              >
                <div className="text-left">
                  <div className="text-xs font-semibold">Print / Save as PDF</div>
                  <div className="text-[10px] text-slate-400">Opens a formatted report in your print dialog</div>
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
              Move <b>{deleteDashboard.name}</b> to Trash? You can restore it for 30 days. Existing public share links will be revoked and will stay revoked if you restore it.
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

function WorkspaceOverview({ dashboards, activity, recentComments, storage, storageCanUpload, storageUploadPending, storageDeletePending, onRetryStorage, onUploadStorageFile, onDownloadStorageFile, onDeleteStorageFile, coverImageUrl, canManageCover, coverUploadPending, onUploadCover, templates, templatesPending, templatesError, onBrowseTemplates, onRetryTemplates, onUseTemplate, onOpenComments }) {
  const stats = [
    { label: 'Dashboards', value: dashboards.length },
    { label: 'Published', value: dashboards.filter((dashboard) => dashboard.status === 'PUBLISHED').length },
    { label: 'Favorites', value: dashboards.filter((dashboard) => dashboard.isFavorite).length },
    { label: 'Widgets', value: dashboards.reduce((total, dashboard) => total + (dashboard.scene?.nodes?.length || 0), 0) },
  ];

  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_1.2fr]">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-2">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-900/70">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{stat.label}</div>
            <div className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">{stat.value}</div>
          </div>
        ))}
      </div>
      <section aria-labelledby="workspace-activity-heading" className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-900/70">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Workspace</p>
            <h2 id="workspace-activity-heading" className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Recent activity</h2>
          </div>
          {activity.isError && <button type="button" onClick={() => void activity.refetch()} className="text-xs font-semibold text-violet-600 hover:underline">Retry</button>}
        </div>
        {activity.isPending ? (
          <div className="mt-4 space-y-2" aria-label="Loading recent activity">
            <div className="h-8 animate-pulse rounded-lg bg-slate-100 dark:bg-white/5" />
            <div className="h-8 animate-pulse rounded-lg bg-slate-100 dark:bg-white/5" />
          </div>
        ) : activity.isError ? (
          <p role="status" className="mt-4 text-xs text-slate-500">Activity could not be loaded.</p>
        ) : activity.data?.length ? (
          <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
            {activity.data.slice(0, 4).map((event) => (
              <li key={event.id} className="flex items-center justify-between gap-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200">{event.actor?.displayName || 'A team member'} · {formatActivityAction(event.action)}</p>
                  <p className="mt-0.5 text-[10px] capitalize text-slate-500">{event.resourceType.replaceAll('_', ' ')}</p>
                </div>
                <time className="shrink-0 text-[10px] text-slate-400" dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleDateString()}</time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-xs text-slate-500">Workspace activity will appear here as your team works.</p>
        )}
      </section>
      <WorkspaceCoverPanel imageUrl={coverImageUrl} canManage={canManageCover} pending={coverUploadPending} onUpload={onUploadCover} />
      <WorkspaceStoragePanel
        storage={storage}
        canUpload={storageCanUpload}
        uploadPending={storageUploadPending}
        deletePending={storageDeletePending}
        onRetry={onRetryStorage}
        onUpload={onUploadStorageFile}
        onDownload={onDownloadStorageFile}
        onDelete={onDeleteStorageFile}
      />
      <section aria-labelledby="workspace-comments-heading" className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-900/70 xl:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Team discussion</p>
            <h2 id="workspace-comments-heading" className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Recent comments</h2>
          </div>
          {recentComments.isError && <button type="button" onClick={() => void recentComments.refetch()} className="text-xs font-semibold text-violet-600 hover:underline">Retry</button>}
        </div>
        {recentComments.isPending ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="Loading recent comments">
            {[0, 1].map((item) => <div key={item} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />)}
          </div>
        ) : recentComments.isError ? (
          <p role="status" className="mt-4 text-xs text-slate-500">Recent comments could not be loaded.</p>
        ) : recentComments.data?.length ? (
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {recentComments.data.map((comment) => (
              <li key={comment.id}>
                <button type="button" onClick={() => onOpenComments(comment)} className="group flex w-full items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-left transition hover:border-violet-300 hover:bg-violet-50/70 dark:border-white/5 dark:bg-white/[0.025] dark:hover:border-violet-500/30 dark:hover:bg-violet-500/5">
                  {comment.author?.avatarUrl ? (
                    <img src={comment.author.avatarUrl} alt="" className="size-8 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-violet-100 text-[10px] font-extrabold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">{(comment.author?.displayName || 'Member').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[11px] font-bold text-slate-800 dark:text-slate-100">{comment.author?.displayName || 'Former member'}</span>
                      <time className="shrink-0 text-[9px] text-slate-400" dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleDateString()}</time>
                    </span>
                    <span className="mt-1 block truncate text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">{comment.body}</span>
                    <span className="mt-1 block truncate text-[9px] font-semibold text-violet-600 dark:text-violet-400">{comment.dashboard?.name || 'Dashboard'} <ArrowRight size={10} className="ml-1 inline transition-transform group-hover:translate-x-0.5" /></span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-6 text-center text-xs text-slate-500 dark:border-white/10">Dashboard conversations will appear here as your team collaborates.</p>
        )}
      </section>
      <section aria-labelledby="workspace-templates-heading" className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-900/70 xl:col-span-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Get started faster</p>
            <h2 id="workspace-templates-heading" className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Suggested templates</h2>
          </div>
          <button type="button" onClick={onBrowseTemplates} className="text-xs font-semibold text-violet-600 hover:underline dark:text-violet-300">Browse all</button>
        </div>
        {templatesPending ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-3" aria-label="Loading suggested templates">
            {[1, 2, 3].map((index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" />)}
          </div>
        ) : templatesError ? (
          <p className="mt-3 text-xs text-slate-500">Suggested templates could not be loaded. <button type="button" onClick={onRetryTemplates} className="font-semibold text-violet-600 underline">Try again</button></p>
        ) : templates.filter((template) => template.isPublished).length ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {templates.filter((template) => template.isPublished).slice(0, 3).map((template) => (
              <article key={template.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5 dark:border-white/5">
                <div className="min-w-0">
                  <h3 className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">{template.name}</h3>
                  <p className="mt-0.5 truncate text-[10px] text-slate-400">{template.category} · {(template.scene?.nodes || []).length} widgets</p>
                </div>
                <button type="button" onClick={() => onUseTemplate(template.id)} className="shrink-0 rounded-lg bg-violet-600 px-2.5 py-1.5 text-[10px] font-bold text-white hover:bg-violet-500">Use</button>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500">Published workspace templates will appear here.</p>
        )}
      </section>
    </div>
  );
}

function WorkspaceCoverPanel({ imageUrl, canManage, pending, onUpload }) {
  return (
    <section aria-label="Workspace cover image" className="relative isolate flex min-h-28 items-end overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-r from-violet-700 via-indigo-700 to-cyan-700 p-4 dark:border-white/10 xl:col-span-2">
      {imageUrl && <img src={imageUrl} alt="" className="absolute inset-0 -z-10 size-full object-cover" />}
      <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950/75 via-slate-950/35 to-transparent" />
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/70">Workspace identity</p>
        <h2 className="mt-1 text-sm font-bold text-white">{imageUrl ? 'Your workspace cover' : 'Add a workspace cover'}</h2>
      </div>
      {canManage && <button type="button" onClick={onUpload} disabled={pending} className="ml-auto inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-bold text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-60">
        {pending ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}{pending ? 'Uploading…' : imageUrl ? 'Change cover' : 'Upload cover'}
      </button>}
    </section>
  );
}

function WorkspaceStoragePanel({ storage, canUpload, uploadPending, deletePending, onRetry, onUpload, onDownload, onDelete }) {
  const used = Number(storage.data?.storageUsedBytes || 0);
  const quota = Number(storage.data?.storageQuotaBytes || 0);
  const percent = quota ? Math.min(100, (used / quota) * 100) : 0;

  return (
    <section aria-labelledby="workspace-storage-heading" className="rounded-2xl border border-slate-200/80 bg-white/80 p-4 dark:border-white/10 dark:bg-slate-900/70 xl:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><HardDrive size={17} /></span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">Workspace assets</p>
            <h2 id="workspace-storage-heading" className="mt-1 text-sm font-bold text-slate-900 dark:text-white">File storage</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {quota > 0 && <span className="text-xs font-medium text-slate-500">{formatFileSize(used)} of {formatFileSize(quota)}</span>}
          {canUpload && <button type="button" onClick={onUpload} disabled={uploadPending} className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-violet-500 disabled:opacity-60">
            {uploadPending ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}{uploadPending ? 'Uploading…' : 'Upload file'}
          </button>}
        </div>
      </div>
      {quota > 0 && <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10" role="progressbar" aria-label="Workspace storage used" aria-valuemin={0} aria-valuemax={quota} aria-valuenow={used}>
        <div className={`h-full rounded-full transition-all ${percent >= 95 ? 'bg-rose-500' : 'bg-gradient-to-r from-violet-500 to-indigo-500'}`} style={{ width: `${percent}%` }} />
      </div>}
      {storage.isPending ? (
        <div className="mt-4 h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-white/5" aria-label="Loading workspace files" />
      ) : storage.isError ? (
        <p role="status" className="mt-4 text-xs text-slate-500">Workspace files could not be loaded. <button type="button" onClick={onRetry} className="font-semibold text-violet-600 hover:underline">Try again</button></p>
      ) : storage.data?.files?.length ? (
        <ul className="mt-3 divide-y divide-slate-100 dark:divide-white/5">
          {storage.data.files.map((file) => (
            <li key={file.id} className="flex min-w-0 items-center gap-3 py-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400"><FileText size={15} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-800 dark:text-slate-200" title={file.name}>{file.name}</p>
                <p className="mt-0.5 text-[10px] text-slate-500">{formatFileSize(file.size)} · {file.uploader?.displayName || 'Former member'} · {new Date(file.createdAt).toLocaleDateString()}</p>
              </div>
              <button type="button" onClick={() => onDownload(file)} aria-label={`Download ${file.name}`} className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-violet-600 dark:hover:bg-white/5"><Download size={15} /></button>
              {file.canDelete && <button type="button" onClick={() => onDelete(file)} disabled={deletePending} aria-label={`Delete ${file.name}`} className="rounded-lg p-2 text-slate-500 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:hover:bg-rose-500/10"><Trash2 size={15} /></button>}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center dark:border-white/10">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">No files yet</p>
          <p className="mt-1 text-[11px] text-slate-500">Images, PDFs, CSV, JSON, and Markdown files stay available to workspace members.</p>
        </div>
      )}
      {canUpload && <p className="mt-3 text-[10px] text-slate-400">Maximum 10 MB per file. Uploads count toward the shared workspace quota.</p>}
    </section>
  );
}

function formatFileSize(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatActivityAction(action = '') {
  return action
    .replace(/^(workspace|dashboard)\./, '')
    .replaceAll('.', ' ')
    .replaceAll('_', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function DashboardDialog({ pending, error, onClose, onSubmit }) {
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

function TemplateDialog({ dashboard, pending, canPublish, onClose, onSubmit }) {
  const templateSchema = z.object({
    name: z.string().trim().min(2, 'Use at least 2 characters.').max(120),
    description: z.string().trim().max(280).optional(),
    category: z.string().trim().min(1).max(40),
    tagsText: z.string().max(200).optional(),
    isPublished: z.boolean().default(false),
  });
  const form = useForm({
    resolver: zodResolver(templateSchema),
    defaultValues: { name: dashboard.name, description: dashboard.description || '', category: 'General', tagsText: '', isPublished: false },
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <form onSubmit={form.handleSubmit((values) => {
        const tags = [...new Set((values.tagsText || '').split(',').map((tag) => tag.trim()).filter(Boolean))].slice(0, 8);
        const { tagsText: _tagsText, ...template } = values;
        onSubmit({ ...template, tags });
      })} onMouseDown={(event) => event.stopPropagation()} className="w-full max-w-md space-y-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Save dashboard as template</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">The current layout and widget configuration will be copied into this workspace’s template library.</p>
        </div>
        <label className="block text-sm font-semibold">Template name
          <input {...form.register('name')} className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-violet-400 dark:border-white/10" />
          {form.formState.errors.name && <span className="mt-1 block text-xs text-rose-600">{form.formState.errors.name.message}</span>}
        </label>
        <label className="block text-sm font-semibold">Description
          <textarea {...form.register('description')} rows={2} className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-violet-400 dark:border-white/10" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-semibold">Category
            <input {...form.register('category')} className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-violet-400 dark:border-white/10" />
          </label>
          <label className="block text-sm font-semibold">Tags
            <input {...form.register('tagsText')} placeholder="ops, metrics" className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-violet-400 dark:border-white/10" />
          </label>
        </div>
        {canPublish && <label className="flex items-start gap-2 text-xs leading-5 text-slate-600 dark:text-slate-300"><input type="checkbox" {...form.register('isPublished')} className="mt-1 accent-violet-600" /><span>Publish to the workspace template library so members can use it.</span></label>}
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-500">Cancel</button>
          <button type="submit" disabled={pending} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? 'Saving…' : 'Save template'}</button>
        </div>
      </form>
    </div>
  );
}

function EditDashboardDialog({ dashboard, pending, onClose, onSubmit }) {
  const { register, handleSubmit } = useForm({
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
