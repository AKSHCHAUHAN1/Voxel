import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';

import {
  BarChart3,
  FileText,
  GripVertical,
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
  Palette,
  Undo2,
  Redo2,
  Image,
  Code2,
  Table,
  Timer,
  Minus,
  Clock,
} from 'lucide-react';
import { workspaceService } from '@/features/workspaces/workspace-service';
import { useShortcut } from '@/lib/keyboard';
import { useHistoryStore } from '@/store/history-store';
import { VersionHistory } from './VersionHistory';
import { useYjs } from './use-yjs';
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

  const parsedNodes = candidate.nodes.map((node, index) => {
    const x = typeof node.x === 'number' ? node.x : (index % 3) * 310 + 40;
    const y = typeof node.y === 'number' ? node.y : Math.floor(index / 3) * 230 + 40;
    return { ...node, x, y };
  });

  return {
    schemaVersion: candidate.schemaVersion ?? 2,
    nodes: parsedNodes,
    connections: Array.isArray(candidate.connections) ? candidate.connections : [],
    gridStyle: candidate.gridStyle ?? 'dots',
  };
};

// Node Defaults builder
const newNode = (type) => {
  const defaults = {
    note: {
      title: 'Untitled Note',
      content: 'Start writing useful context for your team.',
      size: 'wide',
      color: 'slate',
    },
    metric: {
      title: 'Monthly Goal',
      content: '5400',
      unit: '$',
      size: 'medium',
      color: 'indigo',
    },
    progress: {
      title: 'Progress Target',
      content: '65',
      target: 100,
      size: 'medium',
      color: 'emerald',
    },
    chart: {
      title: 'Traffic Trend',
      content: '10,25,18,30,45,28,60',
      size: 'medium',
      color: 'cyan',
    },
    status: {
      title: 'System Health',
      content: 'Operational',
      statusColor: 'success',
      size: 'small',
      color: 'emerald',
    },
    logic: {
      title: 'Calculated Cost',
      content: '0',
      logicA: '150',
      logicB: '2.5',
      logicOp: '*',
      size: 'medium',
      color: 'violet',
    },
    image: {
      title: 'Image Showcase',
      imageUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60',
      objectFit: 'cover',
      size: 'medium',
      color: 'slate',
    },
    embed: {
      title: 'Figma Embed',
      embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      size: 'wide',
      color: 'slate',
    },
    table: {
      title: 'Data Grid',
      columns: 'Item,Qty,Status',
      rows: 'Widget A,12,Done\nWidget B,4,Pending\nWidget C,19,Active',
      size: 'wide',
      color: 'slate',
    },
    timer: {
      title: 'Sprint Timer',
      duration: 300,
      timerMode: 'countdown',
      timerState: 'idle',
      size: 'medium',
      color: 'amber',
    },
    link: {
      title: 'Reference Link',
      url: 'https://github.com',
      description: 'Check out code templates and tools.',
      size: 'medium',
      color: 'cyan',
    },
    divider: {
      title: 'Section Divider',
      dividerStyle: 'solid',
      size: 'wide',
      color: 'slate',
    },
    code: {
      title: 'Utility Snippet',
      code: 'function hello() {\n  console.log("Hello, Voxel!");\n}',
      language: 'javascript',
      size: 'wide',
      color: 'slate',
    },
  };

  return {
    id: crypto.randomUUID(),
    type,
    title: defaults[type].title || 'Untitled Node',
    content: defaults[type].content || '',
    size: defaults[type].size || 'medium',
    color: defaults[type].color || 'slate',
    borderStyle: 'solid',
    fontSize: 'regular',
    headerStyle: 'simple',
    ...defaults[type],
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

export default function EditorPage() {
  const { workspaceId, dashboardId } = useParams();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [coordinates, setCoordinates] = useState({});
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

  const dashboard = useQuery({
    queryKey: ['dashboard', dashboardId],
    queryFn: () => workspaceService.dashboard(dashboardId),
    enabled: Boolean(dashboardId),
  });

  const { scene: yScene, updateScene, awareness, awarenessStates } = useYjs(dashboardId, dashboard.data?.scene);

  const scene = useMemo(
    () => sceneOf(yScene || dashboard.data?.scene),
    [dashboard.data?.scene, yScene],
  );

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
        },
        {
          id: chartId,
          type: 'chart',
          title: 'Incoming Traffic (24h)',
          content: '12,24,18,32,45,28,38',
          size: 'medium',
          color: 'violet',
          borderStyle: 'solid',
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
        },
        {
          id: trendId,
          type: 'chart',
          title: 'Weekly Profit Margin',
          content: '1100,1250,1190,1450,1950,1850,2300',
          size: 'large',
          color: 'indigo',
          borderStyle: 'solid',
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
        },
        {
          id: crypto.randomUUID(),
          type: 'divider',
          title: 'Development Links',
          dividerStyle: 'dashed',
          size: 'wide',
          color: 'slate',
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

    if (node.type === 'logic') {
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
      slate: '100, 116, 139',
      blue: '59, 130, 246',
      violet: '124, 58, 237',
      rose: '244, 63, 94',
      emerald: '16, 185, 129',
    };
    const preset = scene.gridColorPreset ?? 'violet';
    const rgb = colorPresets[preset];
    const opacity = scene.gridOpacity ?? 0.06;
    const thickness = scene.gridThickness ?? 1.2;
    const size = scene.gridSize ?? 24;
    switch (scene.gridStyle) {
      case 'dots':
        return {
          backgroundImage: `radial-gradient(circle, rgba(${rgb}, ${opacity}) ${thickness}px, transparent ${thickness}px)`,
          backgroundSize: `${size}px ${size}px`,
        };
      case 'lines':
        return {
          backgroundImage: `linear-gradient(rgba(${rgb}, ${opacity}) ${thickness}px, transparent ${thickness}px), linear-gradient(90deg, rgba(${rgb}, ${opacity}) ${thickness}px, transparent ${thickness}px)`,
          backgroundSize: `${size}px ${size}px`,
        };
      case 'radial':
        return {
          backgroundImage: `radial-gradient(circle at center, rgba(${rgb}, ${opacity * 3.5}) 0%, transparent 100%)`,
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

  const [gridDropdownOpen, setGridDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setGridDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Dynamic coordinates math supporting canvas scrolling
  const recalculateCoordinates = () => {
    if (!gridRef.current) return;
    const gridRect = gridRef.current.getBoundingClientRect();
    const coords = {};
    scene.nodes.forEach((node) => {
      const element = document.getElementById(`node-card-${node.id}`);
      if (element) {
        const rect = element.getBoundingClientRect();
        coords[node.id] = {
          x: rect.left + rect.width / 2 - gridRect.left + (gridRef.current?.scrollLeft || 0),
          y: rect.top + rect.height / 2 - gridRect.top + (gridRef.current?.scrollTop || 0),
        };
      }
    });
    setCoordinates(coords);
  };

  useEffect(() => {
    const timer = setTimeout(recalculateCoordinates, 100);
    const scrollContainer = gridRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', recalculateCoordinates);
    }
    window.addEventListener('resize', recalculateCoordinates);
    return () => {
      clearTimeout(timer);
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', recalculateCoordinates);
      }
      window.removeEventListener('resize', recalculateCoordinates);
    };
  }, [scene.nodes, yScene]);


  const update = (next, skipHistory = false) => {
    if (!skipHistory) {
      useHistoryStore.getState().push(scene);
    }
    updateScene(next);
  };

  // Autosave Engine
  useEffect(() => {
    if (!yScene) return;
    const timer = setTimeout(() => {
      save.mutate(yScene);
    }, 2000);
    return () => clearTimeout(timer);
  }, [yScene, save.mutate]);

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
    const x = e.clientX - rect.left + scrollContainer.scrollLeft;
    const y = e.clientY - rect.top + scrollContainer.scrollTop;
    awareness.setLocalStateField('cursor', { x, y });
  }, [awareness]);

  const handlePointerLeave = useCallback(() => {
    if (!awareness) return;
    awareness.setLocalStateField('cursor', null);
  }, [awareness]);

  const handleUndo = () => {
    const prev = useHistoryStore.getState().undo(scene);
    if (prev) {
      update(prev, true);
    }
  };

  const handleRedo = () => {
    const next = useHistoryStore.getState().redo(scene);
    if (next) {
      update(next, true);
    }
  };

  const copiedNodeRef = useRef(null);

  const handleCopy = () => {
    if (!selectedNodeId) return;
    const selected = scene.nodes.find((n) => n.id === selectedNodeId);
    if (selected) {
      copiedNodeRef.current = selected;
      localStorage.setItem('voxel_copied_node', JSON.stringify(selected));
    }
  };

  const handlePaste = () => {
    let raw = copiedNodeRef.current;
    if (!raw) {
      try {
        const stored = localStorage.getItem('voxel_copied_node');
        if (stored) raw = JSON.parse(stored);
      } catch (err) {
        // ignore
      }
    }
    if (!raw) return;
    const pasted = {
      ...raw,
      id: crypto.randomUUID(),
      x: (raw.x ?? 100) + 25,
      y: (raw.y ?? 100) + 25,
    };
    update({
      ...scene,
      nodes: [...scene.nodes, pasted],
    });
    setSelectedNodeId(pasted.id);
  };

  const handleDeleteSelected = () => {
    if (selectedNodeId) {
      deleteNode(selectedNodeId);
    }
  };

  const handleSave = () => {
    if (yScene) {
      save.mutate(scene);
    }
  };

  const handleRestoreVersion = (ver) => {
    setConfirmModal({
      isOpen: true,
      title: `Restore Version #${ver.version}?`,
      message: `Are you sure you want to revert your current layout to Version #${ver.version}? All unsaved changes will be replaced.`,
      confirmText: 'Restore Version',
      type: 'warning',
      onConfirm: () => {
        setConfirmModal({ isOpen: false });
        update(ver.scene);
      },
      onCancel: () => setConfirmModal({ isOpen: false }),
    });
  };

  // Keyboard shortcut registrations
  useShortcut('meta+z', handleUndo, { label: 'Undo change', category: 'Editor' }, [scene]);
  useShortcut('meta+shift+z', handleRedo, { label: 'Redo change', category: 'Editor' }, [scene]);
  useShortcut('meta+c', handleCopy, { label: 'Copy selected node', category: 'Editor' }, [selectedNodeId, scene]);
  useShortcut('meta+v', handlePaste, { label: 'Paste copied node', category: 'Editor' }, [scene]);
  useShortcut('backspace', handleDeleteSelected, { label: 'Delete selected node', category: 'Editor' }, [selectedNodeId, scene]);
  useShortcut('delete', handleDeleteSelected, { label: 'Delete selected node', category: 'Editor' }, [selectedNodeId, scene]);
  useShortcut('meta+s', handleSave, { label: 'Save dashboard changes', category: 'Editor' }, [yScene, scene]);

  const add = (type) => {
    update({ ...scene, nodes: [...scene.nodes, newNode(type)] });
    setPickerOpen(false);
  };

  const handleDragStart = (e, nodeId) => {
    if (e.button !== 0) return;
    e.preventDefault();

    const node = scene.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const initX = node.x ?? 100;
    const initY = node.y ?? 100;

    let rafId = null;

    const handleMouseMove = (moveEvent) => {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;

        const current = scene;
        update(
          {
            ...current,
            nodes: current.nodes.map((n) =>
              n.id === nodeId ? { ...n, x: Math.max(0, initX + dx), y: Math.max(0, initY + dy) } : n,
            ),
          },
          true
        );
      });
    };

    const handleMouseUp = () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      useHistoryStore.getState().push(scene);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const updateNode = (id, updates) => {
    const nextNodes = scene.nodes.map((node) => (node.id === id ? { ...node, ...updates } : node));
    update({ ...scene, nodes: nextNodes });
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
    <section className="fixed inset-0 z-50 flex flex-col overflow-hidden bg-slate-50 dark:bg-[#030509]">
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
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 bg-white/80 px-5 backdrop-blur-md dark:border-white/5 dark:bg-slate-950/80 sm:px-8 relative z-30">
        <div className="flex items-center gap-3">
          <Link
            to={`/workspaces/${workspaceId}/dashboards`}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-650 dark:hover:bg-white/5 dark:hover:text-slate-355 transition"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-sm font-extrabold text-slate-900 dark:text-white leading-tight">
              {dashboard.data?.name || 'Dashboard'}
            </h1>
            <p className="text-[9px] uppercase tracking-widest text-violet-650 dark:text-violet-400 font-extrabold mt-0.5">
              Freeform Workspace
            </p>
          </div>
        </div>

        {/* Toolbar Settings */}
        <div className="flex flex-wrap items-center gap-3 relative">
          {/* Preset templates dropdown */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 py-1.5 dark:border-white/5 bg-slate-50 dark:bg-slate-900 text-xs font-bold">
            <span className="text-slate-400 uppercase tracking-wider text-[8px]">Preset:</span>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  loadPreset(e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
              className="bg-transparent font-bold text-xs focus:outline-none cursor-pointer text-slate-700 dark:text-slate-300"
            >
              <option value="">Load Template...</option>
              <option value="server">Server Monitor</option>
              <option value="business">Sales Performance</option>
              <option value="tasks">Sprint Backlog</option>
              <option value="devhub">Developer Hub</option>
              <option value="ops">Operations Center</option>
            </select>
          </div>

          {/* Grid Settings Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setGridDropdownOpen(!gridDropdownOpen)}
              className={`inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold uppercase tracking-wider hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5 transition cursor-pointer ${
                gridDropdownOpen
                  ? 'bg-slate-100 dark:bg-white/5 text-violet-650'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              <Palette size={14} /> Grid Settings
            </button>

            {gridDropdownOpen && (
              <div className="absolute right-0 mt-2 w-72 bg-white/95 dark:bg-[#0e1320]/95 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-xl rounded-2xl p-4 z-40 space-y-4">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 border-b border-slate-100 dark:border-white/5 pb-2">
                  Grid Customization
                </div>

                {/* Grid Style Toggle */}
                <div className="space-y-1">
                  <span className="text-[8px] font-extrabold uppercase tracking-widest text-slate-400">
                    Pattern Style
                  </span>
                  <div className="flex items-center gap-0.5 rounded-xl border border-slate-200/60 p-0.5 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900">
                    {['dots', 'lines', 'radial', 'blank'].map((style) => (
                      <button
                        key={style}
                        onClick={() => update({ ...scene, gridStyle: style })}
                        className={`flex-1 rounded-lg py-1.5 text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-all ${
                          scene.gridStyle === style
                            ? 'bg-white text-violet-600 shadow-sm dark:bg-slate-800 dark:text-violet-400'
                            : 'text-slate-400 hover:text-slate-655 dark:hover:text-slate-200'
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                {scene.gridStyle !== 'blank' && (
                  <>
                    {/* Spacing / Size Slider */}
                    {scene.gridStyle !== 'radial' && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[8px] font-extrabold uppercase tracking-widest text-slate-400">
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

                    {/* Opacity / Strength Slider */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[8px] font-extrabold uppercase tracking-widest text-slate-400">
                        <span>Grid Opacity</span>
                        <span>{Math.round((scene.gridOpacity ?? 0.06) * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.01"
                        max="0.25"
                        step="0.01"
                        value={scene.gridOpacity ?? 0.06}
                        onChange={(e) =>
                          update({ ...scene, gridOpacity: parseFloat(e.target.value) })
                        }
                        className="w-full h-1 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-600"
                      />
                    </div>

                    {/* Thickness Slider */}
                    {scene.gridStyle !== 'radial' && (
                      <div className="space-y-1">
                        <div className="flex justify-between text-[8px] font-extrabold uppercase tracking-widest text-slate-400">
                          <span>Grid Thickness</span>
                          <span>{scene.gridThickness ?? 1.2}px</span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="3.0"
                          step="0.1"
                          value={scene.gridThickness ?? 1.2}
                          onChange={(e) =>
                            update({ ...scene, gridThickness: parseFloat(e.target.value) })
                          }
                          className="w-full h-1 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-600"
                        />
                      </div>
                    )}

                    {/* Grid Color Presets */}
                    <div className="space-y-1">
                      <span className="text-[8px] font-extrabold uppercase tracking-widest text-slate-400">
                        Grid Color Preset
                      </span>
                      <div className="flex gap-2.5 pt-1.5">
                        {[
                          { id: 'slate', color: 'bg-slate-400' },
                          { id: 'blue', color: 'bg-blue-500' },
                          { id: 'violet', color: 'bg-violet-500' },
                          { id: 'rose', color: 'bg-rose-500' },
                          { id: 'emerald', color: 'bg-emerald-500' },
                        ].map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => update({ ...scene, gridColorPreset: preset.id })}
                            className={`size-4.5 rounded-full border border-white/20 transition hover:scale-110 ${preset.color} ${
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
              </div>
            )}
          </div>

          <div className="flex items-center border border-slate-200 dark:border-white/5 rounded-xl overflow-hidden mr-1">
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo (⌘Z)"
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-30 transition cursor-pointer"
            >
              <Undo2 size={14} />
            </button>
            <div className="w-px h-4 bg-slate-200 dark:bg-white/5" />
            <button
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo (⌘⇧Z)"
              className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 disabled:opacity-30 transition cursor-pointer"
            >
              <Redo2 size={14} />
            </button>
          </div>

          <button
            onClick={() => {
              setVersionHistoryOpen((prev) => !prev);
              setSelectedNodeId(null);
            }}
            title="Version History"
            className={`p-2 rounded-xl border transition cursor-pointer flex items-center justify-center ${
              versionHistoryOpen
                ? 'border-violet-500 bg-violet-50/10 text-violet-600 dark:text-violet-400'
                : 'border-slate-200 text-slate-600 dark:border-white/5 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
            }`}
          >
            <Clock size={14} />
          </button>

          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500 mr-2 flex items-center gap-1.5">
            <span className={`inline-block size-1.5 rounded-full ${save.isPending ? 'bg-amber-500 animate-pulse' : draft ? 'bg-violet-500' : 'bg-emerald-500'}`} />
            {save.isPending ? 'Saving…' : draft ? 'Unsaved changes (Autosaving)' : 'All changes saved'}
          </span>

          <button
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold uppercase tracking-wider hover:bg-slate-50 dark:border-white/5 dark:hover:bg-white/5 transition cursor-pointer"
          >
            <Plus size={14} /> Node
          </button>

          <button
            disabled={!draft || save.isPending}
            onClick={() => save.mutate(scene)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white hover:opacity-95 disabled:opacity-50 transition cursor-pointer shadow-lg shadow-violet-600/10"
          >
            <Save size={14} /> {save.isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      {/* --- GRID EDITOR WORKSPACE --- */}
      <div className="flex flex-1 flex-col lg:flex-row relative">
        <main
          onClick={() => setSelectedNodeId(null)}
          className="flex-1 overflow-hidden relative bg-slate-50 dark:bg-[#030509] min-h-[500px] z-10"
        >
          {/* Scrollable Container */}
          <div
            ref={gridRef}
            className="w-full h-full overflow-auto relative p-6 no-scrollbars flex-1"
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
          >
            {/* The infinite board sheet */}
            <div
              className="relative select-none transition-all duration-300 min-h-full min-w-full flex flex-col justify-center"
              style={{
                width: '100%',
                height: '100%',
                ...gridStyleInline,
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

                  const dx = endX - startX;
                  const dy = endY - startY;
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
              <div className="relative z-10 w-full h-full p-12">
                {scene.nodes.length ? (
                  <NodeGrid
                    nodes={scene.nodes}
                    selectedNodeId={selectedNodeId}
                    onSelectNode={setSelectedNodeId}
                    resolveNodeValue={resolveNodeValue}
                    onDragStart={handleDragStart}
                    updateNode={updateNode}
                    awarenessStates={awarenessStates}
                    localClientId={awareness?.clientID}
                  />
                ) : (
                  <CanvasEmpty onAdd={() => setPickerOpen(true)} />
                )}
              </div>
            </div>
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

        {/* --- NODE PROPERTY INSPECTOR --- */}
        {selectedNodeId &&
          (() => {
            const selectedNode = scene.nodes.find((node) => node.id === selectedNodeId);
            if (!selectedNode) return null;
            return (
              <aside className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-950 flex flex-col justify-between min-h-[400px] lg:min-h-0 relative z-20">
                <div className="space-y-5 overflow-y-auto max-h-[calc(100vh-180px)] pb-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 rounded px-1.5 py-0.5 uppercase tracking-wide">
                        {selectedNode.type}
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
                        value={selectedNode.title}
                        onChange={(e) => updateNode(selectedNode.id, { title: e.target.value })}
                        className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10"
                      />
                    </div>

                    {/* Common fields: Value Source mode */}
                    {selectedNode.type !== 'logic' && (
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

                    {selectedNode.type !== 'logic' &&
                      selectedNode.valueSource === 'connections' && (
                        <div className="space-y-2 border border-violet-100 p-2.5 rounded-lg dark:border-white/5 bg-violet-50/20 dark:bg-violet-950/5">
                          <div>
                            <label className="text-[10px] font-bold text-violet-500 uppercase tracking-wider block mb-1">
                              Aggregation Formula
                            </label>
                            <select
                              value={selectedNode.aggregationOperator || 'sum'}
                              onChange={(e) =>
                                updateNode(selectedNode.id, { aggregationOperator: e.target.value })
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
                                    No connections. Draw an arrow from another node to link them.
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

                    {/* Node Type Content Configurations */}
                    {selectedNode.type === 'note' && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                          Note Content
                        </label>
                        {selectedNode.valueSource !== 'connections' ? (
                          <textarea
                            value={selectedNode.content}
                            rows={4}
                            onChange={(e) =>
                              updateNode(selectedNode.id, { content: e.target.value })
                            }
                            className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10 resize-y"
                          />
                        ) : (
                          <div className="text-xs italic text-slate-400 p-3 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10">
                            Automatically resolves to: <b>{resolveNodeValue(selectedNode)}</b>
                          </div>
                        )}
                      </div>
                    )}

                    {selectedNode.type === 'metric' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                            Value
                          </label>
                          {selectedNode.valueSource !== 'connections' ? (
                            <input
                              type="text"
                              value={selectedNode.content}
                              onChange={(e) =>
                                updateNode(selectedNode.id, { content: e.target.value })
                              }
                              className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10"
                            />
                          ) : (
                            <div className="text-xs font-semibold font-mono text-slate-400 p-2.5 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10">
                              {resolveNodeValue(selectedNode)}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                            Unit
                          </label>
                          <input
                            type="text"
                            value={selectedNode.unit || ''}
                            placeholder="e.g. $, %, /s"
                            onChange={(e) => updateNode(selectedNode.id, { unit: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10"
                          />
                        </div>
                      </div>
                    )}

                    {selectedNode.type === 'progress' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                            Current Value
                          </label>
                          {selectedNode.valueSource !== 'connections' ? (
                            <input
                              type="number"
                              value={selectedNode.content}
                              onChange={(e) =>
                                updateNode(selectedNode.id, { content: e.target.value })
                              }
                              className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10"
                            />
                          ) : (
                            <div className="text-xs font-semibold font-mono text-slate-400 p-2.5 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10">
                              {resolveNodeValue(selectedNode)}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                            Target Goal
                          </label>
                          <input
                            type="number"
                            value={selectedNode.target || 100}
                            onChange={(e) =>
                              updateNode(selectedNode.id, {
                                target: parseInt(e.target.value) || 100,
                              })
                            }
                            className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10"
                          />
                        </div>
                      </div>
                    )}

                    {selectedNode.type === 'chart' && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                          Sparkline Data (CSV)
                        </label>
                        {selectedNode.valueSource !== 'connections' ? (
                          <input
                            type="text"
                            value={selectedNode.content}
                            placeholder="10, 20, 15, 30"
                            onChange={(e) =>
                              updateNode(selectedNode.id, { content: e.target.value })
                            }
                            className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10 font-mono"
                          />
                        ) : (
                          <div className="text-xs font-semibold font-mono text-slate-400 p-2.5 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10">
                            {resolveNodeValue(selectedNode)}
                          </div>
                        )}
                        <span className="text-[10px] text-slate-400 mt-1 block">
                          Comma separated coordinates list
                        </span>
                      </div>
                    )}

                    {selectedNode.type === 'status' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                            Message
                          </label>
                          {selectedNode.valueSource !== 'connections' ? (
                            <input
                              type="text"
                              value={selectedNode.content}
                              onChange={(e) =>
                                updateNode(selectedNode.id, { content: e.target.value })
                              }
                              className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10"
                            />
                          ) : (
                            <div className="text-xs font-semibold font-mono text-slate-400 p-2.5 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10">
                              {resolveNodeValue(selectedNode)}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                            Color/State
                          </label>
                          <select
                            value={selectedNode.statusColor || 'success'}
                            onChange={(e) =>
                              updateNode(selectedNode.id, { statusColor: e.target.value })
                            }
                            className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10 dark:bg-slate-900"
                          >
                            <option value="success">Success (Green)</option>
                            <option value="warning">Warning (Yellow)</option>
                            <option value="error">Error (Red)</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {selectedNode.type === 'logic' && (
                      <div className="space-y-2 border border-slate-100 p-2.5 rounded-lg dark:border-white/5 bg-slate-50 dark:bg-slate-900/30">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                            Input Source A
                          </label>
                          <select
                            value={selectedNode.logicA || ''}
                            onChange={(e) =>
                              updateNode(selectedNode.id, { logicA: e.target.value })
                            }
                            className="w-full rounded-lg border border-slate-200 bg-transparent px-2.5 py-1.5 text-xs focus:outline-none dark:border-white/10 dark:bg-slate-900"
                          >
                            <option value="">Choose node...</option>
                            {scene.nodes
                              .filter((n) => n.id !== selectedNode.id && n.type !== 'note')
                              .map((n) => (
                                <option key={n.id} value={n.id}>
                                  {n.title} ({n.content})
                                </option>
                              ))}
                          </select>
                        </div>

                        <div className="flex justify-center">
                          <select
                            value={selectedNode.logicOp || '*'}
                            onChange={(e) =>
                              updateNode(selectedNode.id, { logicOp: e.target.value })
                            }
                            className="rounded-md border border-slate-200 px-2 py-1 text-xs font-bold dark:border-white/10 dark:bg-slate-900"
                          >
                            <option value="+">+</option>
                            <option value="-">-</option>
                            <option value="*">×</option>
                            <option value="/">÷</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                            Input Source B
                          </label>
                          <select
                            value={selectedNode.logicB || ''}
                            onChange={(e) =>
                              updateNode(selectedNode.id, { logicB: e.target.value })
                            }
                            className="w-full rounded-lg border border-slate-200 bg-transparent px-2.5 py-1.5 text-xs focus:outline-none dark:border-white/10 dark:bg-slate-900"
                          >
                            <option value="">Choose node...</option>
                            {scene.nodes
                              .filter((n) => n.id !== selectedNode.id && n.type !== 'note')
                              .map((n) => (
                                <option key={n.id} value={n.id}>
                                  {n.title} ({n.content})
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                    )}
                    {selectedNode.type === 'image' && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                            Image URL
                          </label>
                          <input
                            type="text"
                            value={selectedNode.imageUrl || ''}
                            onChange={(e) => updateNode(selectedNode.id, { imageUrl: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                            Image Layout Fit
                          </label>
                          <select
                            value={selectedNode.objectFit || 'cover'}
                            onChange={(e) => updateNode(selectedNode.id, { objectFit: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10 dark:bg-slate-900"
                          >
                            <option value="cover">Cover (Fill Container)</option>
                            <option value="contain">Contain (Fit Aspect Ratio)</option>
                            <option value="fill">Fill (Stretch to fit)</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {selectedNode.type === 'embed' && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                          Embed URL
                        </label>
                        <input
                          type="text"
                          value={selectedNode.embedUrl || ''}
                          onChange={(e) => updateNode(selectedNode.id, { embedUrl: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10"
                        />
                      </div>
                    )}

                    {selectedNode.type === 'table' && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                            Columns (Comma Separated)
                          </label>
                          <input
                            type="text"
                            value={selectedNode.columns || ''}
                            onChange={(e) => updateNode(selectedNode.id, { columns: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                            Rows (Comma values per line)
                          </label>
                          <textarea
                            value={selectedNode.rows || ''}
                            rows={4}
                            onChange={(e) => updateNode(selectedNode.id, { rows: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10 font-mono text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {selectedNode.type === 'timer' && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                            Duration (Seconds)
                          </label>
                          <input
                            type="number"
                            value={selectedNode.duration || 300}
                            onChange={(e) => updateNode(selectedNode.id, { duration: parseInt(e.target.value) || 0 })}
                            className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                            Timer Mode
                          </label>
                          <select
                            value={selectedNode.timerMode || 'countdown'}
                            onChange={(e) => updateNode(selectedNode.id, { timerMode: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10 dark:bg-slate-900"
                          >
                            <option value="countdown">Countdown</option>
                            <option value="stopwatch">Stopwatch</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {selectedNode.type === 'link' && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                            Link URL
                          </label>
                          <input
                            type="text"
                            value={selectedNode.url || ''}
                            onChange={(e) => updateNode(selectedNode.id, { url: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                            Link Description
                          </label>
                          <input
                            type="text"
                            value={selectedNode.description || ''}
                            onChange={(e) => updateNode(selectedNode.id, { description: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10"
                          />
                        </div>
                      </div>
                    )}

                    {selectedNode.type === 'divider' && (
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                          Divider Style
                        </label>
                        <select
                          value={selectedNode.dividerStyle || 'solid'}
                          onChange={(e) => updateNode(selectedNode.id, { dividerStyle: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10 dark:bg-slate-900"
                        >
                          <option value="solid">Solid Line</option>
                          <option value="dashed">Dashed Line</option>
                          <option value="dotted">Dotted Line</option>
                        </select>
                      </div>
                    )}

                    {selectedNode.type === 'code' && (
                      <div className="space-y-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                            Language
                          </label>
                          <select
                            value={selectedNode.language || 'javascript'}
                            onChange={(e) => updateNode(selectedNode.id, { language: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10 dark:bg-slate-900"
                          >
                            <option value="javascript">JavaScript</option>
                            <option value="html">HTML</option>
                            <option value="css">CSS</option>
                            <option value="python">Python</option>
                            <option value="json">JSON</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                            Code Block
                          </label>
                          <textarea
                            value={selectedNode.code || ''}
                            rows={6}
                            onChange={(e) => updateNode(selectedNode.id, { code: e.target.value })}
                            className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-xs focus:outline-none focus:border-violet-500 dark:border-white/10 font-mono leading-normal"
                          />
                        </div>
                      </div>
                    )}

                    {/* Sizing Tiers */}
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                        Grid Column Span
                      </label>
                      <select
                        value={selectedNode.size}
                        onChange={(e) => updateNode(selectedNode.id, { size: e.target.value })}
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
                          {['slate', 'violet', 'emerald', 'rose', 'amber', 'indigo', 'cyan'].map(
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
                            ),
                          )}
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
                        <label className="text-[10px] block mb-1 text-slate-500">Font Size</label>
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
              </aside>
            );
          })()}
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
        .filter(([clientId, state]) => clientId !== awareness?.clientID && state.user && state.cursor)
        .map(([clientId, state]) => (
          <div
            key={clientId}
            className="absolute z-[100] pointer-events-none flex flex-col items-start"
            style={{
              left: state.cursor.x,
              top: state.cursor.y,
              transform: 'translate(-2px, -2px)',
            }}
          >
            {/* Custom SVG Mouse Pointer */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill={state.user.color} xmlns="http://www.w3.org/2000/svg" style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.15))' }}>
              <path d="M4.321 2.302L20.407 10.963C21.411 11.503 21.282 12.983 20.198 13.355L13.916 15.513L11.758 21.795C11.386 22.879 9.906 23.008 9.366 22.004L0.705 5.918C0.218 5.021 1.025 4.053 1.961 4.472L4.321 2.302Z" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <div
              className="mt-1 ml-4 px-2 py-1 text-[10px] font-bold text-white rounded shadow-sm whitespace-nowrap"
              style={{ backgroundColor: state.user.color }}
            >
              {state.user.name}
            </div>
          </div>
        ))}
    </section>
  );
}

// --- FREEFORM GRID SETUP ---
function NodeGrid({ nodes, selectedNodeId, onSelectNode, resolveNodeValue, onDragStart, updateNode, awarenessStates, localClientId }) {
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
        <CanvasNodeCard
          key={node.id}
          node={node}
          isSelected={node.id === selectedNodeId}
          remoteSelectedBy={remoteSelections[node.id] || []}
          onSelect={() => onSelectNode(node.id)}
          resolveNodeValue={resolveNodeValue}
          onDragStart={onDragStart}
          updateNode={updateNode}
        />
      ))}
    </div>
  );
}

// --- CANVAS CARD COMPONENT ---
function CanvasNodeCard({ node, isSelected, remoteSelectedBy, onSelect, resolveNodeValue, onDragStart, updateNode }) {
  const displayValue = resolveNodeValue(node);
  // Icon picker based on type
  const nodeIcon = useMemo(() => {
    switch (node.type) {
      case 'note':
        return <FileText size={18} className="text-violet-500" />;
      case 'metric':
        return <BarChart3 size={18} className="text-cyan-500" />;
      case 'progress':
        return <Layers size={18} className="text-amber-500" />;
      case 'chart':
        return <Activity size={18} className="text-indigo-500" />;
      case 'status':
        return <CheckCircle size={18} className="text-emerald-500" />;
      case 'logic':
        return <Cpu size={18} className="text-pink-500" />;
    }
  }, [node.type]);

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
    if (node.type !== 'chart') return [];
    return displayValue
      .split(',')
      .map((val) => parseFloat(val.trim()))
      .filter((n) => !isNaN(n));
  }, [displayValue, node.type]);

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
        width: `${widthOf(node.size)}px`,
        zIndex: isSelected ? 30 : 10,
        willChange: 'left, top',
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
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
          {nodeIcon} {node.type}
        </span>
        <GripVertical size={14} className="opacity-60" />
      </div>

      {/* --- RENDERING CARD CONTENT DYNAMICALLY --- */}

      {/* 1. Note */}
      {node.type === 'note' && (
        <div className="space-y-2">
          <h2 className={`${textFonts[node.fontSize || 'regular']} font-bold`}>{node.title}</h2>
          <p className="max-w-2xl whitespace-pre-wrap text-sm leading-6 text-slate-500 dark:text-slate-400">
            {displayValue}
          </p>
        </div>
      )}

      {/* 2. Metric */}
      {node.type === 'metric' && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            {node.title}
          </p>
          <div className="flex items-baseline gap-1 mt-1">
            {node.unit && <span className="text-2xl font-semibold opacity-60">{node.unit}</span>}
            <span className="text-4xl font-extrabold tracking-tight font-mono">{displayValue}</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-2">Streaming data ready</span>
        </div>
      )}

      {/* 3. Progress Goal Bar */}
      {node.type === 'progress' &&
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
      {node.type === 'chart' &&
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
      {node.type === 'status' &&
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
                  <span className="text-[10px] text-slate-400">Monitoring relay active</span>
                </div>
              </div>
            </div>
          );
        })()}

      {/* 6. Math Logic Calculation Node */}
      {node.type === 'logic' &&
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
      {node.type === 'image' && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{node.title}</p>
          <div className="w-full h-32 rounded-lg overflow-hidden bg-slate-100 dark:bg-white/5 relative">
            <img
              src={node.imageUrl}
              alt={node.title}
              className={`w-full h-full object-${node.objectFit || 'cover'}`}
              onError={(e) => {
                e.target.src = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60';
              }}
            />
          </div>
        </div>
      )}

      {/* 8. Embed */}
      {node.type === 'embed' && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{node.title}</p>
          <div className="w-full h-32 rounded-lg overflow-hidden bg-slate-100 dark:bg-white/5 relative">
            <iframe
              src={node.embedUrl}
              title={node.title}
              className="w-full h-full border-0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      )}

      {/* 9. Table */}
      {node.type === 'table' && (() => {
        const cols = (node.columns || '').split(',').map(c => c.trim()).filter(Boolean);
        const rows = (node.rows || '').split('\n').map(r => r.split(',').map(c => c.trim()));
        return (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{node.title}</p>
            <div className="w-full overflow-x-auto rounded-lg border border-slate-200/50 dark:border-white/5 no-scrollbars">
              <table className="w-full text-[11px] text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 border-b border-slate-200/50 dark:border-white/5">
                    {cols.map((col, idx) => (
                      <th key={idx} className="px-2 py-1.5 font-bold uppercase tracking-wider">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {rows.map((row, rIdx) => (
                    <tr key={rIdx} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-2 py-1.5 truncate max-w-[120px]">{cell}</td>
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
      {node.type === 'timer' && (
        <TimerNode node={node} updateNode={updateNode} />
      )}

      {/* 11. Link Card */}
      {node.type === 'link' && (
        <a
          href={node.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block group/link space-y-2 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide group-hover/link:text-violet-600 dark:group-hover/link:text-violet-400 transition-colors">{node.title}</p>
            <LinkIcon size={12} className="text-slate-400 group-hover/link:translate-x-0.5 transition-transform" />
          </div>
          <div className="p-2.5 rounded-lg border border-slate-200/50 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 hover:bg-slate-100/50 transition-colors">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{node.url}</p>
            <p className="text-[10px] text-slate-400 mt-1 line-clamp-2">{node.description}</p>
          </div>
        </a>
      )}

      {/* 12. Divider */}
      {node.type === 'divider' && (
        <div className="py-2.5">
          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">{node.title}</p>
          <div className={`w-full border-t border-${node.dividerStyle || 'solid'} border-slate-300 dark:border-white/10`} />
        </div>
      )}

      {/* 13. Code Block */}
      {node.type === 'code' && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{node.title}</p>
          <pre className="p-2.5 rounded-lg bg-slate-900 text-slate-100 text-[10px] font-mono overflow-x-auto leading-relaxed border border-white/5">
            <code>{node.code}</code>
          </pre>
        </div>
      )}
    </article>
  );
}

// --- EMPTY CANVAS STATE ---
function CanvasEmpty({ onAdd }) {
  return (
    <div className="grid min-h-[400px] place-items-center rounded-3xl border border-dashed border-violet-300 bg-violet-50/60 p-8 text-center dark:border-violet-500/30 dark:bg-violet-500/5">
      <div className="max-w-md mx-auto space-y-4">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-violet-600 shadow-sm dark:bg-slate-900">
          <Sparkles size={21} className="animate-pulse" />
        </span>
        <h2 className="text-lg font-bold">This dashboard has no nodes yet</h2>
        <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          You can load a predefined template from the **Preset** dropdown at the top, or click **Add
          Node** to start designing your visual map from scratch.
        </p>
        <div className="pt-2">
          <button
            onClick={onAdd}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-violet-500/10 cursor-pointer hover:bg-violet-500"
          >
            <Plus size={16} /> Add First Node
          </button>
        </div>
      </div>
    </div>
  );
}

// --- NODE PICKER DIALOG ---
function NodePicker({ onClose, onAdd }) {
  const options = [
    {
      type: 'note',
      label: 'Rich Note',
      desc: 'Markdown logs and instructions',
      icon: <FileText size={20} />,
      color: 'text-violet-500 bg-violet-500/10',
    },
    {
      type: 'metric',
      label: 'Metric Value',
      desc: 'Custom integers, floats and currency',
      icon: <BarChart3 size={20} />,
      color: 'text-cyan-500 bg-cyan-500/10',
    },
    {
      type: 'progress',
      label: 'Progress Target',
      desc: 'Track progress to completion',
      icon: <Layers size={20} />,
      color: 'text-amber-500 bg-amber-500/10',
    },
    {
      type: 'chart',
      label: 'Sparkline Chart',
      desc: 'Custom coordinates plotted dynamically',
      icon: <Activity size={20} />,
      color: 'text-indigo-500 bg-indigo-500/10',
    },
    {
      type: 'status',
      label: 'Status Indicator',
      desc: 'Monitoring relays and server health',
      icon: <CheckCircle size={20} />,
      color: 'text-emerald-500 bg-emerald-500/10',
    },
    {
      type: 'logic',
      label: 'Math Logic',
      desc: 'Dynamic calculations between nodes',
      icon: <Cpu size={20} />,
      color: 'text-pink-500 bg-pink-500/10',
    },
    {
      type: 'image',
      label: 'Image Showcase',
      desc: 'Display an online image card',
      icon: <Image size={20} />,
      color: 'text-violet-500 bg-violet-500/10',
    },
    {
      type: 'embed',
      label: 'Third-Party Embed',
      desc: 'Render custom iframe content',
      icon: <Layers size={20} />,
      color: 'text-indigo-500 bg-indigo-500/10',
    },
    {
      type: 'table',
      label: 'Data Grid Table',
      desc: 'Editable rows and columns table',
      icon: <Table size={20} />,
      color: 'text-teal-500 bg-teal-500/10',
    },
    {
      type: 'timer',
      label: 'Stopwatch / Timer',
      desc: 'Live countdown or timer clock',
      icon: <Timer size={20} />,
      color: 'text-amber-500 bg-amber-500/10',
    },
    {
      type: 'link',
      label: 'Reference Link',
      desc: 'URL card with title and metadata',
      icon: <LinkIcon size={20} />,
      color: 'text-blue-500 bg-blue-500/10',
    },
    {
      type: 'divider',
      label: 'Section Divider',
      desc: 'Visual line to partition canvas',
      icon: <Minus size={20} />,
      color: 'text-slate-500 bg-slate-500/10',
    },
    {
      type: 'code',
      label: 'Code Block',
      desc: 'Syntax highlighted code container',
      icon: <Code2 size={20} />,
      color: 'text-orange-500 bg-orange-500/10',
    },
  ];

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
            <h2 className="text-lg font-bold">Add a node</h2>
            <p className="mt-1 text-xs text-slate-400">
              Choose a functional dashboard node for your layout.
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
          {options.map((opt) => (
            <button
              key={opt.type}
              onClick={() => onAdd(opt.type)}
              className="flex items-start gap-3 rounded-2xl border border-slate-200 p-4 text-left hover:border-violet-300 hover:bg-violet-500/5 cursor-pointer dark:border-white/10 dark:hover:border-violet-500/20"
            >
              <span className={`grid size-10 place-items-center rounded-xl shrink-0 ${opt.color}`}>
                {opt.icon}
              </span>
              <div>
                <b className="text-sm font-bold text-slate-900 dark:text-white">{opt.label}</b>
                <span className="mt-1 block text-xs leading-relaxed text-slate-400">
                  {opt.desc}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EditorSkeleton() {
  return <div className="-m-5 min-h-screen animate-pulse bg-slate-100 dark:bg-slate-950 sm:-m-8" />;
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
