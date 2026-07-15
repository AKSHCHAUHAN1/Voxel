import { useMemo, useState, useEffect, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';

import {
  BarChart3,
  FileText,
  GripVertical,
  LayoutPanelTop,
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
} from 'lucide-react';
import { workspaceService } from '@/features/workspaces/workspace-service';

// --- Type definitions ---
type CanvasNode = {
  id: string;
  type: 'note' | 'metric' | 'progress' | 'chart' | 'status' | 'logic';
  title: string;
  content: string; // Used for static text, sparkline coords, status text, etc.
  size: 'small' | 'medium' | 'large' | 'wide';
  
  // Coordinates for absolute layout
  x?: number;
  y?: number;
  
  // Customizations
  color?: 'slate' | 'violet' | 'emerald' | 'rose' | 'amber' | 'indigo' | 'cyan';
  borderStyle?: 'solid' | 'dashed' | 'glow';
  fontSize?: 'regular' | 'medium' | 'large';
  headerStyle?: 'simple' | 'accent' | 'banner';
  
  // Advanced features
  unit?: string; // e.g. "$", "%"
  target?: number; // For progress goals
  statusColor?: 'success' | 'warning' | 'error'; // For status nodes
  logicA?: string; // Node ID reference or raw number
  logicB?: string; // Node ID reference or raw number
  logicOp?: '+' | '-' | '*' | '/'; // Operator
  valueSource?: 'manual' | 'connections'; // Value source mode
  aggregationOperator?: 'sum' | 'avg' | 'prod' | 'min' | 'max'; // Aggregator
};

type Connection = {
  fromId: string;
  toId: string;
  style?: 'solid' | 'glowing' | 'pulsing';
};

type GridStyle = 'dots' | 'lines' | 'radial' | 'blank';

type Scene = {
  schemaVersion: number;
  nodes: CanvasNode[];
  connections: Connection[];
  gridStyle: GridStyle;
};

const emptyScene: Scene = { 
  schemaVersion: 2, 
  nodes: [], 
  connections: [], 
  gridStyle: 'dots' 
};

const sceneOf = (value: unknown): Scene => {
  if (!value || typeof value !== 'object') return emptyScene;
  const candidate = value as Partial<Scene>;
  if (!Array.isArray(candidate.nodes)) return emptyScene;

  const parsedNodes = (candidate.nodes as CanvasNode[]).map((node, index) => {
    const x = typeof node.x === 'number' ? node.x : ((index % 3) * 310 + 40);
    const y = typeof node.y === 'number' ? node.y : (Math.floor(index / 3) * 230 + 40);
    return { ...node, x, y };
  });

  return {
    schemaVersion: candidate.schemaVersion ?? 2,
    nodes: parsedNodes,
    connections: Array.isArray(candidate.connections) ? (candidate.connections as Connection[]) : [],
    gridStyle: (candidate.gridStyle as GridStyle) ?? 'dots',
  };
};

// Node Defaults builder
const newNode = (type: CanvasNode['type']): CanvasNode => {
  const defaults: Record<CanvasNode['type'], Partial<CanvasNode>> = {
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
  } as CanvasNode;
};

// --- Theme mappings ---

const cardColors = {
  slate: 'border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100',
  violet: 'border-violet-200 bg-violet-50/20 text-slate-950 dark:border-violet-800/40 dark:bg-violet-950/10 dark:text-violet-100 ring-1 ring-violet-500/5',
  emerald: 'border-emerald-200 bg-emerald-50/20 text-slate-950 dark:border-emerald-800/40 dark:bg-emerald-950/10 dark:text-emerald-100 ring-1 ring-emerald-500/5',
  rose: 'border-rose-200 bg-rose-50/20 text-slate-950 dark:border-rose-800/40 dark:bg-rose-950/10 dark:text-rose-100 ring-1 ring-rose-500/5',
  amber: 'border-amber-200 bg-amber-50/20 text-slate-950 dark:border-amber-800/40 dark:bg-amber-950/10 dark:text-amber-100 ring-1 ring-amber-500/5',
  indigo: 'border-indigo-200 bg-indigo-50/20 text-slate-950 dark:border-indigo-800/40 dark:bg-indigo-950/10 dark:text-indigo-100 ring-1 ring-indigo-500/5',
  cyan: 'border-cyan-200 bg-cyan-50/20 text-slate-950 dark:border-cyan-800/40 dark:bg-cyan-950/10 dark:text-cyan-100 ring-1 ring-cyan-500/5',
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
  const [draft, setDraft] = useState<Scene | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<Record<string, { x: number; y: number }>>({});
  const gridRef = useRef<HTMLDivElement>(null);

  const dashboard = useQuery({
    queryKey: ['dashboard', dashboardId],
    queryFn: () => workspaceService.dashboard(dashboardId!),
    enabled: Boolean(dashboardId),
  });

  const scene = useMemo(
    () => sceneOf(draft ?? dashboard.data?.scene),
    [dashboard.data?.scene, draft],
  );

  const save = useMutation({
    mutationFn: (next: Scene) =>
      workspaceService.updateDashboard(dashboardId!, {
        scene: next,
        version: dashboard.data!.version,
      }),
    onSuccess: async () => {
      setDraft(null);
      await queryClient.invalidateQueries({ queryKey: ['dashboard', dashboardId] });
    },
  });

  // Calculate coordinates for connection lines
  const recalculateCoordinates = () => {
    if (!gridRef.current) return;
    const gridRect = gridRef.current.getBoundingClientRect();
    const coords: Record<string, { x: number; y: number }> = {};
    
    scene.nodes.forEach((node) => {
      const element = document.getElementById(`node-card-${node.id}`);
      if (element) {
        const rect = element.getBoundingClientRect();
        coords[node.id] = {
          x: rect.left + rect.width / 2 - gridRect.left,
          y: rect.top + rect.height / 2 - gridRect.top,
        };
      }
    });
    setCoordinates(coords);
  };

  useEffect(() => {
    // Timeout to let DOM layout complete
    const timer = setTimeout(recalculateCoordinates, 100);
    window.addEventListener('resize', recalculateCoordinates);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', recalculateCoordinates);
    };
  }, [scene.nodes, draft, selectedNodeId]);

  if (!workspaceId || !dashboardId) return null;
  if (dashboard.isPending) return <EditorSkeleton />;
  if (dashboard.isError || !dashboard.data)
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-700">
        This dashboard could not be loaded.
      </div>
    );

  const update = (next: Scene) => setDraft(next);

  const add = (type: CanvasNode['type']) => {
    update({ ...scene, nodes: [...scene.nodes, newNode(type)] });
    setPickerOpen(false);
  };

  const handleDragStart = (e: React.MouseEvent, nodeId: string) => {
    if (e.button !== 0) return;
    e.preventDefault();

    const node = scene.nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const initX = node.x ?? 100;
    const initY = node.y ?? 100;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const dx = moveEvent.clientX - startX;
      const dy = moveEvent.clientY - startY;

      setDraft((prevDraft) => {
        const current = prevDraft ?? scene;
        return {
          ...current,
          nodes: current.nodes.map((n) =>
            n.id === nodeId
              ? { ...n, x: Math.max(0, initX + dx), y: Math.max(0, initY + dy) }
              : n
          ),
        };
      });
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const updateNode = (id: string, updates: Partial<CanvasNode>) => {
    const nextNodes = scene.nodes.map((node) =>
      node.id === id ? { ...node, ...updates } : node
    );
    update({ ...scene, nodes: nextNodes });
  };

  const deleteNode = (id: string) => {
    const nextNodes = scene.nodes.filter((node) => node.id !== id);
    // Remove references to this node from connections
    const nextConnections = scene.connections.filter(
      (c) => c.fromId !== id && c.toId !== id
    );
    update({ ...scene, nodes: nextNodes, connections: nextConnections });
    if (selectedNodeId === id) {
      setSelectedNodeId(null);
    }
  };

  // Add / remove connection
  const addConnection = (fromId: string, toId: string) => {
    if (fromId === toId) return;
    // Check if connection already exists
    const exists = scene.connections.some(
      (c) => (c.fromId === fromId && c.toId === toId) || (c.fromId === toId && c.toId === fromId)
    );
    if (exists) return;

    update({
      ...scene,
      connections: [...scene.connections, { fromId, toId, style: 'solid' }],
    });
  };

  const deleteConnection = (index: number) => {
    const nextConns = [...scene.connections];
    nextConns.splice(index, 1);
    update({ ...scene, connections: nextConns });
  };

  // Grid style selector
  const setGridStyle = (gridStyle: GridStyle) => {
    update({ ...scene, gridStyle });
  };

  // Templates implementation
  const loadPreset = (preset: 'server' | 'business' | 'tasks') => {
    if (scene.nodes.length > 0) {
      const confirmation = window.confirm(
        'Are you sure you want to load this preset? It will overwrite your current layout.'
      );
      if (!confirmation) return;
    }

    const apiStatusId = crypto.randomUUID();
    const latencyId = crypto.randomUUID();
    const chartId = crypto.randomUUID();
    const noteId = crypto.randomUUID();

    let newNodes: CanvasNode[] = [];
    let newConns: Connection[] = [];

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
          content: '- Core API health is green.\n- Load balancer replicas are in sync.\n- RAM usage spike investigated and cleared.',
          size: 'wide',
          color: 'slate',
          borderStyle: 'dashed',
        },
      ];
      newConns = [
        { fromId: apiStatusId, toId: latencyId, style: 'pulsing' },
      ];
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
      newConns = [
        { fromId: salesId, toId: goalId, style: 'glowing' },
      ];
    } else {
      const g1Id = crypto.randomUUID();
      const g2Id = crypto.randomUUID();
      newNodes = [
        {
          id: g1Id,
          type: 'note',
          title: 'Sprint Backlog Tasks',
          content: '- Integrate customizable workspace grid.\n- Polish CSS colors and drop shadow settings.\n- Implement logic nodes calculations.',
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
  const resolveNodeValue = (node: CanvasNode, visited = new Set<string>()): string => {
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
        .filter((n): n is CanvasNode => Boolean(n));
      
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
  const resolveMath = (node: CanvasNode, visited = new Set<string>()): number => {
    if (visited.has(node.id)) return 0;
    const nextVisited = new Set(visited);
    nextVisited.add(node.id);

    const resolve = (val: string | undefined): number => {
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
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b !== 0 ? a / b : 0;
      default: return 0;
    }
  };

  // Grid style background classes - lightened and separated
  const gridBackgrounds = {
    dots: 'bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] dark:bg-[radial-gradient(rgba(255,255,255,0.06)_1.2px,transparent_1.2px)] bg-[size:24px_24px]',
    lines: 'bg-[linear-gradient(rgba(226,232,240,0.4)_1px,transparent_1px),linear-gradient(90deg,rgba(226,232,240,0.4)_1px,transparent_1px)] dark:bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:20px_20px]',
    radial: 'bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.6)_0%,#f1f5f9_100%)] dark:bg-[radial-gradient(circle_at_center,rgba(30,41,59,0.3)_0%,#0c0f1a_100%)]',
    blank: 'bg-white dark:bg-[#0c0f1a]',
  };

  return (
    <section className="-m-5 flex min-h-[calc(100vh-64px)] flex-col sm:-m-8">
      
      {/* --- CANVAS HEADER --- */}
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-4 border-b border-slate-200/80 bg-white/80 px-5 backdrop-blur-md dark:border-white/5 dark:bg-slate-950/80 sm:px-8 relative z-25">
        <div className="flex items-center gap-3">
          <Link
            to={`/workspaces/${workspaceId}/dashboards`}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-300 transition"
          >
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h1 className="text-sm font-bold text-slate-800 dark:text-slate-200 leading-snug">{dashboard.data?.name || 'Dashboard'}</h1>
            <p className="text-[9px] uppercase tracking-wider text-slate-450 dark:text-slate-400 font-bold">{dashboard.data?.description || 'Visual canvas'}</p>
          </div>
        </div>

        {/* Toolbar Settings */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* Preset templates dropdown */}
          <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 py-1.5 dark:border-white/5 bg-slate-50 dark:bg-slate-900 text-xs font-bold">
            <span className="text-slate-400 uppercase tracking-wider text-[9px]">Preset:</span>
            <select
              onChange={(e) => {
                if (e.target.value) {
                  loadPreset(e.target.value as 'server' | 'business' | 'tasks');
                  e.target.value = ''; // Reset select
                }
              }}
              defaultValue=""
              className="bg-transparent font-bold text-xs focus:outline-none cursor-pointer text-slate-700 dark:text-slate-300"
            >
              <option value="">Load Template...</option>
              <option value="server">Server Monitor</option>
              <option value="business">Sales Performance</option>
              <option value="tasks">Sprint Backlog</option>
            </select>
          </div>

          {/* Grid Toggle */}
          <div className="flex items-center gap-0.5 rounded-xl border border-slate-200 p-1 dark:border-white/5 bg-slate-50 dark:bg-slate-900">
            {(['dots', 'lines', 'radial', 'blank'] as GridStyle[]).map((style) => (
              <button
                key={style}
                onClick={() => setGridStyle(style)}
                title={`Grid style: ${style}`}
                className={`rounded-lg px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider cursor-pointer transition ${
                  scene.gridStyle === style
                    ? 'bg-white text-violet-600 shadow-sm dark:bg-slate-800 dark:text-violet-400'
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                }`}
              >
                {style}
              </button>
            ))}
          </div>

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
          className="flex-1 p-6 sm:p-10 overflow-y-auto bg-slate-50 dark:bg-[#030509] min-h-[600px] transition-colors duration-300 relative z-10"
        >
          {/* Centered Premium Canvas Board */}
          <div
            className={`mx-auto max-w-5xl w-full min-h-[650px] rounded-[24px] border border-slate-200 dark:border-white/5 bg-white dark:bg-[#0c0f1a] shadow-[0_12px_40px_rgba(0,0,0,0.04)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.3)] relative p-6 sm:p-8 transition-all duration-500 overflow-hidden ${gridBackgrounds[scene.gridStyle]}`}
          >
            {/* Main SVG connections canvas overlay */}
            <div ref={gridRef} className="absolute inset-0 pointer-events-none z-0">
            <svg className="w-full h-full absolute inset-0">
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
                  <path d="M 0 1 L 10 5 L 0 9 z" fill="#8b5cf6" />
                </marker>
                
                <linearGradient id="connGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#818cf8" />
                  <stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>
              </defs>

              {scene.connections.map((conn, idx) => {
                const from = coordinates[conn.fromId];
                const to = coordinates[conn.toId];
                if (!from || !to) return null;

                const dx = to.x - from.x;
                const pathD = `M ${from.x} ${from.y} C ${from.x + dx / 2} ${from.y}, ${from.x + dx / 2} ${to.y}, ${to.x} ${to.y}`;

                const isPulsing = conn.style === 'pulsing';
                const isGlowing = conn.style === 'glowing';

                return (
                  <g key={idx}>
                    {/* Glowing blur path */}
                    {(isGlowing || isPulsing) && (
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#a78bfa"
                        strokeWidth="5"
                        className="opacity-20 blur-sm"
                      />
                    )}
                    <path
                      d={pathD}
                      fill="none"
                      stroke="url(#connGrad)"
                      strokeWidth={isGlowing ? 3 : 2}
                      markerEnd="url(#arrow)"
                      strokeDasharray={isPulsing ? '8 6' : undefined}
                      className={isPulsing ? 'animate-[dash_1.5s_linear_infinite]' : ''}
                    />
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Grid Layout Container */}
          <div className="relative z-10 w-full">
            
            <div className="mb-5 flex items-center justify-between text-xs text-slate-400">
              <div className="flex items-center gap-2 font-medium">
                <LayoutPanelTop size={14} /> Freeform canvas board
              </div>
              <span className="font-mono text-[10px]">
                {scene.nodes.length} Nodes · {scene.connections.length} Connections
              </span>
            </div>

            {scene.nodes.length ? (
              <NodeGrid
                nodes={scene.nodes}
                selectedNodeId={selectedNodeId}
                onSelectNode={setSelectedNodeId}
                resolveNodeValue={resolveNodeValue}
                onDragStart={handleDragStart}
              />
            ) : (
              <CanvasEmpty onAdd={() => setPickerOpen(true)} />
            )}
          </div>
          </div>
        </main>

        {/* --- NODE PROPERTY INSPECTOR --- */}
        {selectedNodeId && (() => {
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
                        onChange={(e) => updateNode(selectedNode.id, { valueSource: e.target.value as any })}
                        className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10 dark:bg-slate-900"
                      >
                        <option value="manual">Manual Input</option>
                        <option value="connections">Connected Inputs (Aggregation)</option>
                      </select>
                    </div>
                  )}

                  {selectedNode.type !== 'logic' && selectedNode.valueSource === 'connections' && (
                    <div className="space-y-2 border border-violet-100 p-2.5 rounded-lg dark:border-white/5 bg-violet-50/20 dark:bg-violet-950/5">
                      <div>
                        <label className="text-[10px] font-bold text-violet-500 uppercase tracking-wider block mb-1">
                          Aggregation Formula
                        </label>
                        <select
                          value={selectedNode.aggregationOperator || 'sum'}
                          onChange={(e) => updateNode(selectedNode.id, { aggregationOperator: e.target.value as any })}
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
                        <span className="font-semibold block text-slate-500">Incoming connections:</span>
                        {(() => {
                          const incoming = scene.connections.filter((c) => c.toId === selectedNode.id);
                          if (incoming.length === 0) {
                            return <span className="italic block mt-1">No connections. Draw an arrow from another node to link them.</span>;
                          }
                          return (
                            <ul className="list-disc list-inside space-y-0.5 font-mono">
                              {incoming.map((c, i) => {
                                const src = scene.nodes.find((n) => n.id === c.fromId);
                                return (
                                  <li key={i}>
                                    {src ? `${src.title}: ` : 'Unknown Node: '}
                                    <span className="text-violet-500 font-bold">{src ? resolveNodeValue(src) : '0'}</span>
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
                          onChange={(e) => updateNode(selectedNode.id, { content: e.target.value })}
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
                            onChange={(e) => updateNode(selectedNode.id, { content: e.target.value })}
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
                            onChange={(e) => updateNode(selectedNode.id, { content: e.target.value })}
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
                          onChange={(e) => updateNode(selectedNode.id, { target: parseInt(e.target.value) || 100 })}
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
                          onChange={(e) => updateNode(selectedNode.id, { content: e.target.value })}
                          className="w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm focus:outline-none focus:border-violet-500 dark:border-white/10 font-mono"
                        />
                      ) : (
                        <div className="text-xs font-semibold font-mono text-slate-400 p-2.5 bg-slate-50 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/10">
                          {resolveNodeValue(selectedNode)}
                        </div>
                      )}
                      <span className="text-[10px] text-slate-400 mt-1 block">Comma separated coordinates list</span>
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
                            onChange={(e) => updateNode(selectedNode.id, { content: e.target.value })}
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
                          onChange={(e) => updateNode(selectedNode.id, { statusColor: e.target.value as any })}
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
                          onChange={(e) => updateNode(selectedNode.id, { logicA: e.target.value })}
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
                          onChange={(e) => updateNode(selectedNode.id, { logicOp: e.target.value as any })}
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
                          onChange={(e) => updateNode(selectedNode.id, { logicB: e.target.value })}
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

                  {/* Sizing Tiers */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider block mb-1">
                      Grid Column Span
                    </label>
                    <select
                      value={selectedNode.size}
                      onChange={(e) => updateNode(selectedNode.id, { size: e.target.value as any })}
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
                    <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Design & Styles</h4>
                    
                    {/* Theme color */}
                    <div>
                      <label className="text-[10px] block mb-1 text-slate-500">Color Palette</label>
                      <div className="flex flex-wrap gap-1">
                        {(['slate', 'violet', 'emerald', 'rose', 'amber', 'indigo', 'cyan'] as const).map((color) => (
                          <button
                            key={color}
                            onClick={() => updateNode(selectedNode.id, { color })}
                            className={`size-6 rounded-full border cursor-pointer transition-transform ${
                              selectedNode.color === color ? 'scale-110 ring-2 ring-violet-500/25' : 'hover:scale-105'
                            }`}
                            style={{
                              backgroundColor: color === 'slate' ? '#64748b' : 
                                               color === 'violet' ? '#8b5cf6' : 
                                               color === 'emerald' ? '#10b981' : 
                                               color === 'rose' ? '#f43f5e' : 
                                               color === 'amber' ? '#f59e0b' : 
                                               color === 'indigo' ? '#6366f1' : '#06b6d4'
                            }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Borders */}
                    <div>
                      <label className="text-[10px] block mb-1 text-slate-500">Border Style</label>
                      <select
                        value={selectedNode.borderStyle || 'solid'}
                        onChange={(e) => updateNode(selectedNode.id, { borderStyle: e.target.value as any })}
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
                        onChange={(e) => updateNode(selectedNode.id, { fontSize: e.target.value as any })}
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
                            const select = document.getElementById('connect-select') as HTMLSelectElement;
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
                          .filter((c) => c.fromId === selectedNode.id || c.toId === selectedNode.id)
                          .map((c) => {
                            const otherId = c.fromId === selectedNode.id ? c.toId : c.fromId;
                            const otherNode = scene.nodes.find((n) => n.id === otherId);
                            if (!otherNode) return null;
                            
                            return (
                              <div key={c.index} className="flex items-center justify-between text-[11px] bg-slate-50 dark:bg-white/5 rounded px-2 py-1">
                                <span className="truncate text-slate-500">Connected to <b>{otherNode.title}</b></span>
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
    </section>
  );
}

// --- FREEFORM GRID SETUP ---
function NodeGrid({
  nodes,
  selectedNodeId,
  onSelectNode,
  resolveNodeValue,
  onDragStart,
}: {
  nodes: readonly CanvasNode[];
  selectedNodeId: string | null;
  onSelectNode: (id: string) => void;
  resolveNodeValue: (node: CanvasNode) => string;
  onDragStart: (e: React.MouseEvent, nodeId: string) => void;
}) {
  return (
    <div className="relative w-full min-h-[650px] z-10">
      {nodes.map((node) => (
        <CanvasNodeCard
          key={node.id}
          node={node}
          isSelected={node.id === selectedNodeId}
          onSelect={() => onSelectNode(node.id)}
          resolveNodeValue={resolveNodeValue}
          onDragStart={onDragStart}
        />
      ))}
    </div>
  );
}

// --- CANVAS CARD COMPONENT ---
function CanvasNodeCard({
  node,
  isSelected,
  onSelect,
  resolveNodeValue,
  onDragStart,
}: {
  node: CanvasNode;
  isSelected: boolean;
  onSelect: () => void;
  resolveNodeValue: (node: CanvasNode) => string;
  onDragStart: (e: React.MouseEvent, nodeId: string) => void;
}) {
  const displayValue = resolveNodeValue(node);
  
  // Icon picker based on type
  const nodeIcon = useMemo(() => {
    switch (node.type) {
      case 'note': return <FileText size={18} className="text-violet-500" />;
      case 'metric': return <BarChart3 size={18} className="text-cyan-500" />;
      case 'progress': return <Layers size={18} className="text-amber-500" />;
      case 'chart': return <Activity size={18} className="text-indigo-500" />;
      case 'status': return <CheckCircle size={18} className="text-emerald-500" />;
      case 'logic': return <Cpu size={18} className="text-pink-500" />;
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

  const widthOf = (size: string) => {
    switch (size) {
      case 'small': return 220;
      case 'medium': return 280;
      case 'large': return 340;
      case 'wide': return 440;
      default: return 280;
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
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className={`rounded-2xl p-5 shadow-sm transition-all duration-200 select-none ${cardStyle} ${
        isSelected ? 'ring-2 ring-violet-500 border-violet-500 dark:ring-violet-400 dark:border-violet-400' : 'hover:scale-[1.01] hover:shadow-md'
      }`}
    >
      {/* --- DRAGGABLE CARD HEADER --- */}
      <div
        onMouseDown={(e) => onDragStart(e, node.id)}
        className="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2.5 mb-4 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{node.title}</p>
          <div className="flex items-baseline gap-1 mt-1">
            {node.unit && <span className="text-2xl font-semibold opacity-60">{node.unit}</span>}
            <span className="text-4xl font-extrabold tracking-tight font-mono">{displayValue}</span>
          </div>
          <span className="text-[10px] text-slate-400 block mt-2">Streaming data ready</span>
        </div>
      )}

      {/* 3. Progress Goal Bar */}
      {node.type === 'progress' && (() => {
        const current = parseFloat(displayValue) || 0;
        const target = node.target || 100;
        const percent = Math.min(100, Math.max(0, (current / target) * 100));
        
        return (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{node.title}</p>
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
            <span className="text-[10px] font-semibold text-violet-500 dark:text-violet-400 block">{percent.toFixed(1)}% Completed</span>
          </div>
        );
      })()}

      {/* 4. SVG Sparkline Chart */}
      {node.type === 'chart' && (() => {
        const points = parsedSparkPoints;
        const max = points.length ? Math.max(...points) : 1;
        const min = points.length ? Math.min(...points) : 0;
        const range = max - min || 1;
        
        const width = 240;
        const height = 65;
        const svgPoints = points.map((p, index) => {
          const x = (index / (points.length - 1 || 1)) * width;
          const y = height - ((p - min) / range) * height;
          return `${x},${y}`;
        }).join(' ');

        return (
          <div className="space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{node.title}</p>
            {points.length > 1 ? (
              <div className="pt-2">
                <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[65px] overflow-visible">
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
                  <polyline
                    fill="none"
                    stroke="#818cf8"
                    strokeWidth="2"
                    points={svgPoints}
                  />
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
      {node.type === 'status' && (() => {
        const isSuccess = node.statusColor === 'success';
        const isWarning = node.statusColor === 'warning';
        
        return (
          <div className="space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{node.title}</p>
            <div className="flex items-center gap-3">
              <span className={`flex size-8 items-center justify-center rounded-full ${
                isSuccess ? 'bg-emerald-500/10 text-emerald-500' :
                isWarning ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'
              }`}>
                {isSuccess ? <CheckCircle size={18} /> : 
                 isWarning ? <AlertTriangle size={18} /> : <XCircle size={18} />}
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{displayValue || 'Status'}</h3>
                <span className="text-[10px] text-slate-400">Monitoring relay active</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 6. Math Logic Calculation Node */}
      {node.type === 'logic' && (() => {
        const mathResult = parseFloat(displayValue) || 0;
        
        return (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{node.title}</p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-4xl font-extrabold tracking-tight font-mono text-violet-600 dark:text-violet-400">{mathResult.toLocaleString()}</span>
            </div>
            <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-2">
              <Cpu size={11} /> Formula node recalculating
            </span>
          </div>
        );
      })()}

    </article>
  );
}

// --- EMPTY CANVAS STATE ---
function CanvasEmpty({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="grid min-h-[400px] place-items-center rounded-3xl border border-dashed border-violet-300 bg-violet-50/60 p-8 text-center dark:border-violet-500/30 dark:bg-violet-500/5">
      <div className="max-w-md mx-auto space-y-4">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-white text-violet-600 shadow-sm dark:bg-slate-900">
          <Sparkles size={21} className="animate-pulse" />
        </span>
        <h2 className="text-lg font-bold">This dashboard has no nodes yet</h2>
        <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          You can load a predefined template from the **Preset** dropdown at the top, or click **Add Node** to start designing your visual map from scratch.
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
function NodePicker({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (type: CanvasNode['type']) => void;
}) {
  const options: { type: CanvasNode['type']; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
    { type: 'note', label: 'Rich Note', desc: 'Markdown logs and instructions', icon: <FileText size={20} />, color: 'text-violet-500 bg-violet-500/10' },
    { type: 'metric', label: 'Metric Value', desc: 'Custom integers, floats and currency', icon: <BarChart3 size={20} />, color: 'text-cyan-500 bg-cyan-500/10' },
    { type: 'progress', label: 'Progress Target', desc: 'Track progress to completion', icon: <Layers size={20} />, color: 'text-amber-500 bg-amber-500/10' },
    { type: 'chart', label: 'Sparkline Chart', desc: 'Custom coordinates plotted dynamically', icon: <Activity size={20} />, color: 'text-indigo-500 bg-indigo-500/10' },
    { type: 'status', label: 'Status Indicator', desc: 'Monitoring relays and server health', icon: <CheckCircle size={20} />, color: 'text-emerald-500 bg-emerald-500/10' },
    { type: 'logic', label: 'Math Logic', desc: 'Dynamic calculations between nodes', icon: <Cpu size={20} />, color: 'text-pink-500 bg-pink-500/10' },
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
            <p className="mt-1 text-xs text-slate-400">Choose a functional dashboard node for your layout.</p>
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
