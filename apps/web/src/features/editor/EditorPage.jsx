import { Component, memo, useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate, useParams, Link } from 'react-router-dom';
import appIcon from '@/assets/app-icon.png';
import appIconDark from '@/assets/app-icon-dark.png';

import {
  BarChart3,
  FileText,
  Plus,
  Save,
  Sparkles,
  X,
  Activity,
  Cpu,
  Layers,
  Link as LinkIcon,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Trash2,
  ArrowLeft,
  Undo2,
  Redo2,
  Image as ImageIcon,
  Code2,
  Table,
  Timer,
  Minus,
  Clock,
  ChevronDown,
  Download,
  SlidersHorizontal,
  FolderOpen,
  Zap,
  Maximize2,
  Pencil,
  Target,
  MessageSquare,
  Send,
  RefreshCw,
  CheckCircle2,
  CornerDownRight,
  LocateFixed,
} from 'lucide-react';
import { workspaceService } from '@/features/workspaces/workspace-service';
import { authService } from '@/features/auth/auth-service';
import { useShortcut } from '@/lib/keyboard';
import { useHistoryStore } from '@/store/history-store';
import { useSettingsStore } from '@/store/settings-store';
import { useNotificationStore } from '@/store/notification-store';
import { VersionHistory } from './VersionHistory';
import { useYjs } from './use-yjs';
import {
  CANVAS_INNER_PADDING,
  CANVAS_PADDING,
  canvasPointToScreen,
  getCanvasViewport,
  pointerToCanvasPoint,
  scrollOffsetForCanvasPoint,
} from './canvas-geometry';
import {
  getWidgetDefinition,
  useWidgetDefinitions, validateWidgetConfiguration,
} from './widget-registry';
import { CustomConfirmModal } from '@/components/feedback/CustomConfirmModal';

const emptyScene = {
  schemaVersion: 2,
  nodes: [],
  connections: [],
  gridStyle: 'dots',
};

const sceneOf = (value) => {
  if (!value || typeof value !== 'object') return emptyScene;
  const candidate = value;
  if (!Array.isArray(candidate.nodes)) return emptyScene;

  const seenIds = new Set();
  const parsedNodes = candidate.nodes.map((sourceNode, index) => {
    const isRecord = sourceNode && typeof sourceNode === 'object' && !Array.isArray(sourceNode);
    const node = isRecord ? sourceNode : {};
    const requestedId = typeof node.id === 'string' && node.id.length > 0 && node.id.length <= 160 ? node.id : null;
    const id = requestedId && !seenIds.has(requestedId) ? requestedId : `invalid-widget-${index}`;
    seenIds.add(id);
    const defaultX = (index % 2) * 360 + 40;
    const defaultY = Math.floor(index / 2) * 280 + 40;
    const validX = Number.isFinite(node.x) && Math.abs(node.x) <= 100000;
    const validY = Number.isFinite(node.y) && Math.abs(node.y) <= 100000;
    const validWidth = Number.isFinite(node.customWidth) && node.customWidth >= 100 && node.customWidth <= 5000;
    const validHeight = Number.isFinite(node.customHeight) && node.customHeight >= 100 && node.customHeight <= 5000;
    const normalized = {
      ...node,
      id,
      type: typeof node.type === 'string' && node.type.length <= 160 ? node.type : 'unsupported',
      title: typeof node.title === 'string' ? node.title.slice(0, 160) : 'Unsupported widget',
      x: validX ? node.x : defaultX,
      y: validY ? node.y : defaultY,
    };
    if (validWidth) normalized.customWidth = node.customWidth;
    else if (node.customWidth !== undefined) {
      delete normalized.customWidth;
      normalized.invalidDimensions = { ...normalized.invalidDimensions, customWidth: node.customWidth,
      };
    }
    if (validHeight) normalized.customHeight = node.customHeight;
    else if (node.customHeight !== undefined) {
      delete normalized.customHeight;
      normalized.invalidDimensions = { ...normalized.invalidDimensions, customHeight: node.customHeight,
      };
    }
    if (!isRecord) normalized.originalWidgetData = sourceNode;
    if (node.id != null && id !== node.id) normalized.originalWidgetId = node.id;
    if (typeof node.title === 'string' && node.title.length > 160) normalized.originalWidgetTitle = node.title;
    if (!validX || !validY) normalized.originalPosition = { x: node.x, y: node.y };
    return normalized;
  });
  const incomingConnections = Array.isArray(candidate.connections) ? candidate.connections : [];
  const connections = incomingConnections.filter((connection) =>
    connection && typeof connection === 'object' && !Array.isArray(connection)
    && typeof connection.fromId === 'string' && typeof connection.toId === 'string'
    && connection.fromId.length > 0 && connection.fromId.length <= 160
    && connection.toId.length > 0 && connection.toId.length <= 160
    && (connection.style == null || (typeof connection.style === 'string' && connection.style.length <= 32)),
  );
  const gridStyle = ['dots', 'lines', 'radial', 'blank'].includes(candidate.gridStyle) ? candidate.gridStyle : 'dots';
  const gridSize = Number.isFinite(candidate.gridSize) && candidate.gridSize >= 8 && candidate.gridSize <= 100 ? candidate.gridSize : 24;
  const gridOpacity = Number.isFinite(candidate.gridOpacity) && candidate.gridOpacity >= 0 && candidate.gridOpacity <= 0.5 ? candidate.gridOpacity : 0.08;
  const gridThickness = Number.isFinite(candidate.gridThickness) && candidate.gridThickness >= 0.25 && candidate.gridThickness <= 4 ? candidate.gridThickness : 1.2;
  const gridColorPreset = ['slate', 'blue', 'violet', 'indigo', 'cyan', 'rose', 'emerald'].includes(candidate.gridColorPreset,
  ) ? candidate.gridColorPreset : 'violet';
  const hasInvalidGrid = (candidate.gridStyle != null && gridStyle !== candidate.gridStyle)
    || (candidate.gridSize != null && gridSize !== candidate.gridSize)
    || (candidate.gridOpacity != null && gridOpacity !== candidate.gridOpacity)
    || (candidate.gridThickness != null && gridThickness !== candidate.gridThickness)
    || (candidate.gridColorPreset != null && gridColorPreset !== candidate.gridColorPreset);
  const schemaVersion = Number.isInteger(candidate.schemaVersion) && candidate.schemaVersion > 0 ? candidate.schemaVersion : 2;

  return {
    schemaVersion,
    nodes: parsedNodes,
    connections,
    gridStyle,
    gridSize,
    gridOpacity,
    gridThickness,
    gridColorPreset,
    ...(hasInvalidGrid ? { originalGridConfiguration: { gridStyle: candidate.gridStyle, gridSize: candidate.gridSize, gridOpacity: candidate.gridOpacity, gridThickness: candidate.gridThickness, gridColorPreset: candidate.gridColorPreset,
          },
        } : {}),
    ...(candidate.schemaVersion != null && schemaVersion !== candidate.schemaVersion ? { originalSchemaVersion: candidate.schemaVersion } : {}),
    ...(connections.length !== incomingConnections.length ? { originalInvalidConnections: incomingConnections.filter((connection) => !connections.includes(connection),
          ),
        } : {}),
  };
};

// Widget instances keep identity and placement separate from registry defaults.
const newNode = (type, x = 40, y = 40) => {
  const definition = getWidgetDefinition(type);
  if (!definition) throw new Error(`Widget type “${type}” is not registered.`);
  const defaults = definition.defaults;
  return {
    id: crypto.randomUUID(),
    type,
    x,
    y,
    title: defaults.title || 'Untitled Widget',
    content: defaults.content || '',
    size: defaults.size || definition.defaultSize || 'medium',
    color: defaults.color || 'slate',
    borderStyle: 'solid',
    fontSize: 'regular',
    headerStyle: 'simple',
    ...defaults,
  };
};

// --- Theme mappings ---

const cardColors = {
  slate:
    'border-slate-200/90 bg-white/95 text-slate-900 shadow-md dark:border-slate-800/80 dark:bg-slate-900/90 dark:text-slate-100',
  violet:
    'border-indigo-300/90 bg-gradient-to-br from-indigo-50/95 via-purple-50/90 to-indigo-100/70 text-slate-900 shadow-md shadow-indigo-500/10 dark:border-indigo-500/40 dark:bg-gradient-to-br dark:from-slate-900/95 dark:via-slate-900/90 dark:to-indigo-950/70 dark:text-indigo-100 ring-1 ring-indigo-500/25',
  emerald:
    'border-emerald-300/90 bg-gradient-to-br from-emerald-50/95 via-teal-50/90 to-emerald-100/70 text-slate-900 shadow-md shadow-emerald-500/10 dark:border-emerald-500/40 dark:bg-gradient-to-br dark:from-slate-900/95 dark:via-slate-900/90 dark:to-emerald-950/70 dark:text-emerald-100 ring-1 ring-emerald-500/25',
  rose:
    'border-rose-300/90 bg-gradient-to-br from-rose-50/95 via-pink-50/90 to-rose-100/70 text-slate-900 shadow-md shadow-rose-500/10 dark:border-rose-500/40 dark:bg-gradient-to-br dark:from-slate-900/95 dark:via-slate-900/90 dark:to-rose-950/70 dark:text-rose-100 ring-1 ring-rose-500/25',
  amber:
    'border-amber-300/90 bg-gradient-to-br from-amber-50/95 via-orange-50/90 to-amber-100/70 text-slate-900 shadow-md shadow-amber-500/10 dark:border-amber-500/40 dark:bg-gradient-to-br dark:from-slate-900/95 dark:via-slate-900/90 dark:to-amber-950/70 dark:text-amber-100 ring-1 ring-amber-500/25',
  indigo:
    'border-indigo-300/90 bg-gradient-to-br from-indigo-50/95 via-blue-50/90 to-indigo-100/70 text-slate-900 shadow-md shadow-indigo-500/10 dark:border-indigo-500/40 dark:bg-gradient-to-br dark:from-slate-900/95 dark:via-slate-900/90 dark:to-indigo-950/70 dark:text-indigo-100 ring-1 ring-indigo-500/25',
  cyan:
    'border-cyan-300/90 bg-gradient-to-br from-cyan-50/95 via-sky-50/90 to-cyan-100/70 text-slate-900 shadow-md shadow-cyan-500/10 dark:border-cyan-500/40 dark:bg-gradient-to-br dark:from-slate-900/95 dark:via-slate-900/90 dark:to-cyan-950/70 dark:text-cyan-100 ring-1 ring-cyan-500/25',
};

const textFonts = {
  regular: 'text-sm',
  medium: 'text-base font-medium',
  large: 'text-lg font-semibold',
};

const widgetIconComponents = {
  activity: Activity,
  zap: Zap,
  cpu: Cpu,
  chart: BarChart3,
  progress: Sparkles,
  status: CheckCircle,
  note: FileText,
  table: Table,
  timer: Timer,
  code: Code2,
  link: LinkIcon,
  image: ImageIcon,
  embed: Layers,
  divider: Minus,
};

const widgetIconColors = {
  metric: 'text-cyan-500',
  display: 'text-amber-500',
  logic: 'text-violet-500',
  chart: 'text-indigo-500',
  progress: 'text-rose-500',
  status: 'text-emerald-500',
  note: 'text-emerald-500',
  table: 'text-blue-500',
  timer: 'text-amber-500',
  code: 'text-indigo-500',
  link: 'text-cyan-500',
  image: 'text-fuchsia-500',
  embed: 'text-violet-500',
  divider: 'text-slate-400',
};

const safeExternalUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
};
const safeImageUrl = (value) => {
  if (typeof value === 'string' && /^data:image\/(?:png|jpeg|gif|webp|avif);base64,/i.test(value)) return value;
  if (typeof value === 'string' && value.startsWith('blob:')) return value;
  return safeExternalUrl(value);
};

export default function EditorPage() {
  const { workspaceId, dashboardId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const widgetDefinitions = useWidgetDefinitions();

  const dashboard = useQuery({
    queryKey: ['dashboard', dashboardId],
    queryFn: () => workspaceService.dashboard(dashboardId),
    enabled: Boolean(dashboardId),
  });
  const currentUser = useQuery({ queryKey: ['auth', 'me'], queryFn: authService.me, retry: false });
  const canEditDashboard = ['OWNER', 'ADMIN', 'EDITOR'].includes(dashboard.data?.accessRole) && dashboard.data?.status !== 'ARCHIVED';

  useEffect(() => {
    if (!location.state?.openComments) return;
    setLeftPanelOpen(true);
    setLeftPanelTab('comments');
    navigate(location.pathname, { replace: true, state: null });
  }, [location.key, location.pathname, location.state, navigate]);

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(true);
  const [leftPanelTab, setLeftPanelTab] = useState('elements');

  useEffect(() => {
    if (dashboard.isSuccess && !canEditDashboard && leftPanelTab !== 'comments') {
      setLeftPanelTab('comments');
    }
  }, [dashboard.isSuccess, canEditDashboard, leftPanelTab]);

  const [editingLayerId, setEditingLayerId] = useState(null);
  const [editingLayerTitle, setEditingLayerTitle] = useState('');

  const [leftPanelWidth, setLeftPanelWidth] = useState(() => {
    const saved = localStorage.getItem('voxel_left_panel_width');
    return saved ? Math.min(480, Math.max(220, parseInt(saved, 10))) : 288;
  });

  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    const saved = localStorage.getItem('voxel_right_panel_width');
    return saved ? Math.min(520, Math.max(260, parseInt(saved, 10))) : 320;
  });

  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);

  const handleLeftResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizingLeft(true);
    const startX = e.clientX;
    const startWidth = leftPanelWidth;

    const handlePointerMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.min(480, Math.max(220, startWidth + deltaX));
      setLeftPanelWidth(newWidth);
      localStorage.setItem('voxel_left_panel_width', newWidth.toString());
    };

    const handlePointerUp = () => {
      setIsResizingLeft(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [leftPanelWidth],
  );

  const handleRightResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizingRight(true);
    const startX = e.clientX;
    const startWidth = rightPanelWidth;

    const handlePointerMove = (moveEvent) => {
      const deltaX = startX - moveEvent.clientX;
      const newWidth = Math.min(520, Math.max(260, startWidth + deltaX));
      setRightPanelWidth(newWidth);
      localStorage.setItem('voxel_right_panel_width', newWidth.toString());
    };

    const handlePointerUp = () => {
      setIsResizingRight(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }, [rightPanelWidth],
  );
  const exportMenuRef = useRef(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [selectedNodeIds, setSelectedNodeIds] = useState([]);
  const selectedNodeId = selectedNodeIds.length === 1 ? selectedNodeIds[0] : null;
  const setSelectedNodeId = useCallback((id) => {
    if (!id) setSelectedNodeIds([]);
    else if (Array.isArray(id)) setSelectedNodeIds(id);
    else setSelectedNodeIds([id]);
  }, []);

  const handleSelectNode = useCallback((id, e) => {
    if (e && (e.metaKey || e.ctrlKey || e.shiftKey)) {
      setSelectedNodeIds((prev) =>
        prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
      );
    } else {
      setSelectedNodeIds([id]);
    }
  }, []);

  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: '',
    type: 'warning',
    onConfirm: null,
  });
  const gridRef = useRef(null);

  const canUndo = useHistoryStore((s) => s.past.length > 0);
  const canRedo = useHistoryStore((s) => s.future.length > 0);

  const { scene: yScene, updateScene, awareness, awarenessStates,
  } = useYjs(dashboardId, dashboard.data?.scene, currentUser.data);

  const onlineCollaborators = useMemo(
    () =>
      awarenessStates
        .filter(([, state]) => state.user?.id)
        .map(([clientId, state]) => ({
          clientId,
          ...state.user,
          isTyping: Boolean(state.typing),
          viewport: state.viewport,
        })),
    [awarenessStates],
  );

  const scene = useMemo(
    () => sceneOf(yScene || dashboard.data?.scene),
    [dashboard.data?.scene, yScene],
  );

  useEffect(() => {
    const focusNodeId = location.state?.focusNodeId;
    if (!focusNodeId || !scene.nodes.some((node) => node.id === focusNodeId)) return;
    setSelectedNodeIds([focusNodeId]);
    setRightPanelOpen(true);
    window.requestAnimationFrame(() => document.getElementById(`node-card-${focusNodeId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' }),
    );
    navigate(location.pathname, { replace: true, state: null });
  }, [location.pathname, location.state, navigate, scene.nodes]);

  const sceneRef = useRef(scene);
  sceneRef.current = scene;

  const handleRepositionCanvas = useCallback(() => {
    if (!gridRef.current) return;
    const container = gridRef.current;

    // First reset zoom to 1 so we measure at 1:1 scale
    setZoom(1);

    const nodes = scene?.nodes || [];

    // Run after zoom state update has been painted
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const boardSheet = container.firstElementChild;
        if (!boardSheet) return;

        // boardOriginX/Y = how many pixels of scroll are needed to reach the (0,0) of the board sheet.
        // This equals the container's left/top padding because the board sheet starts right after it.
        // We measure it live via offsetLeft/offsetTop of the board sheet.
        const boardOriginScrollLeft = boardSheet.offsetLeft;
        const boardOriginScrollTop = boardSheet.offsetTop;

        // Nodes are positioned inside a p-12 (48px) wrapper inside the board sheet
        const innerPad = 48;

        const containerW = container.clientWidth;
        const containerH = container.clientHeight;

        const getNodeWidth = (node) => {
          if (Number.isFinite(node.customWidth)) return node.customWidth;
          switch (node.size) {
            case 'small': return 220;
            case 'large': return 340;
            case 'wide': return 440;
            default: return 280;
          }
        };

        const getNodeHeight = (type) => {
          switch (type) {
            case 'image': return 240;
            case 'chart': return 220;
            case 'table': return 260;
            case 'code': return 220;
            case 'metric': return 160;
            default: return 180;
          }
        };

        let targetScrollLeft, targetScrollTop;

        if (nodes.length > 0) {
          const minX = Math.min(...nodes.map((n) => n.x ?? 40));
          const maxX = Math.max(...nodes.map((n) => (n.x ?? 40) + getNodeWidth(n)));
          const minY = Math.min(...nodes.map((n) => n.y ?? 40));
          const maxY = Math.max(...nodes.map((n) => (n.y ?? 40) + getNodeHeight(n.type)));

          // Center of the node bounding box in board-local coords
          const nodesCenterX = innerPad + (minX + maxX) / 2;
          const nodesCenterY = innerPad + (minY + maxY) / 2;

          // Scroll to put that center in the middle of the viewport
          targetScrollLeft = Math.max(0, Math.round(boardOriginScrollLeft + nodesCenterX - containerW / 2),
          );
          targetScrollTop  = Math.max(0, Math.round(boardOriginScrollTop  + nodesCenterY - containerH / 2),
          );
        } else {
          // No nodes – center the board sheet origin + 400/300 default offset
          targetScrollLeft = Math.max(0, Math.round(boardOriginScrollLeft + innerPad + 400 - containerW / 2),
          );
          targetScrollTop  = Math.max(0, Math.round(boardOriginScrollTop  + innerPad + 300 - containerH / 2),
          );
        }

        container.scrollTo({
          left: targetScrollLeft,
          top: targetScrollTop,
          behavior: 'smooth',
        });
      });
    });
  }, [scene?.nodes]);

  // Initial 360-degree scroll position centering
  useEffect(() => {
    const container = gridRef.current;
    if (!container) return;
    // Defer until the DOM has painted so offsetLeft/offsetTop are reliable
    requestAnimationFrame(() => {
      const boardSheet = container.firstElementChild;
      if (!boardSheet) return;

      const boardOriginScrollLeft = boardSheet.offsetLeft;
      const boardOriginScrollTop = boardSheet.offsetTop;
      const innerPad = 48;
      const containerW = container.clientWidth;
      const containerH = container.clientHeight;
      const nodes = dashboard.data?.scene?.nodes || [];

      const getNodeWidth = (node) => {
        if (Number.isFinite(node.customWidth)) return node.customWidth;
        switch (node.size) {
          case 'small': return 220;
          case 'large': return 340;
          case 'wide': return 440;
          default: return 280;
        }
      };

      const getNodeHeight = (type) => {
        switch (type) {
          case 'image': return 240;
          case 'chart': return 220;
          case 'table': return 260;
          case 'code': return 220;
          case 'metric': return 160;
          default: return 180;
        }
      };

      if (nodes.length > 0) {
        const minX = Math.min(...nodes.map((n) => n.x ?? 40));
        const maxX = Math.max(...nodes.map((n) => (n.x ?? 40) + getNodeWidth(n)));
        const minY = Math.min(...nodes.map((n) => n.y ?? 40));
        const maxY = Math.max(...nodes.map((n) => (n.y ?? 40) + getNodeHeight(n.type)));
        const nodesCenterX = innerPad + (minX + maxX) / 2;
        const nodesCenterY = innerPad + (minY + maxY) / 2;
        container.scrollLeft = Math.max(0, Math.round(boardOriginScrollLeft + nodesCenterX - containerW / 2),
        );
        container.scrollTop  = Math.max(0, Math.round(boardOriginScrollTop  + nodesCenterY - containerH / 2),
        );
      } else {
        container.scrollLeft = Math.max(0, Math.round(boardOriginScrollLeft + innerPad + 400 - containerW / 2),
        );
        container.scrollTop  = Math.max(0, Math.round(boardOriginScrollTop  + innerPad + 300 - containerH / 2),
        );
      }
    });
  }, [dashboard.data?.id]);

  const { autosaveEnabled, autosaveInterval, snapToGrid } = useSettingsStore();

  const [zoom, setZoom] = useState(1);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(2.0, parseFloat((prev + 0.1).toFixed(2))));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(0.25, parseFloat((prev - 0.1).toFixed(2))));
  }, []);

  const handleResetZoom = useCallback(() => {
    handleRepositionCanvas();
  }, [handleRepositionCanvas]);

  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  // Trackpad pinch gesture and mouse wheel zoom support across Chrome, Safari, and Firefox
  useEffect(() => {
    if (!dashboard.data) return;
    const gridEl = gridRef.current;
    if (!gridEl) return;

    let gestureStartZoom = 1;

    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY ? e.deltaY * -0.005 : (e.wheelDelta || 0) * 0.002;
        const next = Math.min(2.0, Math.max(0.25, zoomRef.current + delta));
        setZoom(parseFloat(next.toFixed(2)));
      }
    };

    const handleGestureStart = (e) => {
      e.preventDefault();
      gestureStartZoom = zoomRef.current;
    };

    const handleGestureChange = (e) => {
      e.preventDefault();
      const next = Math.min(2.0, Math.max(0.25, gestureStartZoom * e.scale));
      setZoom(parseFloat(next.toFixed(2)));
    };

    gridEl.addEventListener('wheel', handleWheel, { passive: false });
    gridEl.addEventListener('gesturestart', handleGestureStart, { passive: false });
    gridEl.addEventListener('gesturechange', handleGestureChange, { passive: false });

    return () => {
      gridEl.removeEventListener('wheel', handleWheel);
      gridEl.removeEventListener('gesturestart', handleGestureStart);
      gridEl.removeEventListener('gesturechange', handleGestureChange);
    };
  }, [dashboard.data]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target)) {
        setExportMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(scene, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${dashboard.data?.name || 'canvas'}-export.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    useNotificationStore.getState().add('Canvas exported as JSON blueprint successfully.', 'success');
  };

  const handleExportPNG = () => {
    if (!gridRef.current) return;
    try {
      const svg = gridRef.current.querySelector('svg');
      const xml = new XMLSerializer().serializeToString(svg || document.createElement('svg'));
      const svgBlob = new Blob([xml], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = gridRef.current.clientWidth || 1200;
        canvas.height = gridRef.current.clientHeight || 800;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#04060d' : '#f8fafc';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        const a = document.createElement('a');
        a.download = `${dashboard.data?.name || 'canvas'}-export.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
        useNotificationStore.getState().add('Canvas snapshot exported as PNG.', 'success');
      };
      img.src = url;
    } catch {
      useNotificationStore.getState().add('PNG export initiated.', 'info');
    }
  };

  const draft = useMemo(() => {
    if (!dashboard.data?.scene) return false;
    return JSON.stringify(scene) !== JSON.stringify(dashboard.data?.scene);
  }, [scene, dashboard.data?.scene]);

  const save = useMutation({
    mutationFn: (next) =>
      workspaceService.updateDashboard(dashboardId, {
        scene: next,
        version: dashboard.data.version,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId] });
    },
  });

  const addNode = (type) => {
    const definition = getWidgetDefinition(type);
    if (!definition) throw new Error(`Widget type “${type}” is not registered.`);
    const existingNodes = scene.nodes || [];

    // Node size/height approximations for collision detection (must match CanvasNodeCard widthOf/getH)
    const widths = { small: 220, medium: 280, large: 340, wide: 440 };
    const getW = (nodeOrSize) => typeof nodeOrSize === 'string'
      ? (widths[nodeOrSize] ?? 280)
      : (nodeOrSize.customWidth ?? widths[nodeOrSize.size] ?? 280);
    const heights = { image: 240, chart: 220, table: 260, code: 220, metric: 160, timer: 160, status: 160, link: 160,
    };
    const rendererOf = (nodeOrType) =>
      getWidgetDefinition(typeof nodeOrType === 'string' ? nodeOrType : nodeOrType.type)?.renderer;
    const getH = (nodeOrType) => typeof nodeOrType === 'string'
      ? (heights[rendererOf(nodeOrType)] ?? 180)
      : (nodeOrType.customHeight ?? heights[rendererOf(nodeOrType)] ?? 180);

    const incomingSize = definition.defaults.size || definition.defaultSize;

    const newW = getW(incomingSize);
    const newH = getH(type);
    const gap = 20;

    const overlaps = (cx, cy) =>
      existingNodes.some((n) => {
        const nx = n.x ?? 40;
        const ny = n.y ?? 40;
        const nw = getW(n);
        const nh = getH(n);
        return (
          cx < nx + nw + gap &&
          cx + newW + gap > nx &&
          cy < ny + nh + gap &&
          cy + newH + gap > ny
        );
      });

    const findFreePosition = () => {
      if (existingNodes.length === 0) return { x: 40, y: 40 };

      const minX = Math.min(...existingNodes.map((n) => n.x ?? 40));
      const minY = Math.min(...existingNodes.map((n) => n.y ?? 40));
      const maxX = Math.max(...existingNodes.map((n) => (n.x ?? 40) + getW(n)));
      const maxY = Math.max(...existingNodes.map((n) => (n.y ?? 40) + getH(n)));

      // Cluster center – used to sort candidates by proximity so nodes fill 2D space
      const clusterCX = (minX + maxX) / 2;
      const clusterCY = (minY + maxY) / 2;

      const colW = newW + gap;
      const rowH = newH + gap;

      // Build a wide 2D grid of candidate positions around the cluster.
      // Rows go from -5 (above) to +8 (below); cols from -3 (left) to +10 (right).
      // Each candidate's slot origin is aligned to the cluster top-left.
      const candidates = [];
      for (let row = -5; row <= 8; row++) {
        for (let col = -3; col <= 10; col++) {
          const cx = Math.max(40, minX + col * colW);
          const cy = Math.max(40, minY + row * rowH);
          // Distance of the candidate's center from the cluster center
          const dist = Math.hypot(cx + newW / 2 - clusterCX, cy + newH / 2 - clusterCY);
          candidates.push({ x: cx, y: cy, dist });
        }
      }

      // Sort by distance so the nearest free slot wins — fills all directions evenly
      candidates.sort((a, b) => a.dist - b.dist);

      for (const { x, y } of candidates) {
        if (!overlaps(x, y)) return { x, y };
      }

      // Hard fallback: place beyond the bottom-right edge
      return { x: maxX + gap, y: maxY + gap };
    };

    const { x, y } = findFreePosition();

    const newNodeId = crypto.randomUUID();
    const newNodeObj = {
      ...definition.defaults,
      id: newNodeId,
      type,
      title: definition.defaults.title || definition.title,
      content: definition.defaults.content ?? '',
      size: incomingSize,
      x,
      y,
      borderStyle: definition.defaults.borderStyle || 'solid',
      fontSize: definition.defaults.fontSize || 'regular',
      color: definition.defaults.color || 'slate',
    };

    update({ ...scene, nodes: [...scene.nodes, newNodeObj] });
    setSelectedNodeId(newNodeId);
  };


  const loadPreset = (presetKey) => {
    if (!presetKey) return;
    if (scene.nodes.length > 0) {
      setConfirmModal({
        isOpen: true,
        title: 'Overwrite Current Layout?',
        message: 'Are you sure you want to load this preset template? It will replace all nodes in your current canvas.',
        confirmText: 'Load Preset',
        type: 'warning',
        onConfirm: () => {
          setConfirmModal({ isOpen: false });
          executeLoadPreset(presetKey);
        },
        onCancel: () => setConfirmModal({ isOpen: false }),
      });
    } else {
      executeLoadPreset(presetKey);
    }
  };

  // Templates implementation
  const executeLoadPreset = (preset) => {
    const apiStatusId = crypto.randomUUID();
    const latencyId = crypto.randomUUID();
    const chartId = crypto.randomUUID();
    const noteId = crypto.randomUUID();

    let newNodes = [];
    let newConns = [];

    if (preset === 'server') {
      newNodes = [
        {
          id: apiStatusId,
          type: 'status',
          title: 'Core API Gateway',
          content: 'Operational',
          statusColor: 'success',
          size: 'small',
          color: 'emerald',
          borderStyle: 'glow',
          x: 40,
          y: 40,
        },
        {
          id: latencyId,
          type: 'metric',
          title: 'Request Latency',
          content: '14.5',
          unit: 'ms',
          size: 'small',
          color: 'cyan',
          borderStyle: 'solid',
          x: 320,
          y: 40,
        },
        {
          id: chartId,
          type: 'chart',
          title: 'Incoming Traffic (24h)',
          content: '12,24,18,32,45,28,38',
          size: 'medium',
          color: 'violet',
          borderStyle: 'solid',
          x: 40,
          y: 220,
        },
        {
          id: noteId,
          type: 'note',
          title: 'Ops Incident Diary',
          content:
            '- Core API health is green.\n- Load balancer replicas are in sync.\n- RAM usage spike investigated and cleared.',
          size: 'wide',
          color: 'slate',
          borderStyle: 'dashed',
          x: 40,
          y: 480,
        },
      ];
      newConns = [{ fromId: apiStatusId, toId: latencyId, style: 'pulsing' }];
    } else if (preset === 'business') {
      const salesId = crypto.randomUUID();
      const goalId = crypto.randomUUID();
      const trendId = crypto.randomUUID();
      newNodes = [
        {
          id: salesId,
          type: 'metric',
          title: 'Gross MRR Sales',
          content: '14800',
          unit: '$',
          size: 'medium',
          color: 'emerald',
          borderStyle: 'glow',
          x: 40,
          y: 40,
        },
        {
          id: goalId,
          type: 'progress',
          title: 'Q3 Sales Goal',
          content: '14800',
          target: 20000,
          size: 'medium',
          color: 'amber',
          borderStyle: 'solid',
          x: 350,
          y: 40,
        },
        {
          id: trendId,
          type: 'chart',
          title: 'Weekly Profit Margin',
          content: '1100,1250,1190,1450,1950,1850,2300',
          size: 'large',
          color: 'indigo',
          borderStyle: 'solid',
          x: 40,
          y: 280,
        },
      ];
      newConns = [{ fromId: salesId, toId: goalId, style: 'glowing' }];
    } else if (preset === 'devhub') {
      const codeId = crypto.randomUUID();
      const linkId = crypto.randomUUID();
      newNodes = [
        {
          id: codeId,
          type: 'code',
          title: 'Base API Controller',
          code: 'class BaseController {\n  static async index(req, res) {\n    return res.status(200).json({ status: "ok" });\n  }\n}',
          language: 'javascript',
          size: 'large',
          color: 'slate',
          borderStyle: 'solid',
          x: 40,
          y: 40,
        },
        {
          id: linkId,
          type: 'link',
          title: 'Repository Wiki',
          url: 'https://github.com',
          description: 'Access the main developers guidelines, deployment instructions, and API docs.',
          size: 'medium',
          color: 'cyan',
          borderStyle: 'solid',
          x: 420,
          y: 40,
        },
        {
          id: crypto.randomUUID(),
          type: 'divider',
          title: 'Development Links',
          dividerStyle: 'dashed',
          size: 'wide',
          color: 'slate',
          x: 40,
          y: 340,
        },
      ];
    } else if (preset === 'ops') {
      const tableId = crypto.randomUUID();
      const timerId = crypto.randomUUID();
      newNodes = [
        {
          id: tableId,
          type: 'table',
          title: 'Active Operations List',
          columns: 'Task,Assignee,Priority',
          rows: 'Redis Scaling,Alice,High\nLoki Logs Config,Bob,Medium\nPrisma Migration,Guest,High',
          size: 'large',
          color: 'slate',
          borderStyle: 'solid',
          x: 40,
          y: 40,
        },
        {
          id: timerId,
          type: 'timer',
          title: 'Maintenance Countdown',
          duration: 600,
          timerMode: 'countdown',
          timerState: 'idle',
          size: 'medium',
          color: 'amber',
          borderStyle: 'glow',
          x: 420,
          y: 40,
        },
      ];
    } else {
      const g1Id = crypto.randomUUID();
      const g2Id = crypto.randomUUID();
      newNodes = [
        {
          id: g1Id,
          type: 'note',
          title: 'Sprint Backlog Tasks',
          content:
            '- Integrate customizable workspace grid.\n- Polish CSS colors and drop shadow settings.\n- Implement logic nodes calculations.',
          size: 'large',
          color: 'violet',
          borderStyle: 'solid',
          x: 40,
          y: 40,
        },
        {
          id: g2Id,
          type: 'progress',
          title: 'Tasks Finished',
          content: '65',
          target: 100,
          size: 'medium',
          color: 'emerald',
          borderStyle: 'glow',
          x: 420,
          y: 40,
        },
        {
          id: crypto.randomUUID(),
          type: 'status',
          title: 'Production Sync',
          content: 'Active Deploy',
          statusColor: 'warning',
          size: 'small',
          color: 'cyan',
          borderStyle: 'dashed',
          x: 420,
          y: 260,
        },
      ];
    }

    update({
      schemaVersion: 2,
      nodes: newNodes,
      connections: newConns,
      gridStyle: 'dots',
    });
  };

  // Helper to resolve node value, recursively evaluating connected aggregation formulas or math nodes
  const resolveNodeValue = (node, visited = new Set()) => {
    if (visited.has(node.id)) return '0';
    const nextVisited = new Set(visited);
    nextVisited.add(node.id);

    if (getWidgetDefinition(node.type)?.renderer === 'logic') {
      return resolveMath(node, nextVisited).toString();
    }

    if (node.valueSource === 'connections') {
      const incoming = scene.connections.filter((c) => c.toId === node.id);
      const sourceNodes = incoming
        .map((c) => scene.nodes.find((n) => n.id === c.fromId))
        .filter((n) => Boolean(n));
      if (sourceNodes.length === 0) return '0';

      const values = sourceNodes.map((n) => parseFloat(resolveNodeValue(n, nextVisited)) || 0);
      const op = node.aggregationOperator || 'sum';

      let result = 0;
      if (op === 'sum') {
        result = values.reduce((sum, val) => sum + val, 0);
      } else if (op === 'avg') {
        result = values.reduce((sum, val) => sum + val, 0) / values.length;
      } else if (op === 'prod') {
        result = values.reduce((prod, val) => prod * val, 1);
      } else if (op === 'min') {
        result = Math.min(...values);
      } else if (op === 'max') {
        result = Math.max(...values);
      }
      return Number.isInteger(result) ? result.toString() : result.toFixed(2);
    }

    return node.content;
  };

  // Helper to calculate custom Math nodes dynamically
  const resolveMath = (node, visited = new Set()) => {
    if (visited.has(node.id)) return 0;
    const nextVisited = new Set(visited);
    nextVisited.add(node.id);

    const resolve = (val) => {
      if (!val) return 0;
      const ref = scene.nodes.find((n) => n.id === val);
      if (ref) {
        const parsed = parseFloat(resolveNodeValue(ref, nextVisited));
        return isNaN(parsed) ? 0 : parsed;
      }
      const parsed = parseFloat(val);
      return isNaN(parsed) ? 0 : parsed;
    };

    const a = resolve(node.logicA);
    const b = resolve(node.logicB);
    switch (node.logicOp) {
      case '+':
        return a + b;
      case '-':
        return a - b;
      case '*':
        return a * b;
      case '/':
        return b !== 0 ? a / b : 0;
      default:
        return 0;
    }
  };

  // Dynamic Grid Background Inline Styles
  const gridStyleInline = useMemo(() => {
    const colorPresets = {
      slate: '148, 163, 184',
      blue: '59, 130, 246',
      violet: '139, 92, 246',
      indigo: '99, 102, 241',
      cyan: '6, 182, 212',
      rose: '244, 63, 94',
      emerald: '16, 185, 129',
    };
    const preset = scene.gridColorPreset ?? 'violet';
    const rgb = colorPresets[preset] || '139, 92, 246';
    const opacity = scene.gridOpacity ?? 0.08;
    const thickness = scene.gridThickness ?? 1.2;
    const size = scene.gridSize ?? 24;
    switch (scene.gridStyle) {
      case 'dots':
        return {
          backgroundImage: `radial-gradient(circle, rgba(${rgb}, ${opacity}) ${thickness}px, transparent ${thickness + 0.5}px)`,
          backgroundSize: `${size}px ${size}px`,
        };
      case 'lines':
        return {
          backgroundImage: `linear-gradient(to right, rgba(${rgb}, ${opacity}) ${thickness}px, transparent ${thickness}px), linear-gradient(to bottom, rgba(${rgb}, ${opacity}) ${thickness}px, transparent ${thickness}px)`,
          backgroundSize: `${size}px ${size}px`,
        };
      case 'radial':
        return {
          backgroundImage: `radial-gradient(circle at center, rgba(${rgb}, ${Math.min(1, opacity * 4)}) 0%, transparent 85%)`,
        };
      default:
        return {};
    }
  }, [
    scene.gridStyle,
    scene.gridColorPreset,
    scene.gridOpacity,
    scene.gridSize,
    scene.gridThickness,
  ]);






  const update = (next, skipHistory = false) => {
    if (!canEditDashboard) return;
    if (!skipHistory) {
      useHistoryStore.getState().push(sceneRef.current);
    }
    updateScene(next);
  };

  // Autosave Engine respecting user settings
  useEffect(() => {
    if (!autosaveEnabled || !draft || save.isPending) return;
    const delay =
      autosaveInterval === '5s' ? 5000 : autosaveInterval === '30s' ? 30000 : 1200;
    const timer = setTimeout(() => {
      save.mutate(scene);
    }, delay);
    return () => clearTimeout(timer);
  }, [scene, draft, autosaveEnabled, autosaveInterval, save]);

  // Sync selectedNodeId to awareness
  useEffect(() => {
    if (!awareness) return;
    awareness.setLocalStateField('selectedNodeId', selectedNodeId);
  }, [awareness, selectedNodeId]);

  const handlePointerMove = useCallback((e) => {
    if (!awareness) return;
    const scrollContainer = gridRef.current;
    if (!scrollContainer) return;
    const rect = scrollContainer.getBoundingClientRect();
    const point = pointerToCanvasPoint(
        e.clientX,
        e.clientY,
        rect,
        scrollContainer.scrollLeft,
        scrollContainer.scrollTop,
        zoom,
      );
      awareness.setLocalStateField('cursor', point);
    },
    [awareness, zoom],
  );

  const handlePointerLeave = useCallback(() => {
    if (!awareness) return;
    awareness.setLocalStateField('cursor', null);
  }, [awareness]);

  const handleViewportChange = useCallback(() => {
    if (!awareness || !gridRef.current) return;
    const viewport = gridRef.current;
    const visibleCanvas = getCanvasViewport(
      viewport.scrollLeft,
      viewport.scrollTop,
      viewport.clientWidth,
      viewport.clientHeight,
      zoom,
    );
    awareness.setLocalStateField(
      'viewport',
      Object.fromEntries(
        Object.entries(visibleCanvas).map(([key, value]) => [key, Math.round(value)]),
      ),
    );
  }, [awareness, zoom]);

  useEffect(() => {
    handleViewportChange();
  }, [handleViewportChange, dashboard.isSuccess]);

  const handleEditorFocus = useCallback(
    (event) => {
      if (!awareness) return;
      const target = event.target;
      const isTextEntry =
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.matches(
            'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]), textarea',
          ));
      awareness.setLocalStateField('typing', Boolean(isTextEntry));
    },
    [awareness],
  );

  const handleEditorBlur = useCallback((event) => {
    if (!awareness) return;
      const nextTarget = event.relatedTarget;
      const remainsInTextEntry =
        nextTarget instanceof HTMLElement &&
        (nextTarget.isContentEditable ||
          nextTarget.matches(
            'input:not([type="checkbox"]):not([type="radio"]):not([type="button"]), textarea',
          ));
      awareness.setLocalStateField('typing', Boolean(remainsInTextEntry));
  }, [awareness],
  );

  const handleUndo = useCallback(() => {
    const prev = useHistoryStore.getState().undo(scene);
    if (prev) {
      updateScene(prev);
    }
  }, [scene, updateScene]);

  const handleRedo = useCallback(() => {
    const next = useHistoryStore.getState().redo(scene);
    if (next) {
      updateScene(next);
    }
  }, [scene, updateScene]);

  const copiedNodesRef = useRef([]);

  const handleCopy = () => {
    if (selectedNodeIds.length === 0) return;
    const selected = scene.nodes.filter((n) => selectedNodeIds.includes(n.id));
    if (selected.length > 0) {
      copiedNodesRef.current = selected;
      localStorage.setItem('voxel_copied_nodes', JSON.stringify(selected));
      useNotificationStore.getState().add(`Copied ${selected.length} ${selected.length === 1 ? 'node' : 'nodes'}.`, 'info');
    }
  };

  const handlePaste = () => {
    let rawList = copiedNodesRef.current;
    if (!rawList || rawList.length === 0) {
      try {
        const stored = localStorage.getItem('voxel_copied_nodes') || localStorage.getItem('voxel_copied_node');
        if (stored) {
          const parsed = JSON.parse(stored);
          rawList = Array.isArray(parsed) ? parsed : [parsed];
        }
      } catch (_err) {
        // ignore
      }
    }
    if (!rawList || rawList.length === 0) return;
    const newNodes = rawList.map((raw) => ({
      ...raw,
      id: crypto.randomUUID(),
      x: (raw.x ?? 100) + 30,
      y: (raw.y ?? 100) + 30,
    }));
    update({
      ...scene,
      nodes: [...scene.nodes, ...newNodes],
    });
    setSelectedNodeIds(newNodes.map((n) => n.id));
    useNotificationStore.getState().add(`Pasted ${newNodes.length} ${newNodes.length === 1 ? 'node' : 'nodes'}.`, 'info');
  };

  const handleDeleteSelected = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    const idsToDelete = [...selectedNodeIds];
    const idSet = new Set(idsToDelete);
    const nextNodes = scene.nodes.filter((n) => !idSet.has(n.id));
    const nextConnections = scene.connections.filter(
      (c) => !idSet.has(c.fromId) && !idSet.has(c.toId),
    );
    update({
      ...scene,
      nodes: nextNodes,
      connections: nextConnections,
    });
    setSelectedNodeIds([]);
    useNotificationStore.getState().add(`Deleted ${idsToDelete.length} ${idsToDelete.length === 1 ? 'node' : 'nodes'}.`, 'info');
  }, [selectedNodeIds, scene, update]);

  const handleSelectAll = useCallback((e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (scene.nodes && scene.nodes.length > 0) {
      setSelectedNodeIds(scene.nodes.map((n) => n.id));
      useNotificationStore.getState().add(`Selected all ${scene.nodes.length} nodes.`, 'info');
    }
  }, [scene?.nodes],
  );

  const alignSelectedNodes = (mode) => {
    if (!canEditDashboard || selectedNodeIds.length < 2) return;
    const selected = scene.nodes.filter((node) => selectedNodeIds.includes(node.id));
    const boxes = selected.map((node) => {
      const element = document.getElementById(`node-card-${node.id}`);
      const width = element?.offsetWidth || node.customWidth ||
        { small: 220, medium: 280, large: 340, wide: 440 }[node.size] || 280;
      const height = element?.offsetHeight || node.customHeight || 180;
      return {
        node,
        left: node.x ?? 40,
        top: node.y ?? 40,
        right: (node.x ?? 40) + width,
        bottom: (node.y ?? 40) + height,
        width,
        height,
      };
    });
    const horizontal = ['left', 'center', 'right'].includes(mode);
    const startKey = horizontal ? 'left' : 'top';
    const endKey = horizontal ? 'right' : 'bottom';
    const sizeKey = horizontal ? 'width' : 'height';
    const low = Math.min(...boxes.map((box) => box[startKey]));
    const high = Math.max(...boxes.map((box) => box[endKey]));
    const target = mode === 'left' || mode === 'top' ? low : mode === 'right' || mode === 'bottom' ? high : (low + high) / 2;
    const nextNodes = scene.nodes.map((node) => {
      if (!selectedNodeIds.includes(node.id)) return node;
      const box = boxes.find((candidate) => candidate.node.id === node.id);
      const position = mode === 'left' || mode === 'top' ? target : mode === 'right' || mode === 'bottom' ? target - box[sizeKey] : target - box[sizeKey] / 2;
      return horizontal ? { ...node, x: Math.round(position) } : { ...node, y: Math.round(position) };
    });
    update({ ...scene, nodes: nextNodes });
    useNotificationStore.getState().add(`Aligned ${selected.length} widgets ${mode}.`, 'info');
  };

  const handleSave = () => {
    if (yScene) {
      save.mutate(scene);
    }
  };

  const handleRestoreVersion = (ver) => {
    if (!ver?.scene) return;
    setConfirmModal({
      isOpen: true,
      title: `Revert to Version #${ver.version}?`,
      message: `Are you sure you want to revert your current canvas layout to Version #${ver.version}? A new version checkpoint will be recorded in history.`,
      confirmText: `Revert to #${ver.version}`,
      type: 'warning',
      onConfirm: () => {
        setConfirmModal({ isOpen: false });
        update(ver.scene);
        save.mutate(ver.scene);
      },
      onCancel: () => setConfirmModal({ isOpen: false }),
    });
  };

  // Keyboard shortcut registrations
  useShortcut('meta+z', handleUndo, { label: 'Undo change', category: 'Editor', allowInInput: true }, [scene],
  );
  useShortcut('meta+shift+z', handleRedo, { label: 'Redo change', category: 'Editor', allowInInput: true }, [scene],
  );
  useShortcut('meta+y', handleRedo, { label: 'Redo change', category: 'Editor', allowInInput: true }, [scene],
  );
  useShortcut('meta+a', handleSelectAll, { label: 'Select all nodes', category: 'Editor' }, [scene?.nodes,
  ]);
  useShortcut('meta+c', handleCopy, { label: 'Copy selected node(s)', category: 'Editor' }, [selectedNodeIds, scene,
  ]);
  useShortcut('meta+v', handlePaste, { label: 'Paste copied node(s)', category: 'Editor' }, [scene,
  ]);
  useShortcut('backspace', handleDeleteSelected, { label: 'Delete selected node(s)', category: 'Editor' }, [selectedNodeIds, scene],
  );
  useShortcut('delete', handleDeleteSelected, { label: 'Delete selected node(s)', category: 'Editor' }, [selectedNodeIds, scene],
  );
  useShortcut('meta+s', handleSave, { label: 'Save dashboard changes', category: 'Editor', allowInInput: true }, [yScene, scene],
  );
  useShortcut('meta+=', handleZoomIn, { label: 'Zoom In', category: 'Editor' }, []);
  useShortcut('meta+-', handleZoomOut, { label: 'Zoom Out', category: 'Editor' }, []);
  useShortcut('meta+0', handleResetZoom, { label: 'Reset Zoom', category: 'Editor' }, []);

  const add = (type) => {
    const existingNodes = scene.nodes || [];

    // Node width & height approximations for collision detection
    const widths = { small: 220, medium: 280, large: 340, wide: 440 };
    const getW = (nodeOrSize) => typeof nodeOrSize === 'string'
      ? (widths[nodeOrSize] ?? 280)
      : (nodeOrSize.customWidth ?? widths[nodeOrSize.size] ?? 280);
    const heights = { image: 240, chart: 220, table: 260, code: 220, metric: 160 };
    const getH = (nodeOrType) => typeof nodeOrType === 'string'
      ? (heights[nodeOrType] ?? 180)
      : (nodeOrType.customHeight ?? heights[nodeOrType.type] ?? 180);

    const incomingSize = {
      note: 'wide', metric: 'medium', progress: 'medium', chart: 'medium',
      status: 'small', logic: 'medium', image: 'medium', embed: 'wide',
      table: 'wide', timer: 'medium', link: 'medium', divider: 'wide', code: 'wide',
    }[type] ?? 'medium';
    const newW = getW(incomingSize);
    const newH = getH(type);
    const gap = 20; // gap between cards

    /**
     * Tests whether a candidate rect (cx, cy, cw, ch) overlaps any existing node.
     */
    const overlaps = (cx, cy, cw, ch) => {
      return existingNodes.some((n) => {
        const nx = n.x ?? 40;
        const ny = n.y ?? 40;
        const nw = getW(n);
        const nh = getH(n);
        // AABB overlap check with gap buffer
        return cx < nx + nw + gap &&
          cx + cw + gap > nx &&
          cy < ny + nh + gap &&
          cy + ch + gap > ny;
      });
    };

    /**
     * Find a clear position using a spiral scan over a virtual grid.
     * Start from top-left of the node cluster and scan rightward then downward.
     */
    const findFreePosition = () => {
      if (existingNodes.length === 0) return { x: 40, y: 40 };

      const minX = Math.min(...existingNodes.map((n) => n.x ?? 40));
      const minY = Math.min(...existingNodes.map((n) => n.y ?? 40));
      const maxX = Math.max(...existingNodes.map((n) => (n.x ?? 40) + getW(n)));
      const maxY = Math.max(...existingNodes.map((n) => (n.y ?? 40) + getH(n)));

      const clusterCX = (minX + maxX) / 2;
      const clusterCY = (minY + maxY) / 2;

      const colW = newW + gap;
      const rowH = newH + gap;

      const candidates = [];
      for (let row = -5; row <= 8; row++) {
        for (let col = -3; col <= 10; col++) {
          const cx = Math.max(40, minX + col * colW);
          const cy = Math.max(40, minY + row * rowH);
          const dist = Math.hypot(cx + newW / 2 - clusterCX, cy + newH / 2 - clusterCY);
          candidates.push({ x: cx, y: cy, dist });
        }
      }

      candidates.sort((a, b) => a.dist - b.dist);

      for (const { x, y } of candidates) {
        if (!overlaps(x, y, newW, newH)) return { x, y };
      }

      return { x: maxX + gap, y: maxY + gap };
    };

    const { x, y } = findFreePosition();
    update({ ...scene, nodes: [...scene.nodes, newNode(type, x, y)] });
    setPickerOpen(false);
  };

  const handleDragStart = (e, nodeId) => {
    if (e.button !== 0 || !canEditDashboard) return;
    e.preventDefault();

    const currentScene = sceneRef.current;
    const startScene = JSON.parse(JSON.stringify(currentScene));

    const draggedNode = currentScene.nodes.find((n) => n.id === nodeId);
    if (!draggedNode) return;

    // If dragging a node that is among selected nodes, drag all selected nodes together
    const isMultiDrag = selectedNodeIds.includes(nodeId) && selectedNodeIds.length > 1;
    const dragNodeIds = isMultiDrag ? selectedNodeIds : [nodeId];

    const initialPositions = {};
    currentScene.nodes.forEach((n) => {
      if (dragNodeIds.includes(n.id)) {
        initialPositions[n.id] = { x: n.x ?? 100, y: n.y ?? 100 };
      }
    });

    const startX = e.clientX;
    const startY = e.clientY;

    let hasDragged = false;
    let rafId = null;

    const handleMouseMove = (moveEvent) => {
      const dist = Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY);
      if (!hasDragged && dist > 3) {
        hasDragged = true;
      }

      if (!hasDragged) return;

      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const currentZoom = zoomRef.current || 1;
        const dx = (moveEvent.clientX - startX) / currentZoom;
        const dy = (moveEvent.clientY - startY) / currentZoom;

        const current = sceneRef.current;
        update(
          {
            ...current,
            nodes: current.nodes.map((n) => {
              if (initialPositions[n.id]) {
                return {
                  ...n,
                  x: snapToGrid
                    ? Math.round((initialPositions[n.id].x + dx) / (current.gridSize || 24)) * (current.gridSize || 24)
                    : Math.round(initialPositions[n.id].x + dx),
                  y: snapToGrid
                    ? Math.round((initialPositions[n.id].y + dy) / (current.gridSize || 24)) * (current.gridSize || 24)
                    : Math.round(initialPositions[n.id].y + dy),
                };
              }
              return n;
            }),
          },
          true,
        );
      });
    };

    const handleMouseUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (hasDragged) {
        useHistoryStore.getState().push(startScene);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleResizeStart = (e, nodeId) => {
    if (e.button !== 0 || !canEditDashboard) return;
    e.preventDefault();
    e.stopPropagation();
    const startScene = structuredClone(sceneRef.current);
    const node = startScene.nodes.find((item) => item.id === nodeId);
    if (!node) return;
    const cardBounds = e.currentTarget.parentElement.getBoundingClientRect();
    const initialWidth = node.customWidth ?? cardBounds.width;
    const initialHeight = node.customHeight ?? cardBounds.height;
    const startX = e.clientX;
    const startY = e.clientY;
    let hasResized = false;
    let rafId = null;

    const handleMouseMove = (moveEvent) => {
      if (Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) > 3) hasResized = true;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const currentZoom = zoomRef.current || 1;
        const width = Math.max(180, Math.round(initialWidth + (moveEvent.clientX - startX) / currentZoom),
        );
        const height = Math.max(100, Math.round(initialHeight + (moveEvent.clientY - startY) / currentZoom),
        );
        updateNode(nodeId, { customWidth: width, customHeight: height }, true);
      });
    };

    const handleMouseUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (hasResized) useHistoryStore.getState().push(startScene);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const updateNode = (id, updates, skipHistory = false) => {
    const current = sceneRef.current;
    let invalidConfiguration = null;
    const nextNodes = current.nodes.map((node) => {
      if (node.id !== id) return node;
      const nextNode = { ...node, ...updates };
      if (getWidgetDefinition(node.type)) {
        const validation = validateWidgetConfiguration(node.type, nextNode);
        if (!validation.success) {
          invalidConfiguration = validation.error;
          return node;
        }
      }
      return nextNode;
    });
    if (invalidConfiguration) {
      useNotificationStore.getState().add(invalidConfiguration, 'warning');
      return;
    }
    update({ ...current, nodes: nextNodes }, skipHistory);
  };

  const handleKeyboardMove = (event, nodeId) => {
    if (!canEditDashboard || !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    const current = sceneRef.current;
    const node = current.nodes.find((item) => item.id === nodeId);
    if (!node) return;
    const step = event.shiftKey ? 50 : snapToGrid ? current.gridSize || 24 : 10;
    updateNode(nodeId, {
      x: (node.x ?? 40) + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
      y: (node.y ?? 40) + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
    });
  };

  const deleteNode = (id) => {
    update({
      ...scene,
      nodes: scene.nodes.filter((node) => node.id !== id),
      connections: scene.connections.filter((c) => c.fromId !== id && c.toId !== id),
    });
    setSelectedNodeId(null);
  };

  const addConnection = (fromId, toId) => {
    if (fromId === toId) return;
    if (scene.connections.some((c) => c.fromId === fromId && c.toId === toId)) return;
    update({ ...scene, connections: [...scene.connections, { fromId, toId, style: 'solid' }] });
  };

  const deleteConnection = (index) => {
    update({ ...scene, connections: scene.connections.filter((_, i) => i !== index) });
  };

  if (!workspaceId || !dashboardId) return null;
  if (dashboard.isPending) return <EditorSkeleton />;
  if (dashboard.isError || !dashboard.data)
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        This dashboard could not be loaded.
      </div>
    );

  return (
    <section className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-50 dark:bg-[#030509]"
      onFocusCapture={handleEditorFocus}
      onBlurCapture={handleEditorBlur}
    >
      <style>{`
        .no-scrollbars::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbars {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>

      {/* --- CANVAS HEADER --- */}
      <header className="flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl dark:border-white/10 dark:bg-[#070b14]/90 relative z-30 select-none shadow-xs">
        {/* Left Section: Back button, Logo, Title, File Menu Dropdown */}
        <div className="flex items-center gap-3">
          <Link
            to={`/workspaces/${workspaceId}/dashboards`}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/10 dark:hover:text-slate-200 transition cursor-pointer"
            title="Back to Dashboards"
          >
            <ArrowLeft size={16} />
          </Link>

          <div className="size-7 rounded-lg bg-gradient-to-br from-violet-600 via-indigo-600 to-cyan-500 grid place-items-center text-white font-extrabold text-xs shadow-xs shrink-0">
            V
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold text-slate-900 dark:text-white leading-none">
                {dashboard.data?.name || 'Dashboard'}
              </h1>
              <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[9px] font-extrabold text-violet-600 dark:text-violet-400 uppercase tracking-widest border border-violet-500/20">
                Freeform
              </span>
            </div>
          </div>
        </div>

        {/* Right Section: Toolbar Controls & Panel Toggles */}
        <div className="flex items-center gap-2">
          {/* Undo / Redo */}
          <div className="flex items-center border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden bg-slate-50 dark:bg-white/5">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo (⌘Z)"
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10 disabled:opacity-30 transition cursor-pointer"
            >
              <Undo2 size={14} />
            </button>
            <div className="w-px h-3.5 bg-slate-200 dark:bg-white/10" />
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo (⌘⇧Z)"
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10 disabled:opacity-30 transition cursor-pointer"
            >
              <Redo2 size={14} />
            </button>
          </div>

          {/* Version History Toggle */}
          <button
            onClick={() => {
              setVersionHistoryOpen((prev) => !prev);
              setSelectedNodeId(null);
            }}
            title="Version History"
            className={`p-1.5 rounded-xl border transition cursor-pointer ${
              versionHistoryOpen
                ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400'
                : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <Clock size={15} />
          </button>

          {/* Left Panel Toggle (Canva / Figma Assets Panel) */}
          <button
            onClick={() => setLeftPanelOpen((prev) => !prev)}
            title="Toggle Left Assets Panel"
            className={`p-1.5 rounded-xl border transition cursor-pointer ${
              leftPanelOpen
                ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400'
                : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <Layers size={15} />
          </button>

          {/* Right Inspector Toggle */}
          <button
            onClick={() => setRightPanelOpen((prev) => !prev)}
            title="Toggle Right Inspector Panel"
            className={`p-1.5 rounded-xl border transition cursor-pointer ${
              rightPanelOpen
                ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400'
                : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
            }`}
          >
            <SlidersHorizontal size={15} />
          </button>

          {/* Export Dropdown Menu */}
          <div className="relative" ref={exportMenuRef}>
            <button
              onClick={() => setExportMenuOpen(!exportMenuOpen)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition cursor-pointer ${
                exportMenuOpen
                  ? 'border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400'
                  : 'border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <Download size={14} className="text-cyan-500" />
              <span>Export</span>
              <ChevronDown size={13} className={`transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {exportMenuOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white/95 dark:bg-[#0e1320]/95 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-xl rounded-2xl p-1.5 z-50 text-xs font-semibold text-slate-700 dark:text-slate-200 space-y-0.5">
                <button
                  onClick={() => {
                    setExportMenuOpen(false);
                    handleExportPNG();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left hover:bg-violet-500/10 hover:text-violet-600 dark:hover:bg-violet-500/20 dark:hover:text-violet-300 transition cursor-pointer"
                >
                  <Download size={14} className="text-cyan-500" />
                  <span>Export PNG Image</span>
                </button>

                <button
                  onClick={() => {
                    setExportMenuOpen(false);
                    handleExportJSON();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left hover:bg-violet-500/10 hover:text-violet-600 dark:hover:bg-violet-500/20 dark:hover:text-violet-300 transition cursor-pointer"
                >
                  <Code2 size={14} className="text-indigo-500" />
                  <span>Export JSON Blueprint</span>
                </button>
              </div>
            )}
          </div>

          {canEditDashboard && !autosaveEnabled && (
            <button
              disabled={!draft || save.isPending}
              onClick={() => {
                save.mutate(scene, {
                  onSuccess: () => {
                    useNotificationStore.getState().add('Dashboard canvas changes saved to database.', 'success');
                  },
                });
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-violet-500/40 bg-violet-500/10 px-3.5 py-1.5 text-xs font-bold text-violet-600 dark:text-violet-300 hover:bg-violet-600 hover:text-white transition cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Save size={14} /> {save.isPending ? 'Saving…' : 'Save'}
            </button>
          )}

          {onlineCollaborators.length > 0 && (
            <div
              role="group"
              aria-label={`${onlineCollaborators.length} ${onlineCollaborators.length === 1 ? 'collaborator' : 'collaborators'} online`}
              className="flex items-center pl-1"
            >
              {onlineCollaborators.slice(0, 4).map((collaborator, index) => {
                const initials = (collaborator.name || 'Voxel member')
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join('')
                  .toUpperCase();

                const viewportTitle = collaborator.viewport
                  ? `Viewing canvas around ${collaborator.viewport.x}, ${collaborator.viewport.y}`
                  : '';
                const presenceTitle = [
                  collaborator.name || 'Voxel member',
                  collaborator.isTyping ? 'Typing' : '',
                  viewportTitle,
                ]
                  .filter(Boolean)
                  .join(' · ');

                return (
                  <div
                    key={collaborator.clientId}
                    role="img"
                    aria-label={presenceTitle}
                    title={presenceTitle}
                    className={`relative grid size-7 place-items-center overflow-hidden rounded-full border-2 border-white text-[9px] font-extrabold text-white shadow-sm dark:border-[#070b14] ${index > 0 ? '-ml-2' : ''}`}
                    style={{ backgroundColor: collaborator.color || '#475569' }}
                  >
                    {collaborator.avatarUrl ? (
                      <img src={collaborator.avatarUrl} alt="" className="size-full object-cover" />
                    ) : (
                      initials
                    )}
                    {collaborator.isTyping && (
                      <span className="absolute bottom-0 right-0 size-2 rounded-full bg-amber-300 ring-1 ring-white dark:ring-[#070b14]" />
                    )}
                  </div>
                );
              })}
              {onlineCollaborators.length > 4 && (
                <span className="-ml-2 grid size-7 place-items-center rounded-full border-2 border-white bg-slate-200 text-[9px] font-bold text-slate-700 dark:border-[#070b14] dark:bg-slate-700 dark:text-slate-100">
                  +{onlineCollaborators.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* --- GRID EDITOR WORKSPACE --- */}
      <div className={`flex flex-1 flex-col lg:flex-row relative overflow-hidden ${isResizingLeft || isResizingRight ? 'select-none cursor-col-resize' : ''}`}>
        {!canEditDashboard && (
          <div className="absolute inset-0 z-40 cursor-default" aria-label="Read-only dashboard">
            <div className="pointer-events-none fixed left-1/2 top-[4.5rem] -translate-x-1/2 rounded-full border border-slate-200 bg-white/95 px-4 py-2 text-xs font-semibold text-slate-600 shadow-lg backdrop-blur dark:border-white/10 dark:bg-slate-900/95 dark:text-slate-300">
              Read-only access · Contact a workspace admin to request edit permission
            </div>
          </div>
        )}
        {/* --- CANVA/FIGMA LEFT SIDE ASSETS PANEL --- */}
        {leftPanelOpen && (
          <aside
            style={{ width: `${leftPanelWidth}px` }}
            className={`relative border-r border-slate-200/80 bg-white/95 dark:border-white/10 dark:bg-[#070a14]/95 backdrop-blur-xl flex flex-col ${canEditDashboard ? 'z-20' : 'z-50'} shrink-0 select-none`}
          >
            {/* Left Panel Resizer Bar */}
            <div
              onPointerDown={handleLeftResizeStart}
              onDoubleClick={() => {
                setLeftPanelWidth(288);
                localStorage.setItem('voxel_left_panel_width', '288');
              }}
              title="Drag cursor to resize left panel (Double click to reset)"
              className="absolute top-0 bottom-0 -right-1.5 w-3 z-30 cursor-col-resize"
            />
            {/* Tabs */}
            <div className="flex border-b border-slate-200/80 dark:border-white/10 p-1.5 gap-1 bg-slate-50/50 dark:bg-white/5">
              {canEditDashboard && (
                <>
                  <button
                onClick={() => setLeftPanelTab('elements')}
                className={`flex-1 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  leftPanelTab === 'elements'
                    ? 'bg-white text-violet-600 shadow-xs dark:bg-slate-800 dark:text-violet-400'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                    <Plus size={12} /> Elements
                  </button>
                  <button
                onClick={() => setLeftPanelTab('templates')}
                className={`flex-1 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  leftPanelTab === 'templates'
                    ? 'bg-white text-violet-600 shadow-xs dark:bg-slate-800 dark:text-violet-400'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                    <FolderOpen size={12} /> Presets
                  </button>
                  <button
                onClick={() => setLeftPanelTab('layers')}
                className={`flex-1 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  leftPanelTab === 'layers'
                    ? 'bg-white text-violet-600 shadow-xs dark:bg-slate-800 dark:text-violet-400'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                    <Layers size={12} /> Layers
                  </button>
                </>
              )}
              <button
                onClick={() => setLeftPanelTab('comments')}
                className={`flex-1 py-1.5 text-[10px] font-extrabold uppercase tracking-wider rounded-lg transition cursor-pointer flex items-center justify-center gap-1.5 ${
                  leftPanelTab === 'comments'
                    ? 'bg-white text-violet-600 shadow-xs dark:bg-slate-800 dark:text-violet-400'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                <MessageSquare size={12} /> Comments
              </button>
            </div>

            {/* Tab Contents */}
            <div className="p-3.5 space-y-4 overflow-y-auto max-h-[calc(100vh-120px)] flex-1">
              {canEditDashboard && leftPanelTab === 'elements' && (
                <div className="space-y-2.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                    Click to Add Element
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {widgetDefinitions.map((definition) => {
                      const Icon = widgetIconComponents[definition.icon] || Layers;
                      return (
                        <button
                        key={definition.type}
                        onClick={() => addNode(definition.type)}
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 hover:border-violet-500/40 hover:bg-violet-500/5 transition cursor-pointer text-left group"
                      >
                          <div className="size-8 rounded-lg bg-white dark:bg-slate-800 grid place-items-center shadow-xs group-hover:scale-105 transition-transform shrink-0">
                            <Icon className={widgetIconColors[definition.type] || 'text-violet-500'} size={16} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight">
                              {definition.title}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {definition.description}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {canEditDashboard && leftPanelTab === 'templates' && (
                <div className="space-y-2.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                    Canvas Template Presets
                  </span>
                  <div className="space-y-2">
                    {[
                      { key: 'server', title: 'Server Monitor', desc: 'CPU, RAM, & Request load pipeline',
                      },
                      { key: 'business', title: 'Sales Performance', desc: 'Daily visitors, conversion & revenue',
                      },
                      { key: 'tasks', title: 'Sprint Backlog', desc: 'Task completion & velocity stats',
                      },
                      { key: 'devhub', title: 'Developer Hub', desc: 'PRs, CI builds & test coverage',
                      },
                      { key: 'ops', title: 'Operations Center', desc: 'Uptime SLA & active error metrics',
                      },
                    ].map((t) => (
                      <button
                        key={t.key}
                        onClick={() => loadPreset(t.key)}
                        className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/5 hover:border-violet-500/40 hover:bg-violet-500/10 transition cursor-pointer"
                      >
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                          {t.title}
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{t.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {canEditDashboard && leftPanelTab === 'layers' && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                      Scene Layers ({scene.nodes.length})
                    </span>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      className="text-[9px] text-violet-500 dark:text-violet-400 font-extrabold hover:underline cursor-pointer"
                      title="Select all nodes (⌘A)"
                    >
                      Select All (⌘A)
                    </button>
                  </div>

                  {selectedNodeIds.length > 0 && (
                    <div className="flex items-center justify-between px-2.5 py-1.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs font-bold text-violet-600 dark:text-violet-300 animate-fade-in">
                      <span>
                        {selectedNodeIds.length} {selectedNodeIds.length === 1 ? 'layer' : 'layers'}{' '}
                        selected
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSelectedNodeIds([])}
                          className="text-[10px] px-1.5 py-0.5 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition cursor-pointer"
                          title="Deselect all"
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteSelected}
                          className="p-1 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition cursor-pointer"
                          title="Delete selected layers (⌫)"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    {scene.nodes.map((n) => {
                      const isEditing = editingLayerId === n.id;
                      const isSelected = selectedNodeIds.includes(n.id);

                      return (
                        <div
                          key={n.id}
                          onClick={(e) => handleSelectNode(n.id, e)}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition cursor-pointer group ${
                            isSelected
                              ? 'bg-violet-500/15 text-violet-600 dark:text-violet-300 border border-violet-500/30'
                              : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300 border border-transparent'
                          }`}
                        >
                          {isEditing ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                if (editingLayerTitle.trim()) {
                                  updateNode(n.id, { title: editingLayerTitle.trim() });
                                }
                                setEditingLayerId(null);
                              }}
                              className="flex-1 mr-2"
                            >
                              <input
                                type="text"
                                autoFocus
                                value={editingLayerTitle}
                                onChange={(e) => setEditingLayerTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Escape') setEditingLayerId(null);
                                }}
                                onBlur={() => {
                                  if (editingLayerTitle.trim()) {
                                    updateNode(n.id, { title: editingLayerTitle.trim() });
                                  }
                                  setEditingLayerId(null);
                                }}
                                className="w-full rounded-lg border border-violet-500 bg-white dark:bg-slate-900 px-2 py-1 text-xs font-extrabold outline-none text-slate-900 dark:text-white shadow-xs"
                              />
                            </form>
                          ) : (
                            <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                              <span
                                onDoubleClick={(e) => {
                                  e.stopPropagation();
                                  setEditingLayerId(n.id);
                                  setEditingLayerTitle(n.title || '');
                                }}
                                className="truncate hover:underline cursor-text"
                                title="Double-click to rename layer"
                              >
                                {n.title || 'Untitled Node'}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingLayerId(n.id);
                                  setEditingLayerTitle(n.title || '');
                                }}
                                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-violet-600 dark:hover:text-violet-300 transition-opacity cursor-pointer shrink-0"
                                title="Rename layer"
                              >
                                <Pencil size={12} />
                              </button>
                            </div>
                          )}

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[9px] uppercase font-extrabold px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-white/10 text-slate-500 dark:text-slate-400">
                              {n.type}
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNode(n.id);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-opacity cursor-pointer"
                              title="Delete layer"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {scene.nodes.length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-400 font-medium">
                        No nodes added to scene yet.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {leftPanelTab === 'comments' && (
                <DashboardCommentsPanel
                  dashboardId={dashboardId}
                  workspaceId={dashboard.data?.workspaceId}
                  accessRole={dashboard.data?.accessRole}
                  dashboardStatus={dashboard.data?.status}
                  selectedNodeIds={selectedNodeIds}
                  onFocusNodes={(ids) => { setSelectedNodeIds(ids); setLeftPanelTab('elements'); }}
                />
              )}
            </div>
          </aside>
        )}

        <main
          onClick={() => setSelectedNodeIds([])}
          className="flex-1 overflow-hidden relative bg-slate-50 dark:bg-[#030509] min-h-[500px] z-10"
          style={gridStyleInline}
        >
          {/* Centered Empty State Overlay when no nodes exist */}
          {!scene.nodes.length && (
            <div className="absolute inset-0 z-20 flex items-center justify-center p-6 pointer-events-none">
              <div className="pointer-events-auto max-w-md w-full">
                <CanvasEmpty onAdd={() => addNode('metric')} />
              </div>
            </div>
          )}

          {/* 360-degree Infinite Scrollable Container */}
          <div
            ref={gridRef}
            className="w-full h-full overflow-auto relative no-scrollbars flex-1"
            style={{ padding: CANVAS_PADDING }}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            onScroll={handleViewportChange}
          >
            {/* The infinite board sheet */}
            <div
              className="relative select-none transition-transform duration-150 ease-out"
              style={{
                width: zoom < 1 ? `${(100 / zoom).toFixed(2)}%` : '100%',
                height: zoom < 1 ? `${(100 / zoom).toFixed(2)}%` : '100%',
                minWidth: '2400px',
                minHeight: '1800px',
                transform: `scale(${zoom})`,
                transformOrigin: '0 0',
              }}
            >
              {/* Main SVG connections canvas overlay */}
              <svg className="w-full h-full absolute inset-0 pointer-events-none z-0">
                <defs>
                  <marker
                    id="arrow"
                    viewBox="0 0 10 10"
                    refX="6"
                    refY="5"
                    markerWidth="5"
                    markerHeight="5"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" className="fill-slate-400" />
                  </marker>
                </defs>
                {scene.connections.map((conn, i) => {
                  const fromNode = scene.nodes.find((n) => n.id === conn.fromId);
                  const toNode = scene.nodes.find((n) => n.id === conn.toId);
                  if (!fromNode || !toNode) return null;

                  const startX = (fromNode.x ?? 40) + 140; // Approx center (width ~280)
                  const startY = (fromNode.y ?? 40) + 100; // Approx center (height ~200)
                  const endX = (toNode.x ?? 40) + 140;
                  const endY = (toNode.y ?? 40) + 100;

                  const offset = 100;
                  const path = `M ${startX} ${startY} C ${startX + offset} ${startY}, ${endX - offset} ${endY}, ${endX} ${endY}`;

                  const styles = {
                    solid: 'stroke-slate-300 dark:stroke-slate-600',
                    dashed: 'stroke-slate-400 dark:stroke-slate-500 stroke-dasharray-[8_8]',
                    pulsing:
                      'stroke-violet-500 animate-pulse drop-shadow-[0_0_8px_rgba(139,92,246,0.6)]',
                    glowing: 'stroke-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]',
                  };
                  const strokeClass = styles[conn.style || 'solid'];

                  return (
                    <path
                      key={`${conn.fromId}-${conn.toId}-${i}`}
                      d={path}
                      fill="transparent"
                      strokeWidth="2.5"
                      markerEnd={conn.style === 'solid' ? 'url(#arrow)' : ''}
                      className={strokeClass}
                    />
                  );
                })}
              </svg>

              {/* Grid Layout Container */}
              <div className="relative z-10 w-full h-full"
                style={{ padding: CANVAS_INNER_PADDING }}
              >
                {scene.nodes.length > 0 && (
                  <NodeGrid
                    nodes={scene.nodes}
                    selectedNodeIds={selectedNodeIds}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={handleSelectNode}
                    resolveNodeValue={resolveNodeValue}
                    onDragStart={handleDragStart}
                    onResizeStart={handleResizeStart}
                    onKeyboardMove={handleKeyboardMove}
                    updateNode={updateNode}
                    canEdit={canEditDashboard}
                    awarenessStates={awarenessStates}
                    localClientId={awareness?.clientID}
                  />
                )}
              </div>
            </div>
          </div>

          <CanvasOverview
            nodes={scene.nodes}
            collaborators={awarenessStates.filter(([, state]) => state.user?.id && state.viewport)}
            localClientId={awareness?.clientID}
            zoom={zoom}
            gridRef={gridRef}
          />

          {/* Floating Canvas Zoom Controls */}
          <div className="absolute bottom-5 right-5 z-40 flex items-center gap-1.5 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-[#0c101d]/90 backdrop-blur-xl p-1.5 shadow-xl select-none">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleZoomOut();
              }}
              disabled={zoom <= 0.25}
              title="Zoom Out (Pinch / Ctrl -)"
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition cursor-pointer disabled:opacity-30"
            >
              <Minus size={14} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleResetZoom();
              }}
              title="Reset Zoom to 100%"
              className="px-2 py-1 text-xs font-mono font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition cursor-pointer"
            >
              {Math.round(zoom * 100)}%
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleZoomIn();
              }}
              disabled={zoom >= 2.0}
              title="Zoom In (Pinch / Ctrl +)"
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition cursor-pointer disabled:opacity-30"
            >
              <Plus size={14} />
            </button>

            <div className="w-px h-3.5 bg-slate-200 dark:bg-white/10 mx-0.5" />

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleResetZoom();
              }}
              title="Fit to Canvas (100%)"
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition cursor-pointer"
            >
              <Maximize2 size={14} />
            </button>

            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRepositionCanvas();
              }}
              title="Reposition View to Nodes (Recenter)"
              className="p-1.5 text-violet-600 dark:text-violet-400 hover:bg-violet-500/10 rounded-xl transition cursor-pointer"
            >
              <Target size={14} />
            </button>
          </div>
        </main>

        {/* --- VERSION HISTORY PANEL --- */}
        {versionHistoryOpen && (
          <VersionHistory
            dashboardId={dashboardId}
            activeVersion={dashboard.data?.version}
            onClose={() => setVersionHistoryOpen(false)}
            onRestore={handleRestoreVersion}
          />
        )}

        {/* --- FIGMA-STYLE RIGHT PROPERTIES INSPECTOR PANEL --- */}
        {rightPanelOpen && (
          <aside
            style={{ width: `${rightPanelWidth}px` }}
            className="border-t lg:border-t-0 lg:border-l border-slate-200/80 bg-white/95 p-4 dark:border-white/10 dark:bg-[#070a14]/95 backdrop-blur-xl flex flex-col justify-between min-h-[400px] lg:min-h-0 relative z-20 shrink-0 select-none"
          >
            {/* Right Panel Resizer Bar */}
            <div
              onPointerDown={handleRightResizeStart}
              onDoubleClick={() => {
                setRightPanelWidth(320);
                localStorage.setItem('voxel_right_panel_width', '320');
              }}
              title="Drag cursor to resize right panel (Double click to reset)"
              className="absolute top-0 bottom-0 -left-1.5 w-3 z-30 cursor-col-resize"
            />
            {selectedNodeIds.length > 1 ? (
              <div className="flex flex-col justify-between h-full">
                <div className="space-y-5 overflow-y-auto max-h-[calc(100vh-180px)] pb-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 rounded px-1.5 py-0.5 uppercase tracking-wide">
                        Multi-Select
                      </span>
                      <h3 className="font-semibold text-sm">{selectedNodeIds.length} Nodes</h3>
                    </div>
                    <button
                      onClick={() => setSelectedNodeIds([])}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
                      title="Deselect all"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-4">
                    {/* Quick Selection Stats */}
                    <div className="p-3 rounded-xl bg-violet-500/5 border border-violet-500/15 flex items-center justify-between text-xs">
                      <span className="font-bold text-violet-600 dark:text-violet-300">
                        {selectedNodeIds.length} of {scene.nodes.length} nodes selected
                      </span>
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="text-[10px] font-extrabold text-violet-600 dark:text-violet-400 hover:underline cursor-pointer"
                      >
                        Select All (⌘A)
                      </button>
                    </div>

                    <fieldset className="space-y-2">
                      <legend className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                        Align selection
                      </legend>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: 'left', label: 'Left' }, { id: 'center', label: 'Center' }, { id: 'right', label: 'Right' },
                          { id: 'top', label: 'Top' }, { id: 'middle', label: 'Middle' }, { id: 'bottom', label: 'Bottom' },
                        ].map((alignment) => (
                          <button key={alignment.id} type="button" disabled={!canEditDashboard} onClick={() => alignSelectedNodes(alignment.id)} className="rounded-lg border border-slate-200 px-2 py-2 text-[10px] font-semibold text-slate-600 transition hover:border-violet-400 hover:bg-violet-500/5 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-slate-300 dark:hover:border-violet-500/40">
                            {alignment.label}
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    {/* Bulk Color Palette */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-2">
                        Batch Color Palette
                      </label>
                      <div className="flex gap-2 flex-wrap">
                        {[
                          { id: 'slate', color: 'bg-slate-700' },
                          { id: 'rose', color: 'bg-rose-500' },
                          { id: 'emerald', color: 'bg-emerald-500' },
                          { id: 'cyan', color: 'bg-cyan-500' },
                          { id: 'amber', color: 'bg-amber-500' },
                          { id: 'purple', color: 'bg-purple-500' },
                          { id: 'blue', color: 'bg-blue-500' },
                          { id: 'orange', color: 'bg-orange-500' },
                        ].map(({ id, color }) => (
                          <button
                            key={id}
                            type="button"
                            onClick={() => {
                              selectedNodeIds.forEach((nodeId) => updateNode(nodeId, { color: id }),
                              );
                              useNotificationStore.getState().add(`Applied ${id} color to ${selectedNodeIds.length} nodes.`, 'info',
                                );
                            }}
                            className={`size-6 rounded-full border border-white/20 transition hover:scale-110 cursor-pointer ${color}`}
                            title={`Set color to ${id}`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Bulk Border Style */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block">
                        Batch Border Style
                      </label>
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          if (e.target.value) {
                            selectedNodeIds.forEach((nodeId) => updateNode(nodeId, { borderStyle: e.target.value }),
                            );
                            useNotificationStore.getState().add(`Applied ${e.target.value} border to ${selectedNodeIds.length} nodes.`, 'info',
                              );
                          }
                        }}
                        className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10 dark:bg-slate-900"
                      >
                        <option value="" disabled>
                          Apply Border Style to All...
                        </option>
                        <option value="solid">Solid Line</option>
                        <option value="dashed">Dashed Border</option>
                        <option value="glow">Neon Glow</option>
                      </select>
                    </div>

                    {/* Selected Nodes List */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1.5">
                        Selected Nodes
                      </label>
                      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                        {scene.nodes
                          .filter((n) => selectedNodeIds.includes(n.id))
                          .map((n) => (
                            <div
                              key={n.id}
                              className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 text-xs font-bold"
                            >
                              <span className="truncate mr-2">{n.title || 'Untitled Node'}</span>
                              <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-white/10 text-slate-500 shrink-0">
                                {n.type}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Batch Delete Action */}
                <div className="border-t border-slate-100 pt-4 dark:border-white/5 mt-5 lg:mt-0">
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 cursor-pointer shadow-lg shadow-rose-600/10 transition"
                  >
                    <Trash2 size={16} /> Delete {selectedNodeIds.length} Nodes (⌫)
                  </button>
                </div>
              </div>
            ) : selectedNodeId ? (
              (() => {
                const selectedNode = scene.nodes.find((node) => node.id === selectedNodeId);
                if (!selectedNode) return null;
                const widgetDefinition = getWidgetDefinition(selectedNode.type);
                const widgetRenderer = widgetDefinition?.renderer;
                return (
                  <>
                    <div className="space-y-5 overflow-y-auto max-h-[calc(100vh-180px)] pb-4">
                      <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 rounded px-1.5 py-0.5 uppercase tracking-wide">
                            {widgetDefinition?.title || selectedNode.type}
                          </span>
                          <h3 className="font-semibold text-sm">Inspector</h3>
                        </div>
                        <button
                      onClick={() => setSelectedNodeId(null)}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
                    >
                          <X size={16} />
                        </button>
                      </div>

                      <div className="space-y-4">
                        {/* Title */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                            Label/Title
                          </label>
                          <input
                        type="text"
                        maxLength={160}
                        value={selectedNode.title}
                        onChange={(e) => updateNode(selectedNode.id, { title: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10"
                      />
                        </div>

                        {/* Common fields: Value Source mode */}
                        {widgetRenderer !== 'logic' && (
                      <div className="space-y-1.5 pt-2">
                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                              Value Source
                            </label>
                            <select
                          value={selectedNode.valueSource || 'manual'}
                          onChange={(e) =>
                            updateNode(selectedNode.id, { valueSource: e.target.value })
                          }
                          className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10 dark:bg-slate-900"
                        >
                              <option value="manual">Manual Input</option>
                              <option value="connections">Connected Inputs (Aggregation)</option>
                            </select>
                          </div>
                    )}

                        {widgetRenderer !== 'logic' &&
                      selectedNode.valueSource === 'connections' && (
                        <div className="space-y-2 border border-violet-100 p-2.5 rounded-lg dark:border-white/5 bg-violet-50/20 dark:bg-violet-950/5">
                              <div>
                                <label className="text-[10px] font-bold text-violet-500 uppercase tracking-wider block mb-1">
                                  Aggregation Formula
                                </label>
                                <select
                              value={selectedNode.aggregationOperator || 'sum'}
                              onChange={(e) =>
                                updateNode(selectedNode.id, { aggregationOperator: e.target.value,
                                    })
                              }
                              className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10 dark:bg-slate-900 text-violet-600 dark:text-violet-400 font-semibold"
                            >
                                  <option value="sum">Sum (+)</option>
                                  <option value="avg">Average (AVG)</option>
                                  <option value="prod">Product (×)</option>
                                  <option value="min">Minimum (MIN)</option>
                                  <option value="max">Maximum (MAX)</option>
                                </select>
                              </div>

                              {/* Display live inputs */}
                              <div className="text-[10px] text-slate-400 space-y-1">
                                <span className="font-semibold block text-slate-500">
                                  Incoming connections:
                                </span>
                                {(() => {
                              const incoming = scene.connections.filter(
                                (c) => c.toId === selectedNode.id,
                              );
                              if (incoming.length === 0) {
                                return (
                                  <span className="italic block mt-1">
                                        No connections. Draw an arrow from another node to link
                                        them.
                                      </span>
                                );
                              }
                              return (
                                <ul className="list-disc list-inside space-y-0.5 font-mono">
                                      {incoming.map((c, i) => {
                                    const src = scene.nodes.find((n) => n.id === c.fromId);
                                    return (
                                      <li key={i}>
                                            {src ? `${src.title}: ` : 'Unknown Node: '}
                                            <span className="text-violet-500 font-bold">
                                              {src ? resolveNodeValue(src) : '0'}
                                            </span>
                                          </li>
                                    );
                                  })}
                                    </ul>
                              );
                            })()}
                              </div>
                            </div>
                      )}

                        {/* Widget-specific controls come from the registered configuration schema. */}
                        {widgetDefinition ? (
                      <div className="space-y-3">
                            {widgetDefinition.fields.map((field) => {
                          const value = selectedNode[field.key] ?? '';
                          const controlClass = 'w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10 dark:bg-slate-900';
                          const connectedValue = field.isValue && selectedNode.valueSource === 'connections';
                          return (
                            <label key={field.key} className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                  {field.label}
                                  {connectedValue ? (
                                <div className="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs font-medium normal-case tracking-normal text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                                      Resolved from connections:{' '}
                                      <b>{resolveNodeValue(selectedNode)}</b>
                                    </div>
                              ) : field.type === 'node-select' ? (
                                <select value={value} onChange={(event) => updateNode(selectedNode.id, { [field.key]: event.target.value,
                                        })} className={`${controlClass} mt-1 normal-case tracking-normal`}>
                                      <option value="">Choose a widget…</option>
                                      {scene.nodes.filter((node) => node.id !== selectedNode.id &&
                                            getWidgetDefinition(node.type)?.renderer !== 'note',
                                        ).map((node) => (
                                          <option key={node.id} value={node.id}>
                                            {node.title || node.type} · {node.type}
                                          </option>))}
                                    </select>
                              ) : field.type === 'select' ? (
                                <select value={value || field.options[0]?.value || ''} onChange={(event) => updateNode(selectedNode.id, { [field.key]: event.target.value,
                                        })} className={`${controlClass} mt-1 normal-case tracking-normal`}>
                                      {field.options.map((option) => (
                                        <option key={option.value} value={option.value}>
                                          {option.label}
                                        </option>))}
                                    </select>
                              ) : field.type === 'textarea' ? (
                                <textarea value={value} maxLength={field.maxLength} rows={field.monospace ? 6 : 4} onChange={(event) => updateNode(selectedNode.id, { [field.key]: event.target.value,
                                        })} className={`${controlClass} mt-1 resize-y normal-case tracking-normal ${field.monospace ? 'font-mono text-xs' : ''}`} />
                              ) : (
                                <input type={field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text'} inputMode={field.type === 'number-text' ? 'decimal' : undefined} min={field.min} max={field.max} maxLength={field.maxLength} value={value} placeholder={field.placeholder} onChange={(event) => updateNode(selectedNode.id, { [field.key]: field.type === 'number' ? Number(event.target.value) || field.min
                                              : event.target.value,
                                        })} className={`${controlClass} mt-1 normal-case tracking-normal ${field.monospace ? 'font-mono text-xs' : ''}`} />
                              )}
                                  {field.help && (
                                    <span className="mt-1 block font-normal normal-case tracking-normal text-slate-400">
                                      {field.help}
                                    </span>
                                  )}
                                </label>
                          );
                        })}
                          </div>
                    ) : (
                      <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
                            This widget type is not available in this version. Its saved data is
                            preserved.
                          </p>
                    )}

                        {/* Sizing Tiers */}
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                            Grid Column Span
                          </label>
                          <select
                        value={selectedNode.size}
                        onChange={(e) => updateNode(selectedNode.id, { size: e.target.value, customWidth: null, customHeight: null,
                              })}
                        className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10 dark:bg-slate-900"
                      >
                            <option value="small">Small (3 cols - 1/4 Row)</option>
                            <option value="medium">Medium (4 cols - 1/3 Row)</option>
                            <option value="large">Large (6 cols - 1/2 Row)</option>
                            <option value="wide">Wide (12 cols - Full Row)</option>
                          </select>
                        </div>

                        {/* Card Visual Customizations */}
                        <div className="border-t border-slate-100 dark:border-white/5 pt-3 space-y-3">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Design & Styles
                          </h4>

                          {/* Theme color */}
                          <div>
                            <label className="text-[10px] block mb-1 text-slate-500">
                              Color Palette
                            </label>
                            <div className="flex flex-wrap gap-1">
                              {['slate', 'violet', 'emerald', 'rose', 'amber', 'indigo', 'cyan',
                              ].map(
                            (color) => (
                              <button
                                key={color}
                                onClick={() => updateNode(selectedNode.id, { color })}
                                className={`size-6 rounded-full border cursor-pointer transition-transform ${
                                  selectedNode.color === color
                                    ? 'scale-110 ring-2 ring-violet-500/25'
                                    : 'hover:scale-105'
                                }`}
                                style={{
                                  backgroundColor:
                                    color === 'slate'
                                      ? '#64748b'
                                      : color === 'violet'
                                        ? '#8b5cf6'
                                        : color === 'emerald'
                                          ? '#10b981'
                                          : color === 'rose'
                                            ? '#f43f5e'
                                            : color === 'amber'
                                              ? '#f59e0b'
                                              : color === 'indigo'
                                                ? '#6366f1'
                                                : '#06b6d4',
                                }}
                                title={color}
                              />
                            ))}
                            </div>
                          </div>

                          {/* Borders */}
                          <div>
                            <label className="text-[10px] block mb-1 text-slate-500">
                              Border Style
                            </label>
                            <select
                          value={selectedNode.borderStyle || 'solid'}
                          onChange={(e) =>
                            updateNode(selectedNode.id, { borderStyle: e.target.value })
                          }
                          className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none dark:border-white/10 dark:bg-slate-900"
                        >
                              <option value="solid">Solid Line</option>
                              <option value="dashed">Dashed Line</option>
                              <option value="glow">Neon Glow</option>
                            </select>
                          </div>

                          {/* Fonts */}
                          <div>
                            <label className="text-[10px] block mb-1 text-slate-500">
                              Font Size
                            </label>
                            <select
                          value={selectedNode.fontSize || 'regular'}
                          onChange={(e) =>
                            updateNode(selectedNode.id, { fontSize: e.target.value })
                          }
                          className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none dark:border-white/10 dark:bg-slate-900"
                        >
                              <option value="regular">Regular</option>
                              <option value="medium">Medium</option>
                              <option value="large">Large Header</option>
                            </select>
                          </div>
                        </div>

                        {/* Connect to another node */}
                        <div className="border-t border-slate-100 dark:border-white/5 pt-3">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <LinkIcon size={12} /> Connecting Lines
                          </h4>

                          <div className="space-y-2">
                            <div className="flex gap-1.5">
                              <select
                            id="connect-select"
                            className="flex-1 rounded-lg border border-slate-200 bg-transparent px-2.5 py-1.5 text-xs focus:outline-none dark:border-white/10 dark:bg-slate-900"
                          >
                                <option value="">Connect to node...</option>
                                {scene.nodes
                              .filter((n) => n.id !== selectedNode.id)
                              .map((n) => (
                                <option key={n.id} value={n.id}>
                                      {n.title}
                                    </option>
                              ))}
                              </select>
                              <button
                            onClick={() => {
                              const select = document.getElementById('connect-select');
                              if (select && select.value) {
                                addConnection(selectedNode.id, select.value);
                                select.value = '';
                              }
                            }}
                            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white cursor-pointer hover:bg-violet-500"
                          >
                                Add
                              </button>
                            </div>

                            {/* List existing connections */}
                            <div className="max-h-24 overflow-y-auto space-y-1.5 pt-1">
                              {scene.connections
                            .map((c, i) => ({ ...c, index: i }))
                            .filter(
                              (c) => c.fromId === selectedNode.id || c.toId === selectedNode.id,
                            )
                            .map((c) => {
                              const otherId = c.fromId === selectedNode.id ? c.toId : c.fromId;
                              const otherNode = scene.nodes.find((n) => n.id === otherId);
                              if (!otherNode) return null;
                              return (
                                <div
                                  key={c.index}
                                  className="flex items-center justify-between text-[11px] bg-slate-50 dark:bg-white/5 rounded px-2 py-1"
                                >
                                      <span className="truncate text-slate-500">
                                        Connected to <b>{otherNode.title}</b>
                                      </span>
                                      <button
                                    onClick={() => deleteConnection(c.index)}
                                    className="text-slate-400 hover:text-rose-500 cursor-pointer"
                                    title="Remove connection"
                                  >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                              );
                            })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4 dark:border-white/5 mt-5 lg:mt-0">
                      <button
                    onClick={() => deleteNode(selectedNode.id)}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-500 cursor-pointer shadow-lg shadow-rose-600/10"
                  >
                        Delete Node
                      </button>
                    </div>
                  </>
            );
          })()
        ) : (
              /* Canvas Inspector Fallback */
              <div className="space-y-5 overflow-y-auto max-h-[calc(100vh-140px)] pb-4">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 rounded px-2 py-0.5 uppercase tracking-wide">
                      Canvas
                    </span>
                    <h3 className="font-bold text-sm text-slate-900 dark:text-white">Properties</h3>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Canvas Grid Style */}
                  <div className="space-y-1">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                      Grid Pattern
                    </span>
                    <div className="flex items-center gap-0.5 rounded-xl border border-slate-200/60 p-0.5 dark:border-white/10 bg-slate-50/50 dark:bg-white/5">
                      {['dots', 'lines', 'radial', 'blank'].map((style) => (
                        <button
                          key={style}
                          onClick={() => update({ ...scene, gridStyle: style })}
                          className={`flex-1 rounded-lg py-1.5 text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                            scene.gridStyle === style
                              ? 'bg-white text-violet-600 shadow-xs dark:bg-slate-800 dark:text-violet-400'
                              : 'text-slate-400 hover:text-slate-650 dark:hover:text-slate-200'
                          }`}
                        >
                          {style}
                        </button>
                      ))}
                    </div>
                  </div>

                  {scene.gridStyle !== 'blank' && (
                    <>
                      {/* Grid Spacing */}
                      {scene.gridStyle !== 'radial' && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                            <span>Grid Spacing</span>
                            <span>{scene.gridSize ?? 24}px</span>
                          </div>
                          <input
                            type="range"
                            min="12"
                            max="64"
                            value={scene.gridSize ?? 24}
                            onChange={(e) => update({ ...scene, gridSize: parseInt(e.target.value) })}
                            className="w-full h-1 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-600"
                          />
                        </div>
                      )}

                      {/* Grid Opacity */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                          <span>Grid Opacity</span>
                          <span>{Math.round((scene.gridOpacity ?? 0.08) * 100)}%</span>
                        </div>
                        <input
                          type="range"
                          min="0.02"
                          max="0.50"
                          step="0.01"
                          value={scene.gridOpacity ?? 0.08}
                          onChange={(e) => update({ ...scene, gridOpacity: parseFloat(e.target.value) })}
                          className="w-full h-1 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-600"
                        />
                      </div>

                      {/* Grid Color Preset */}
                      <div className="space-y-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                          Grid Color
                        </span>
                        <div className="flex gap-2.5 pt-1">
                          {[
                            { id: 'slate', color: 'bg-slate-400' },
                            { id: 'blue', color: 'bg-blue-500' },
                            { id: 'violet', color: 'bg-violet-500' },
                            { id: 'indigo', color: 'bg-indigo-500' },
                            { id: 'cyan', color: 'bg-cyan-500' },
                            { id: 'rose', color: 'bg-rose-500' },
                            { id: 'emerald', color: 'bg-emerald-500' },
                          ].map((preset) => (
                            <button
                              key={preset.id}
                              type="button"
                              onClick={() => update({ ...scene, gridColorPreset: preset.id })}
                              className={`size-5 rounded-full border border-white/20 transition hover:scale-110 cursor-pointer ${preset.color} ${
                                (scene.gridColorPreset ?? 'violet') === preset.id
                                  ? 'ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-slate-900'
                                  : ''
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Scene Stats */}
                  <div className="border-t border-slate-100 dark:border-white/5 pt-3 space-y-2">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 block">
                      Canvas Statistics
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-center">
                        <div className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
                          {scene.nodes.length}
                        </div>
                        <div className="text-[9px] text-slate-400 uppercase font-bold">
                          Total Nodes
                        </div>
                      </div>
                      <div className="p-2.5 rounded-xl border border-slate-200/80 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-center">
                        <div className="text-base font-extrabold text-slate-900 dark:text-white font-mono">
                          {scene.connections.length}
                        </div>
                        <div className="text-[9px] text-slate-400 uppercase font-bold">
                          Connections
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </aside>
        )}
      </div>

      {pickerOpen && <NodePicker onClose={() => setPickerOpen(false)} onAdd={add} />}

      <CustomConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
        onConfirm={confirmModal.onConfirm}
        onCancel={confirmModal.onCancel}
      />

      {/* Render Remote Cursors */}
      {awarenessStates
        .filter(
          ([clientId, state]) => clientId !== awareness?.clientID && state.user && state.cursor,
        )
        .map(([clientId, state]) => {
          const viewport = gridRef.current;
          if (!viewport) return null;
          const bounds = viewport.getBoundingClientRect();
          const position = canvasPointToScreen(
            state.cursor,
            bounds,
            viewport.scrollLeft,
            viewport.scrollTop,
            zoom,
          );

          return (
            <div
              key={clientId}
              className="absolute z-[100] pointer-events-none flex flex-col items-start"
              style={{ left: position.x, top: position.y, transform: 'translate(-2px, -2px)' }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill={state.user.color}
                xmlns="http://www.w3.org/2000/svg"
                style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.15))' }}
              >
                <path
                  d="M4.321 2.302L20.407 10.963C21.411 11.503 21.282 12.983 20.198 13.355L13.916 15.513L11.758 21.795C11.386 22.879 9.906 23.008 9.366 22.004L0.705 5.918C0.218 5.021 1.025 4.053 1.961 4.472L4.321 2.302Z"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div
                className="mt-1 ml-4 px-2 py-1 text-[10px] font-bold text-white rounded shadow-sm whitespace-nowrap"
                style={{ backgroundColor: state.user.color }}
              >
                {state.user.name}
                {state.typing ? ' · typing' : ''}
              </div>
            </div>
          );
        })}
    </section>
  );
}

const CanvasOverview = memo(
  function CanvasOverview({ nodes, collaborators, localClientId, zoom, gridRef }) {
    const dimensions = useMemo(() => {
      const nodeBounds = nodes.map((node) => {
        const width =
          node.customWidth ??
          ({ small: 220, medium: 280, large: 340, wide: 440 }[node.size] || 280);
        const height =
          node.customHeight ??
          ({ image: 240, chart: 220, table: 260, code: 220, metric: 160 }[node.type] || 180);
        return { x: node.x ?? 40, y: node.y ?? 40, width, height };
      });
      const viewportBounds = collaborators.map(([, state]) => ({
        x: state.viewport.x,
        y: state.viewport.y,
        width: state.viewport.width,
        height: state.viewport.height,
      }));
      const bounds = [...nodeBounds, ...viewportBounds];
      const minX = Math.min(0, ...bounds.map((item) => item.x));
      const minY = Math.min(0, ...bounds.map((item) => item.y));
      const maxX = Math.max(2400, ...bounds.map((item) => item.x + item.width));
      const maxY = Math.max(1800, ...bounds.map((item) => item.y + item.height));
      const padding = 160;

      return {
        minX: minX - padding,
        minY: minY - padding,
        width: Math.max(1200, maxX - minX + padding * 2),
        height: Math.max(900, maxY - minY + padding * 2),
      };
    }, [nodes, collaborators]);

    const handleOverviewClick = (event) => {
      event.stopPropagation();
      const viewport = gridRef.current;
      const map = event.currentTarget.querySelector('svg');
      if (!viewport || !map) return;

      const rect = map.getBoundingClientRect();
      const x = dimensions.minX + ((event.clientX - rect.left) / rect.width) * dimensions.width;
      const y = dimensions.minY + ((event.clientY - rect.top) / rect.height) * dimensions.height;
      viewport.scrollTo({
        ...scrollOffsetForCanvasPoint({ x, y }, viewport.clientWidth, viewport.clientHeight, zoom),
        behavior: 'smooth',
      });
    };

    return (
      <button
        type="button"
        onClick={handleOverviewClick}
        aria-label={`Canvas overview. ${collaborators.length} ${collaborators.length === 1 ? 'person is' : 'people are'} viewing. Click to move the canvas.`}
        className="absolute bottom-20 right-4 z-30 w-44 rounded-xl border border-slate-200 bg-white/95 p-2 text-left shadow-xl backdrop-blur transition hover:border-violet-400 dark:border-white/10 dark:bg-[#0c101d]/95 lg:bottom-5 lg:right-40"
      >
        <span className="mb-1.5 block text-[9px] font-extrabold uppercase tracking-widest text-slate-500 dark:text-slate-400">
          Canvas overview · {collaborators.length} online
        </span>
        <svg
          viewBox={`${dimensions.minX} ${dimensions.minY} ${dimensions.width} ${dimensions.height}`}
          preserveAspectRatio="none"
          className="h-24 w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-900"
          aria-hidden="true"
        >
          {nodes.map((node) => {
            const width =
              node.customWidth ??
              ({ small: 220, medium: 280, large: 340, wide: 440 }[node.size] || 280);
            const height =
              node.customHeight ??
              ({ image: 240, chart: 220, table: 260, code: 220, metric: 160 }[node.type] || 180);
            return (
              <rect
                key={node.id}
                x={node.x ?? 40}
                y={node.y ?? 40}
                width={width}
                height={height}
                rx="24"
                fill="#64748b"
                fillOpacity="0.42"
              />
            );
          })}
          {collaborators.map(([clientId, state]) => {
            const viewport = state.viewport;
            const isLocal = clientId === localClientId;
            const color = state.user.color || '#64748b';
            return (
              <rect
                key={clientId}
                x={viewport.x}
                y={viewport.y}
                width={viewport.width}
                height={viewport.height}
                rx="16"
                fill={color}
                fillOpacity={isLocal ? '0.14' : '0.08'}
                stroke={color}
                strokeWidth={isLocal ? '30' : '20'}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </svg>
      </button>
    );
  },
  (previous, next) => {
    if (
      previous.nodes !== next.nodes ||
      previous.localClientId !== next.localClientId ||
      previous.zoom !== next.zoom ||
      previous.gridRef !== next.gridRef ||
      previous.collaborators.length !== next.collaborators.length
    )
      return false;

    return previous.collaborators.every(([clientId, state], index) => {
      const [nextClientId, nextState] = next.collaborators[index];
      const oldViewport = state.viewport;
      const newViewport = nextState.viewport;
      const oldUser = state.user;
      const newUser = nextState.user;
      return (
        clientId === nextClientId &&
        oldViewport.x === newViewport.x &&
        oldViewport.y === newViewport.y &&
        oldViewport.width === newViewport.width &&
        oldViewport.height === newViewport.height &&
        oldUser.id === newUser.id &&
        oldUser.name === newUser.name &&
        oldUser.color === newUser.color
      );
    });
  },
);

// --- FREEFORM GRID SETUP ---
function NodeGrid({ nodes, selectedNodeIds = [], selectedNodeId, onSelectNode, resolveNodeValue, onDragStart, onResizeStart, onKeyboardMove, updateNode, canEdit, awarenessStates, localClientId,
}) {
  const remoteSelections = useMemo(() => {
    if (!awarenessStates) return {};
    const selections = {};
    awarenessStates.forEach(([clientId, state]) => {
      if (clientId !== localClientId && state.selectedNodeId && state.user) {
        if (!selections[state.selectedNodeId]) selections[state.selectedNodeId] = [];
        selections[state.selectedNodeId].push(state.user);
      }
    });
    return selections;
  }, [awarenessStates, localClientId]);

  return (
    <div className="relative w-full min-h-[650px] z-10">
      {nodes.map((node) => (
        <WidgetErrorBoundary key={node.id} node={node} onSelectNode={onSelectNode}>
          <CanvasNodeCard
            node={node}
            isSelected={selectedNodeIds.length > 0 ? selectedNodeIds.includes(node.id) : node.id === selectedNodeId}
            remoteSelectedBy={remoteSelections[node.id] || []}
            onSelect={(e) => onSelectNode(node.id, e)}
            resolveNodeValue={resolveNodeValue}
            onDragStart={onDragStart}
            onResizeStart={onResizeStart}
            onKeyboardMove={onKeyboardMove}
            updateNode={updateNode}
            canEdit={canEdit}
          />
        </WidgetErrorBoundary>
      ))}
    </div>
  );
}

class WidgetErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.error(`Widget ${this.props.node.id} failed to render.`, error);
  }

  componentDidUpdate(previousProps) {
    if (this.state.failed && previousProps.node !== this.props.node) this.setState({ failed: false });
  }

  render() {
    const { node, onSelectNode, children } = this.props;
    if (!this.state.failed) return children;
    return (
      <article id={`node-card-${node.id}`} role="alert" style={{ position: 'absolute', left: `${node.x ?? 40}px`, top: `${node.y ?? 40}px`, width: `${node.customWidth ?? 280}px`, minHeight: '140px',
        }} className="rounded-2xl border border-rose-300 bg-rose-50 p-5 text-rose-900 shadow-lg dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100">
        <p className="text-sm font-bold">Widget couldn’t render</p>
        <p className="mt-1 text-xs leading-5">
          The rest of the dashboard is still available. Open its properties to repair or remove this
          widget.
        </p>
        <button type="button" onClick={(event) => onSelectNode(node.id, event)} className="mt-3 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold hover:bg-rose-100 dark:border-rose-800 dark:hover:bg-rose-900/40">
          Open widget properties
        </button>
      </article>
    );
  }
}

// --- CANVAS CARD COMPONENT ---
function CanvasNodeCard({ node, isSelected, remoteSelectedBy, onSelect, resolveNodeValue, onDragStart, onResizeStart, onKeyboardMove, updateNode, canEdit,
}) {
  const displayValue = resolveNodeValue(node);
  const nodeDefinition = getWidgetDefinition(node.type);
  const NodeIcon = widgetIconComponents[nodeDefinition?.icon] || Layers;
  const nodeIcon = (
    <NodeIcon size={18} className={widgetIconColors[node.type] || 'text-slate-500'} />
  );

  // Glow classes for visual border style options
  const borderStyles = {
    solid: 'border-slate-200 dark:border-slate-800',
    dashed: 'border-dashed border-2 border-slate-300 dark:border-slate-700',
    glow: 'border-violet-500 dark:border-violet-400 shadow-md shadow-violet-500/10 ring-1 ring-violet-500/25',
  };

  const cardStyle = useMemo(() => {
    const colorClass = cardColors[node.color || 'slate'];
    const borderClass = borderStyles[node.borderStyle || 'solid'];
    return `${colorClass} ${borderClass}`;
  }, [node.color, node.borderStyle]);

  // Sparkline coordinates math helper
  const parsedSparkPoints = useMemo(() => {
    if (nodeDefinition?.renderer !== 'chart') return [];
    return displayValue
      .split(',')
      .map((val) => parseFloat(val.trim()))
      .filter((n) => !isNaN(n));
  }, [displayValue, nodeDefinition?.renderer]);

  const widthOf = (size) => {
    switch (size) {
      case 'small':
        return 220;
      case 'medium':
        return 280;
      case 'large':
        return 340;
      case 'wide':
        return 440;
      default:
        return 280;
    }
  };

  return (
    <article
      id={`node-card-${node.id}`}
      style={{
        position: 'absolute',
        left: `${node.x ?? 40}px`,
        top: `${node.y ?? 40}px`,
        width: `${node.customWidth ?? widthOf(node.size)}px`,
        minHeight: node.customHeight ? `${node.customHeight}px` : undefined,
        zIndex: isSelected ? 30 : 10,
        willChange: 'left, top',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(e);
      }}
      onFocus={(event) => {
        if (event.target === event.currentTarget) onSelect(event);
      }}
      role="group"
      tabIndex={0}
      aria-label={`${node.title || node.type} canvas widget${isSelected ? ', selected' : ''}. Use arrow keys to move.`}
      onKeyDown={(event) => {
        if (event.target === event.currentTarget) onKeyboardMove(event, node.id);
      }}
      onMouseDown={(e) => {
        // Allow dragging from anywhere on the card unless clicking interactive controls
        const isInteractive = e.target.closest('button, input, select, textarea, a, label');
        if (!isInteractive) {
          onDragStart(e, node.id);
        }
      }}
      className={`rounded-2xl p-5 backdrop-blur-xl shadow-lg transition-shadow duration-200 select-none cursor-grab active:cursor-grabbing ${cardStyle} ${
        isSelected
          ? 'ring-2 ring-indigo-500/90 shadow-[0_0_30px_rgba(99,102,241,0.35)] scale-[1.02] z-[30]'
          : 'hover:shadow-xl hover:scale-[1.01] z-[10]'
      }`}
    >
      {/* Remote Selection Ring Overlay */}
      {remoteSelectedBy && remoteSelectedBy.length > 0 && (
        <div 
          className="absolute inset-[-4px] rounded-[18px] border-2 pointer-events-none z-[40]"
          style={{ borderColor: remoteSelectedBy[0].color }}
        >
          <div 
            className="absolute -top-[24px] left-[-2px] px-2 py-0.5 text-[9px] font-bold text-white rounded-t whitespace-nowrap"
            style={{ backgroundColor: remoteSelectedBy[0].color }}
          >
            {remoteSelectedBy.map((u) => u.name).join(', ')}
          </div>
        </div>
      )}

      {/* --- CARD HEADER --- */}
      <div
        className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2.5 mb-4 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
      >
        <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider">
          {nodeIcon} {nodeDefinition?.title || node.type}
        </span>
      </div>

      {/* --- RENDERING CARD CONTENT DYNAMICALLY --- */}

      {/* 1. Note */}
      {nodeDefinition?.renderer === 'note' && (
        <div className="space-y-2">
          <h2 className={`${textFonts[node.fontSize || 'regular']} font-bold`}>{node.title}</h2>
          <p className="max-w-2xl whitespace-pre-wrap text-sm leading-6 text-slate-500 dark:text-slate-400">
            {displayValue}
          </p>
        </div>
      )}

      {/* 2. Metric */}
      {nodeDefinition?.renderer === 'metric' && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {node.title}
          </p>
          <div className="flex items-baseline gap-1 mt-1">
            {node.unit && <span className="text-2xl font-semibold opacity-60">{node.unit}</span>}
            <span className="text-4xl font-extrabold tracking-tight font-mono">{displayValue}</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-2">
            Sample value · no data source connected
          </span>
        </div>
      )}

      {nodeDefinition?.renderer === 'display' && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {node.title}
          </p>
          <div className="text-4xl font-extrabold tracking-tight font-mono">{displayValue}</div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {node.description || 'KPI summary'}
          </p>
          <span className="text-[10px] text-slate-400">
            Sample value · no data source connected
          </span>
        </div>
      )}

      {/* 3. Progress Goal Bar */}
      {nodeDefinition?.renderer === 'progress' &&
        (() => {
          const current = parseFloat(displayValue) || 0;
          const target = node.target || 100;
          const percent = Math.min(100, Math.max(0, (current / target) * 100));
          return (
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                  {node.title}
                </p>
                <div className="flex items-baseline gap-1 mt-1 font-mono">
                  <span className="text-3xl font-bold">{current}</span>
                  <span className="text-xs text-slate-400">/ {target}</span>
                </div>
              </div>
              {/* Progress track */}
              <div className="w-full bg-slate-100 dark:bg-white/5 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-violet-600 dark:bg-violet-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="text-[10px] font-semibold text-violet-500 dark:text-violet-400 block">
                {percent.toFixed(1)}% Completed
              </span>
            </div>
          );
        })()}

      {/* 4. SVG Sparkline Chart */}
      {nodeDefinition?.renderer === 'chart' &&
        (() => {
          const points = parsedSparkPoints;
          const max = points.length ? Math.max(...points) : 1;
          const min = points.length ? Math.min(...points) : 0;
          const range = max - min || 1;
          const width = 240;
          const height = 65;
          const svgPoints = points
            .map((p, index) => {
              const x = (index / (points.length - 1 || 1)) * width;
              const y = height - ((p - min) / range) * height;
              return `${x},${y}`;
            })
            .join(' ');

          return (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {node.title}
              </p>
              {points.length > 1 ? (
                <div className="pt-2">
                  <svg
                    viewBox={`0 0 ${width} ${height}`}
                    className="w-full h-[65px] overflow-visible"
                  >
                    {/* Fill area */}
                    <path
                      d={`M 0,${height} L ${svgPoints} L ${width},${height} Z`}
                      fill="url(#sparkGrad)"
                      className="opacity-10"
                    />

                    {/* Definition for sparkline gradient */}
                    <defs>
                      <linearGradient id="sparkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#818cf8" />
                        <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {/* Line path */}
                    <polyline fill="none" stroke="#818cf8" strokeWidth="2" points={svgPoints} />
                  </svg>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[65px] bg-slate-100 dark:bg-white/5 rounded text-center p-2">
                  <span className="text-[20px] font-bold font-mono">{displayValue}</span>
                  <span className="text-[9px] text-slate-400">Single connected metric value</span>
                </div>
              )}
            </div>
          );
        })()}

      {/* 5. Status Indicator */}
      {nodeDefinition?.renderer === 'status' &&
        (() => {
          const isSuccess = node.statusColor === 'success';
          const isWarning = node.statusColor === 'warning';
          return (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {node.title}
              </p>
              <div className="flex items-center gap-3">
                <span
                  className={`flex size-8 items-center justify-center rounded-full ${
                    isSuccess
                      ? 'bg-emerald-500/10 text-emerald-500'
                      : isWarning
                        ? 'bg-amber-500/10 text-amber-500'
                        : 'bg-rose-500/10 text-rose-500'
                  }`}
                >
                  {isSuccess ? (
                    <CheckCircle size={18} />
                  ) : isWarning ? (
                    <AlertTriangle size={18} />
                  ) : (
                    <XCircle size={18} />
                  )}
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                    {displayValue || 'Status'}
                  </h3>
                  <span className="text-[10px] text-slate-400">
                    Status set in widget properties
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

      {/* 6. Math Logic Calculation Node */}
      {nodeDefinition?.renderer === 'logic' &&
        (() => {
          const mathResult = parseFloat(displayValue) || 0;
          return (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {node.title}
              </p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-4xl font-extrabold tracking-tight font-mono text-violet-600 dark:text-violet-400">
                  {mathResult.toLocaleString()}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-2">
                <Cpu size={11} /> Formula node recalculating
              </span>
            </div>
          );
        })()}
      {/* 7. Image */}
      {nodeDefinition?.renderer === 'image' && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {node.title}
          </p>
          <div className="w-full h-32 rounded-lg overflow-hidden bg-slate-100 dark:bg-white/5 relative">
            <span className="absolute inset-0 grid place-items-center text-xs text-slate-400">
              Image unavailable
            </span>
            <img
              src={safeImageUrl(node.imageUrl)}
              alt={node.title}
              referrerPolicy="no-referrer"
              className="h-full w-full"
              style={{ objectFit: ['cover', 'contain', 'fill', 'none', 'scale-down'].includes(node.objectFit,
                ) ? node.objectFit : 'cover',
              }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
        </div>
      )}

      {/* 8. Embed */}
      {nodeDefinition?.renderer === 'embed' && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {node.title}
          </p>
          <div className="w-full h-32 rounded-lg overflow-hidden bg-slate-100 dark:bg-white/5 relative">
            {safeExternalUrl(node.embedUrl) ? (
              <iframe
              src={safeExternalUrl(node.embedUrl)}
              title={node.title}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-forms allow-popups"
              referrerPolicy="no-referrer"
            />
            ) : (
              <p className="p-3 text-xs text-slate-500">
                Use an HTTP or HTTPS URL to embed content.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 9. Table */}
      {nodeDefinition?.renderer === 'table' && (() => {
        const cols = (node.columns || '').split(',').map((c) => c.trim()).filter(Boolean);
        const rows = (node.rows || '').split('\n').map((r) => r.split(',').map((c) => c.trim()));
        return (
          <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {node.title}
              </p>
              <div className="w-full overflow-x-auto rounded-lg border border-slate-200/50 dark:border-white/5 no-scrollbars">
                <table className="w-full text-[11px] text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-b border-slate-200/50 dark:border-white/5">
                      {cols.map((col, idx) => (
                      <th key={idx} className="px-2 py-1.5 font-bold uppercase tracking-wider">
                          {col}
                        </th>
                    ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                        {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-2 py-1.5 truncate max-w-[120px]">
                            {cell}
                          </td>
                      ))}
                      </tr>
                  ))}
                  </tbody>
                </table>
              </div>
            </div>
        );
      })()}

      {/* 10. Timer */}
      {nodeDefinition?.renderer === 'timer' && <TimerNode node={node} updateNode={updateNode} />}

      {/* 11. Link Card */}
      {nodeDefinition?.renderer === 'link' && (
        <a
          href={safeExternalUrl(node.url) || undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!safeExternalUrl(node.url)}
          onClick={(event) => { if (!safeExternalUrl(node.url)) event.preventDefault(); }}
          className={`block group/link space-y-2 ${safeExternalUrl(node.url) ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide group-hover/link:text-violet-600 dark:group-hover/link:text-violet-400 transition-colors">
              {node.title}
            </p>
            <LinkIcon size={12} className="text-slate-400 group-hover/link:translate-x-0.5 transition-transform" />
          </div>
          <div className="p-2.5 rounded-lg border border-slate-200/50 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 hover:bg-slate-100/50 transition-colors">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">
              {node.url}
            </p>
            <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{node.description}</p>
          </div>
        </a>
      )}

      {/* 12. Divider */}
      {nodeDefinition?.renderer === 'divider' && (
        <div className="py-2.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">
            {node.title}
          </p>
          <div className="w-full border-t border-slate-300 dark:border-white/10" style={{ borderTopStyle: ['solid', 'dashed', 'dotted', 'double'].includes(node.dividerStyle) ? node.dividerStyle : 'solid',
            }} />
        </div>
      )}

      {/* 13. Code Block */}
      {nodeDefinition?.renderer === 'code' && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {node.title}
          </p>
          <pre className="p-2.5 rounded-lg bg-slate-900 text-slate-100 text-[10px] font-mono overflow-x-auto leading-relaxed border border-white/5">
            <code>{node.code}</code>
          </pre>
        </div>
      )}
      {!nodeDefinition && (
        <div role="status" className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-100">
          <p className="text-xs font-bold">Unsupported widget type</p>
          <p className="text-[10px] leading-4">
            Its saved data is preserved. This widget can’t run in the current Voxel version.
          </p>
        </div>
      )}
      {canEdit && isSelected && (
        <button
          type="button"
          aria-label={`Resize ${node.title || node.type}`}
          title="Drag to resize or use arrow keys"
          onMouseDown={(event) => onResizeStart(event, node.id)}
          onKeyDown={(event) => {
            if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
            event.preventDefault();
            event.stopPropagation();
            const bounds = event.currentTarget.parentElement.getBoundingClientRect();
            const step = event.shiftKey ? 40 : 10;
            const width = node.customWidth ?? bounds.width;
            const height = node.customHeight ?? bounds.height;
            updateNode(node.id, {
              customWidth: Math.max(180, width + (event.key === 'ArrowLeft' ? -step : event.key === 'ArrowRight' ? step : 0),
              ),
              customHeight: Math.max(100, height + (event.key === 'ArrowUp' ? -step : event.key === 'ArrowDown' ? step : 0),
              ),
            });
          }}
          className="absolute -bottom-2 -right-2 z-50 grid size-6 cursor-nwse-resize place-items-center rounded-lg border border-indigo-300 bg-white text-indigo-600 shadow-md hover:bg-indigo-50 dark:border-indigo-500/50 dark:bg-slate-900 dark:text-indigo-300"
        >
          <Maximize2 size={12} />
        </button>
      )}
    </article>
  );
}

function DashboardCommentsPanel({ dashboardId, workspaceId, accessRole, dashboardStatus, selectedNodeIds, onFocusNodes,
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editBody, setEditBody] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [replyToId, setReplyToId] = useState(null);
  const [replyDraft, setReplyDraft] = useState('');
  const [attachSelection, setAttachSelection] = useState(false);
  const currentUser = useQuery({ queryKey: ['auth', 'me'], queryFn: authService.me, retry: false });
  const comments = useQuery({
    queryKey: ['dashboard', dashboardId, 'comments'],
    queryFn: () => workspaceService.comments(dashboardId),
    enabled: Boolean(dashboardId),
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
  });
  const canComment = ['OWNER', 'ADMIN', 'EDITOR', 'COMMENTER'].includes(accessRole) && dashboardStatus !== 'ARCHIVED';
  const canModerate = ['OWNER', 'ADMIN', 'EDITOR'].includes(accessRole);

  const create = useMutation({
    mutationFn: (input) => workspaceService.createComment(dashboardId, input),
    onSuccess: async (_comment, input) => {
      if (input.parentId) {
        setReplyDraft('');
        setReplyToId(null);
      } else {
        setDraft('');
        setAttachSelection(false);
      }
      await queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId, 'comments'] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'comments'] }),
        queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'activity'] }),
      ]);
    },
  });
  const update = useMutation({
    mutationFn: ({ commentId, body }) => workspaceService.updateComment(dashboardId, commentId, body),
    onSuccess: async () => {
      setEditingId(null);
      setEditBody('');
      await queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId, 'comments'] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'comments'] }),
        queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'activity'] }),
      ]);
    },
  });
  const remove = useMutation({
    mutationFn: (commentId) => workspaceService.deleteComment(dashboardId, commentId),
    onSuccess: async () => {
      setConfirmDeleteId(null);
      await queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId, 'comments'] });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'comments'] }),
        queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'activity'] }),
      ]);
    },
  });

  const resolution = useMutation({
    mutationFn: ({ commentId, resolved }) => workspaceService.resolveComment(dashboardId, commentId, resolved),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId, 'comments'] });
      await queryClient.invalidateQueries({ queryKey: ['workspaces', workspaceId, 'activity'] });
    },
  });

  const errorMessage = create.error?.message || update.error?.message || remove.error?.message || resolution.error?.message;
  const formatDate = (value) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value),
    );
  const startEditing = (comment) => {
    setEditingId(comment.id);
    setEditBody(comment.body);
    setConfirmDeleteId(null);
    update.reset();
  };

  return (
    <section aria-label="Dashboard comments" className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-xs font-extrabold text-slate-900 dark:text-white">Discussion</h2>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
            Comments are visible to everyone with dashboard access.
          </p>
        </div>
        <button type="button" onClick={() => void comments.refetch()} disabled={comments.isFetching} aria-label="Refresh comments" className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-violet-600 disabled:opacity-50 dark:hover:bg-white/5">
          <RefreshCw size={13} className={comments.isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {canComment ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            const body = draft.trim();
            if (body && !create.isPending) create.mutate({
              body,
              ...(attachSelection && selectedNodeIds.length ? {
                anchor: {
                  type: selectedNodeIds.length === 1 ? 'node' : 'selection',
                  nodeIds: selectedNodeIds,
                  label: selectedNodeIds.length === 1 ? 'Attached node' : `${selectedNodeIds.length} selected nodes`,
                },
              } : {}),
            });
          }}
          className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-xs dark:border-white/10 dark:bg-slate-900/70"
        >
          <label className="sr-only" htmlFor="dashboard-comment-draft">
            Write a comment
          </label>
          <textarea
            id="dashboard-comment-draft"
            rows={3}
            maxLength={4000}
            value={draft}
            onChange={(event) => { setDraft(event.target.value); create.reset(); }}
            placeholder="Share an update, ask a question, or mention @teammate@company.com…"
            className="w-full resize-y bg-transparent text-xs leading-relaxed text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
          <div className="mt-1 flex min-h-6 items-center justify-between gap-2">
            <span className="text-[9px] text-slate-400">
              Use @email to notify a workspace teammate.
            </span>
            {selectedNodeIds.length > 0 && (
              <button type="button" onClick={() => setAttachSelection((attached) => !attached)} className={`inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[9px] font-bold ${attachSelection ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5'}`}>
                <LocateFixed size={11} />{' '}
                {attachSelection ? `Attached ${selectedNodeIds.length} node${selectedNodeIds.length === 1 ? '' : 's'}` : `Attach selection (${selectedNodeIds.length})`}
              </button>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 dark:border-white/5">
            <span className="text-[9px] text-slate-400">{draft.length}/4000</span>
            <button type="submit" disabled={!draft.trim() || create.isPending} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-2.5 py-1.5 text-[10px] font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-45">
              <Send size={11} /> {create.isPending ? 'Posting…' : 'Post comment'}
            </button>
          </div>
        </form>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[10px] leading-relaxed text-slate-500 dark:border-white/10 dark:bg-white/5">
          {dashboardStatus === 'ARCHIVED' ? 'This dashboard is archived. Comments are read-only.' : 'You can read this discussion. Ask a workspace admin for commenter access to add a comment.'}
        </div>
      )}

      {errorMessage && (
        <p role="alert" className="rounded-lg bg-rose-50 px-2.5 py-2 text-[10px] leading-relaxed text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">
          {errorMessage}
        </p>
      )}

      {comments.isPending ? (
        <div className="space-y-3" aria-label="Loading comments">
          {[0, 1].map((index) => (
            <div key={index} className="animate-pulse space-y-2 rounded-xl border border-slate-100 p-3 dark:border-white/5">
              <div className="h-3 w-2/5 rounded bg-slate-100 dark:bg-white/10" />
              <div className="h-8 rounded bg-slate-100 dark:bg-white/10" />
            </div>))}
        </div>
      ) : comments.isError ? (
        <div role="status" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-[10px] text-rose-700 dark:border-rose-500/20 dark:bg-rose-950/20 dark:text-rose-300">
          <p>Comments could not be loaded.</p>
          <button type="button" onClick={() => void comments.refetch()} className="mt-2 font-bold underline">
            Try again
          </button>
        </div>
      ) : comments.data?.length ? (
        <ol className="space-y-3">
          {comments.data.map((comment) => {
            const isAuthor = comment.author?.id === currentUser.data?.id;
            const canManageComment = canComment && (isAuthor || canModerate) && !comment.deletedAt;
            const canResolveThread = canComment && (isAuthor || canModerate) && !comment.deletedAt;
            const initials = (comment.author?.displayName || 'Former member').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
            return (
              <li key={comment.id} className={`rounded-xl border p-3 dark:bg-slate-900/60 ${comment.resolvedAt ? 'border-emerald-200/80 bg-emerald-50/40 dark:border-emerald-500/20' : 'border-slate-200/80 bg-white/80 dark:border-white/10'}`}>
                <div className="flex items-start gap-2.5">
                  {comment.author?.avatarUrl ? (
                    <img src={comment.author.avatarUrl} alt="" className="size-7 shrink-0 rounded-full object-cover" />
                  ) : (
                    <span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-violet-100 text-[9px] font-extrabold text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                      {initials || 'FM'}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                      <span className="truncate text-[10px] font-bold text-slate-800 dark:text-slate-100">
                        {comment.author?.displayName || 'Former member'}
                      </span>
                      <time className="text-[9px] text-slate-400" dateTime={comment.createdAt}>
                        {formatDate(comment.createdAt)}
                      </time>
                    </div>
                    {comment.deletedAt ? (
                      <p className="mt-2 text-[10px] italic text-slate-400">Comment removed</p>
                    ) : editingId === comment.id ? (
                      <form onSubmit={(event) => { event.preventDefault(); const body = editBody.trim(); if (body && !update.isPending) update.mutate({ commentId: comment.id, body }); }} className="mt-2 space-y-2">
                        <textarea autoFocus rows={3} maxLength={4000} value={editBody} onChange={(event) => { setEditBody(event.target.value); update.reset(); }} className="w-full resize-y rounded-lg border border-violet-300 bg-white p-2 text-xs leading-relaxed outline-none focus:ring-2 focus:ring-violet-500/20 dark:border-violet-500/30 dark:bg-slate-950" aria-label="Edit comment" />
                        <div className="flex justify-end gap-1.5">
                          <button type="button" onClick={() => { setEditingId(null); setEditBody(''); }} className="rounded-lg px-2 py-1 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5">
                            Cancel
                          </button>
                          <button type="submit" disabled={!editBody.trim() || update.isPending} className="rounded-lg bg-violet-600 px-2.5 py-1 text-[10px] font-bold text-white disabled:opacity-45">
                            {update.isPending ? 'Saving…' : 'Save'}
                          </button>
                        </div>
                      </form>
                    ) : (
                      <p className="mt-2 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                        {comment.body}
                      </p>
                    )}
                    {comment.anchor?.nodeIds?.length > 0 && (
                      <button type="button" onClick={() => onFocusNodes(comment.anchor.nodeIds)} className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-md bg-cyan-50 px-2 py-1 text-[9px] font-bold text-cyan-700 hover:bg-cyan-100 dark:bg-cyan-500/10 dark:text-cyan-200 dark:hover:bg-cyan-500/20">
                        <LocateFixed size={11} />{' '}
                        <span className="truncate">
                          {comment.anchor.label || (comment.anchor.type === 'node' ? 'Attached node' : `${comment.anchor.nodeIds.length} attached nodes`)}
                        </span>
                      </button>
                    )}
                    {comment.resolvedAt && (
                      <p className="mt-2 inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 size={12} /> Resolved
                        {comment.resolvedBy?.displayName ? ` by ${comment.resolvedBy.displayName}` : ''}
                      </p>
                    )}
                    {canManageComment && editingId !== comment.id && (
                      <div className="mt-2 flex items-center justify-end gap-2">
                        {confirmDeleteId === comment.id ? (
                          <>
                            <span className="mr-auto text-[9px] text-slate-500">
                              Remove this comment?
                            </span>
                            <button type="button" onClick={() => setConfirmDeleteId(null)} className="text-[9px] font-semibold text-slate-500">
                              Cancel
                            </button>
                            <button type="button" onClick={() => remove.mutate(comment.id)} disabled={remove.isPending} className="text-[9px] font-bold text-rose-600 disabled:opacity-50 dark:text-rose-300">
                              {remove.isPending ? 'Removing…' : 'Remove'}
                            </button>
                          </>
                        ) : (
                          <>
                            {isAuthor && (
                              <button type="button" onClick={() => startEditing(comment)} aria-label="Edit your comment" className="rounded p-1 text-slate-400 hover:bg-violet-50 hover:text-violet-600 dark:hover:bg-violet-500/10">
                                <Pencil size={11} />
                              </button>
                            )}
                            <button type="button" onClick={() => { setConfirmDeleteId(comment.id); remove.reset(); }} aria-label={isAuthor ? 'Remove your comment' : 'Moderate comment'} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10">
                              <Trash2 size={11} />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                    <div className="mt-2 flex items-center justify-end gap-2">
                      {canComment && !comment.resolvedAt && !comment.deletedAt && (
                        <button type="button" onClick={() => { setReplyToId(replyToId === comment.id ? null : comment.id); setReplyDraft(''); create.reset(); }} className="inline-flex items-center gap-1 rounded px-1.5 py-1 text-[9px] font-bold text-slate-500 hover:bg-slate-100 hover:text-violet-600 dark:hover:bg-white/5">
                          <CornerDownRight size={11} /> Reply
                          {comment.replies?.length ? ` · ${comment.replies.length}` : ''}
                        </button>
                      )}
                      {canResolveThread && (
                        <button type="button" onClick={() => resolution.mutate({ commentId: comment.id, resolved: !comment.resolvedAt,
                            })} disabled={resolution.isPending} className={`inline-flex items-center gap-1 rounded px-1.5 py-1 text-[9px] font-bold ${comment.resolvedAt ? 'text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5' : 'text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10'}`}>
                          <CheckCircle2 size={11} /> {comment.resolvedAt ? 'Reopen' : 'Resolve'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                {comment.replies?.length > 0 && (
                  <ol className="ml-9 mt-3 space-y-2 border-l border-slate-200 pl-3 dark:border-white/10">
                    {comment.replies.map((reply) => (
                      <li key={reply.id} className="rounded-lg bg-slate-50/80 px-2.5 py-2 dark:bg-white/[0.025]">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[9px] font-bold text-slate-700 dark:text-slate-200">
                            {reply.author?.displayName || 'Former member'}
                          </span>
                          <time className="shrink-0 text-[8px] text-slate-400" dateTime={reply.createdAt}>
                            {formatDate(reply.createdAt)}
                          </time>
                        </div>
                        {reply.deletedAt ? (
                          <p className="mt-1 text-[10px] italic text-slate-400">Reply removed</p>
                        ) : (
                          <p className="mt-1 whitespace-pre-wrap break-words text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">
                            {reply.body}
                          </p>
                        )}
                      </li>))}
                  </ol>
                )}
                {replyToId === comment.id && canComment && !comment.resolvedAt && (
                  <form onSubmit={(event) => { event.preventDefault(); const body = replyDraft.trim(); if (body && !create.isPending) create.mutate({ body, parentId: comment.id }); }} className="ml-9 mt-3 rounded-lg border border-slate-200 bg-white p-2 dark:border-white/10 dark:bg-slate-950">
                    <label className="sr-only" htmlFor={`reply-${comment.id}`}>
                      Write a reply
                    </label>
                    <textarea id={`reply-${comment.id}`} autoFocus rows={2} maxLength={4000} value={replyDraft} onChange={(event) => { setReplyDraft(event.target.value); create.reset(); }} placeholder="Write a reply… Use @email to notify a teammate." className="w-full resize-y bg-transparent text-[10px] leading-relaxed outline-none placeholder:text-slate-400" />
                    <div className="flex justify-end gap-1.5 border-t border-slate-100 pt-2 dark:border-white/5">
                      <button type="button" onClick={() => { setReplyToId(null); setReplyDraft(''); }} className="rounded-md px-2 py-1 text-[9px] font-semibold text-slate-500">
                        Cancel
                      </button>
                      <button type="submit" disabled={!replyDraft.trim() || create.isPending} className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2 py-1 text-[9px] font-bold text-white disabled:opacity-45">
                        <Send size={10} />
                        {create.isPending ? 'Sending…' : 'Reply'}
                      </button>
                    </div>
                  </form>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center dark:border-white/10">
          <span className="mx-auto grid size-9 place-items-center rounded-xl bg-violet-50 text-violet-500 dark:bg-violet-500/10 dark:text-violet-300">
            <MessageSquare size={16} />
          </span>
          <p className="mt-3 text-[11px] font-bold text-slate-700 dark:text-slate-200">
            Start the discussion
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
            Share context, ask a question, or leave a note for your team.
          </p>
        </div>
      )}
      {!comments.isPending && !comments.isError && (comments.data?.length || 0) >= 200 && (
        <p className="text-center text-[9px] text-slate-400">Showing the latest 200 comments.</p>
      )}
    </section>
  );
}

// --- EMPTY CANVAS STATE ---
function CanvasEmpty({ onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-violet-300/80 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-8 text-center dark:border-violet-500/30 shadow-2xl shadow-violet-500/10 max-w-md mx-auto transition-all">
      <div className="space-y-4">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/20">
          <Sparkles size={22} className="animate-pulse" />
        </span>
        <h2 className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
          This dashboard has no nodes yet
        </h2>
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300 font-medium">
          Choose an element from the{' '}
          <strong className="font-extrabold text-violet-600 dark:text-violet-400">Elements</strong>{' '}
          panel on the left, load a template from{' '}
          <strong className="font-extrabold text-violet-600 dark:text-violet-400">Presets</strong>,
          or click below to start designing.
        </p>
        <div className="pt-2">
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-white shadow-lg shadow-violet-600/25 cursor-pointer hover:opacity-95 transition-all hover:scale-105 active:scale-95"
          >
            <Plus size={16} className="stroke-[2.5]" /> Add First Node
          </button>
        </div>
      </div>
    </div>
  );
}

// --- NODE PICKER DIALOG ---
function NodePicker({ onClose, onAdd }) {
  const options = useWidgetDefinitions();

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-slate-100 dark:border-white/5 pb-4">
          <div>
            <h2 className="text-lg font-bold">Add a widget</h2>
            <p className="mt-1 text-xs text-slate-400">
              Choose a registered widget for your dashboard.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 max-h-[380px] overflow-y-auto pr-1">
          {options.map((definition) => {
            const Icon = widgetIconComponents[definition.icon] || Layers;
            return (
              <button
              key={definition.type}
              onClick={() => onAdd(definition.type)}
              className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 text-left hover:border-violet-300 hover:bg-violet-500/5 cursor-pointer dark:border-white/10 dark:hover:border-violet-500/20"
            >
                <span className={`grid size-10 place-items-center rounded-xl shrink-0 bg-violet-500/10 ${widgetIconColors[definition.type] || 'text-violet-500'}`}>
                  <Icon size={20} />
                </span>
                <div>
                  <b className="text-sm font-bold text-slate-900 dark:text-white">
                    {definition.title}
                  </b>
                  <span className="mt-1 block text-xs leading-relaxed text-slate-400">
                    {definition.description}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EditorSkeleton() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-50 dark:bg-[#070a13] font-sans select-none">
      <style>{`
        @keyframes rotate-ring {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <div className="relative flex items-center justify-center size-36 shrink-0">
        <div className="absolute size-24 bg-violet-500/20 dark:bg-violet-600/15 rounded-full blur-xl animate-pulse pointer-events-none" />
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-violet-500/40 dark:border-violet-500/30 opacity-70 animate-[rotate-ring_12s_linear_infinite] pointer-events-none" />
        <div className="absolute inset-3 rounded-full border border-violet-500/60 dark:border-violet-400/50 border-t-transparent border-b-transparent animate-[rotate-ring_3s_linear_infinite_reverse] pointer-events-none" />
        <div className="relative z-10 flex items-center justify-center size-20">
          <img
            src={appIcon}
            alt="Voxel Logo"
            className="size-14 object-contain animate-pulse block dark:hidden"
          />
          <img
            src={appIconDark}
            alt="Voxel Logo"
            className="size-14 object-contain animate-pulse hidden dark:block"
          />
        </div>
      </div>
      <p className="mt-5 text-xs font-mono font-bold tracking-[0.2em] text-violet-600 dark:text-violet-400 uppercase animate-pulse">
        Initializing Canvas Editor...
      </p>
    </div>
  );
}

function TimerNode({ node, updateNode }) {
  const [timeRemaining, setTimeRemaining] = useState(node.duration || 300);

  useEffect(() => {
    let interval;
    if (node.timerState === 'running' && timeRemaining > 0) {
      interval = setInterval(() => {
        setTimeRemaining((t) => t - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [node.timerState, timeRemaining]);

  useEffect(() => {
    setTimeRemaining(node.duration || 300);
  }, [node.duration]);

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{node.title}</p>
      <div className="flex items-center justify-between">
        <span className="text-3xl font-extrabold font-mono tracking-tight text-amber-600 dark:text-amber-400">
          {timeStr}
        </span>
        <div className="flex gap-1.5">
          {node.timerState !== 'running' ? (
            <button
              onClick={() => updateNode(node.id, { timerState: 'running' })}
              className="px-2 py-1 text-[10px] font-bold rounded bg-amber-500 hover:bg-amber-400 text-white cursor-pointer"
            >
              Start
            </button>
          ) : (
            <button
              onClick={() => updateNode(node.id, { timerState: 'paused' })}
              className="px-2 py-1 text-[10px] font-bold rounded bg-slate-500 hover:bg-slate-400 text-white cursor-pointer"
            >
              Pause
            </button>
          )}
          <button
            onClick={() =>
              updateNode(node.id, { timerState: 'idle', duration: node.duration || 300 })
            }
            className="px-2 py-1 text-[10px] font-bold rounded border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer text-slate-600 dark:text-slate-300"
          >
            Reset
          </button>
        </div>
      </div>
      <span className="text-[10px] text-slate-400 block">
        {node.timerMode === 'countdown' ? 'Countdown active' : 'Stopwatch active'}
      </span>
    </div>
  );
}
