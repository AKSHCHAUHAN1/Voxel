import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useThemeStore } from '@/store/theme-store';
import appIcon from '@/assets/app-icon.png';
import appIconDark from '@/assets/app-icon-dark.png';
import horizontalLogo from '@/assets/horizontal-logo.png';
import horizontalLogoDark from '@/assets/horizontal-logo-dark.png';
import { motion, useMotionValue, useTransform, useSpring } from 'framer-motion';
import {
  ArrowRight,
  Sparkles,
  Plus,
  Moon,
  Sun,
  Activity,
  GitBranch,
  Zap,
  MousePointerClick,
  RefreshCw,
  Cpu,
  Layers,
  Database,
  ArrowUpRight,
} from 'lucide-react';
import { authService } from '../auth/auth-service';

// --- Card 3D Tilt Wrapper Component ---
function InteractiveTiltCard({ children, className = '' }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const mouseXSpring = useSpring(x);
  const mouseYSpring = useSpring(y);

  const rx = useTransform(mouseYSpring, [-0.5, 0.5], ['7.5deg', '-7.5deg']);
  const ry = useTransform(mouseXSpring, [-0.5, 0.5], ['-7.5deg', '7.5deg']);

  function handleMouseMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = (event.clientX - rect.left) / width - 0.5;
    const mouseY = (event.clientY - rect.top) / height - 0.5;
    x.set(mouseX);
    y.set(mouseY);
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{
        rotateX: rx,
        rotateY: ry,
        transformStyle: 'preserve-3d',
      }}
      className={`apple-liquid-card relative rounded-2xl p-6 transition-all duration-200 ${className}`}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const containerRef = useRef(null);
  const { theme, setTheme } = useThemeStore();

  // Check auth state
  const { data: user, isSuccess } = useQuery({
    queryKey: ['me'],
    queryFn: authService.me,
    retry: false,
  });

  // --- Interactive Sandbox State ---
  const [nodes, setNodes] = useState([
    {
      id: 'traffic',
      title: 'Daily Visitors',
      type: 'metric',
      x: 60,
      y: 40,
      value: 1200,
      icon: <Activity className="text-cyan-500 dark:text-cyan-400" size={18} />,
    },
    {
      id: 'conversion',
      title: 'Conversion Rate',
      type: 'logic',
      x: 60,
      y: 220,
      value: 2.5,
      icon: <Cpu className="text-violet-600 dark:text-violet-400" size={18} />,
    },
    {
      id: 'revenue',
      title: 'Projected Sales',
      type: 'display',
      x: 360,
      y: 130,
      value: 30, // calculated traffic * conversion / 100
      icon: <Zap className="text-amber-500 dark:text-amber-400" size={18} />,
    },
  ]);

  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [sandboxPulse, setSandboxPulse] = useState(false);

  const trafficVal = nodes.find((n) => n.id === 'traffic')?.value || 0;
  const conversionVal = nodes.find((n) => n.id === 'conversion')?.value || 0;

  // Update calculated node value when dependencies change
  useEffect(() => {
    const sales = Math.round((trafficVal * conversionVal) / 100);

    setNodes((prev) =>
      prev.map((node) => (node.id === 'revenue' ? { ...node, value: sales } : node)),
    );
    // Trigger animated link pulse
    setSandboxPulse(true);
    const timer = setTimeout(() => setSandboxPulse(false), 800);
    return () => clearTimeout(timer);
  }, [trafficVal, conversionVal]);

  // Drag Handlers for Sandbox
  const handleMouseDown = (e, id) => {
    e.preventDefault();
    const node = nodes.find((n) => n.id === id);
    if (!node) return;

    // Use currentTarget bounding box to get click offset relative to node card
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setDraggingNodeId(id);
  };

  const handleMouseMove = (e) => {
    if (!draggingNodeId || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    const nextX = Math.max(
      10,
      Math.min(containerRect.width - 240, e.clientX - containerRect.left - dragOffset.x),
    );
    const nextY = Math.max(
      10,
      Math.min(containerRect.height - 120, e.clientY - containerRect.top - dragOffset.y),
    );

    setNodes((prev) =>
      prev.map((n) => (n.id === draggingNodeId ? { ...n, x: nextX, y: nextY } : n)),
    );
  };

  const handleMouseUp = () => {
    setDraggingNodeId(null);
  };

  const incrementNode = (id, amount) => {
    setNodes((prev) =>
      prev.map((n) => {
        if (n.id === id) {
          if (n.id === 'conversion') {
            return { ...n, value: Math.max(0.1, parseFloat((n.value + amount).toFixed(1))) };
          }
          return { ...n, value: Math.max(10, n.value + amount) };
        }
        return n;
      }),
    );
  };

  return (
    <div
      className="min-h-screen overflow-x-hidden bg-slate-50 text-slate-900 dark:bg-[#04060d] dark:text-slate-100 transition-colors duration-200 ease-out selection:bg-violet-500/30 selection:text-violet-600 dark:selection:text-violet-200"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {/* Dynamic Background Glows */}
      <div className="absolute top-0 left-1/4 -z-10 h-[500px] w-[500px] rounded-full bg-violet-500/10 blur-[120px] dark:bg-violet-600/10" />
      <div className="absolute top-[20%] right-10 -z-10 h-[600px] w-[600px] rounded-full bg-cyan-500/10 blur-[150px] dark:bg-cyan-600/10" />
      <div className="absolute bottom-[10%] left-10 -z-10 h-[650px] w-[650px] rounded-full bg-fuchsia-500/5 blur-[180px] dark:bg-fuchsia-600/5" />

      {/* --- HEADER --- */}
      <header className="sticky top-0 z-50 apple-liquid-glass">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center">
            <img src={horizontalLogo} alt="Voxel" className="h-14 object-contain block dark:hidden" />
            <img src={horizontalLogoDark} alt="Voxel" className="h-14 object-contain hidden dark:block" />
          </div>

          <nav className="hidden items-center gap-8 text-sm font-semibold text-slate-600 dark:text-slate-400 md:flex">
            <a href="#features" className="transition hover:text-slate-950 dark:hover:text-slate-100">
              Features
            </a>
            <a href="#sandbox" className="transition hover:text-slate-950 dark:hover:text-slate-100">
              Interactive Demo
            </a>
            <a href="#integration" className="transition hover:text-slate-950 dark:hover:text-slate-100">
              Integrations
            </a>
          </nav>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle Theme"
              className="flex items-center justify-center size-9 rounded-xl border border-slate-200/80 bg-white text-slate-600 shadow-xs hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 transition cursor-pointer"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>

            {isSuccess && user ? (
              <Link
                to="/workspaces"
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-500 hover:shadow-violet-600/30"
              >
                Go to Workspace <ArrowRight size={15} />
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm font-semibold text-slate-600 transition hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                >
                  Sign In
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4.5 py-2.5 text-sm font-bold text-white shadow-lg shadow-violet-600/20 transition hover:bg-violet-500"
                >
                  Get Started <ArrowUpRight size={15} />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* --- HERO SECTION --- */}
      <section className="relative mx-auto max-w-7xl px-6 pt-16 pb-24 md:pt-24 lg:pt-32">
        <div className="grid gap-16 lg:grid-cols-12 lg:items-center">
          {/* Hero Content */}
          <div className="space-y-8 lg:col-span-5">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3.5 py-1 text-xs font-extrabold tracking-wide text-violet-600 dark:text-violet-300 backdrop-blur-md"
            >
              <Sparkles size={12} className="animate-pulse" /> Visual Grid Engine v2.0
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl font-extrabold leading-[1.1] tracking-tight md:text-6xl text-slate-950 dark:text-white"
            >
              Make your work <br className="hidden sm:inline" />
              <span className="bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 dark:from-violet-400 dark:via-indigo-200 dark:to-cyan-300 bg-clip-text text-transparent">
                visually alive.
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg leading-relaxed text-slate-600 dark:text-slate-300 font-medium"
            >
              Voxel combines reactive math nodes, streaming databases, and interactive metric
              components into a single visual canvas. Track logic, map workflows, and present data
              instantly.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap gap-4"
            >
              <Link
                to="/login"
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-xl shadow-violet-500/20 transition hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/30"
              >
                Launch Visual Canvas
                <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
          </div>

          {/* Hero Visual: Interactive Sandbox */}
          <div id="sandbox" className="lg:col-span-7">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="apple-liquid-glass relative rounded-3xl p-1 shadow-2xl backdrop-blur-2xl"
            >
              {/* Header Bar */}
              <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/10 px-6 py-3.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-2 font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-ping" />
                  Live Preview Sandbox (Interactive)
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                  <MousePointerClick size={12} /> Drag nodes & adjust values
                </div>
              </div>

              {/* Sandbox Grid Area */}
              <div
                ref={containerRef}
                className="relative h-[320px] w-full overflow-hidden rounded-b-[22px] bg-slate-50/80 dark:bg-[#05070e] bg-[radial-gradient(ellipse_at_center,transparent_20%,rgba(248,250,252,0.8)_80%),linear-gradient(rgba(99,102,241,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.08)_1px,transparent_1px)] dark:bg-[radial-gradient(ellipse_at_center,transparent_20%,#05070e_80%),linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:24px_24px] p-6"
              >
                {/* Dynamically Drawn Connecting Svg Lines */}
                <svg className="pointer-events-none absolute inset-0 h-full w-full">
                  <defs>
                    <linearGradient id="lineGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#06b6d4" />
                      <stop offset="50%" stopColor="#6366f1" />
                      <stop offset="100%" stopColor="#f59e0b" />
                    </linearGradient>
                  </defs>

                  {/* Connect Traffic to Revenue */}
                  {(() => {
                    const traffic = nodes.find((n) => n.id === 'traffic');
                    const revenue = nodes.find((n) => n.id === 'revenue');
                    const x1 = traffic.x + 220;
                    const y1 = traffic.y + 35;
                    const x2 = revenue.x;
                    const y2 = revenue.y + 35;
                    return (
                      <g>
                        <path
                          d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`}
                          fill="none"
                          stroke={sandboxPulse ? 'url(#lineGrad)' : 'rgba(99, 102, 241, 0.4)'}
                          strokeWidth={sandboxPulse ? 3 : 2}
                          className="transition-all duration-200"
                        />
                        <path
                          d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`}
                          fill="none"
                          stroke="url(#lineGrad)"
                          strokeWidth="2"
                          strokeDasharray="8 6"
                          className="animate-[dash_1.5s_linear_infinite]"
                          style={{ display: sandboxPulse ? 'block' : 'none' }}
                        />
                      </g>
                    );
                  })()}

                  {/* Connect Conversion to Revenue */}
                  {(() => {
                    const conversion = nodes.find((n) => n.id === 'conversion');
                    const revenue = nodes.find((n) => n.id === 'revenue');
                    const x1 = conversion.x + 220;
                    const y1 = conversion.y + 35;
                    const x2 = revenue.x;
                    const y2 = revenue.y + 35;
                    return (
                      <g>
                        <path
                          d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`}
                          fill="none"
                          stroke={sandboxPulse ? 'url(#lineGrad)' : 'rgba(99, 102, 241, 0.4)'}
                          strokeWidth={sandboxPulse ? 3 : 2}
                          className="transition-all duration-200"
                        />
                        <path
                          d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`}
                          fill="none"
                          stroke="url(#lineGrad)"
                          strokeWidth="2"
                          strokeDasharray="8 6"
                          className="animate-[dash_1.5s_linear_infinite]"
                          style={{ display: sandboxPulse ? 'block' : 'none' }}
                        />
                      </g>
                    );
                  })()}
                </svg>

                {/* Nodes rendering */}
                {nodes.map((node) => (
                  <div
                    key={node.id}
                    style={{ left: node.x, top: node.y }}
                    className="apple-liquid-card absolute z-10 w-[220px] select-none rounded-xl p-4 cursor-grab active:cursor-grabbing"
                    onMouseDown={(e) => handleMouseDown(e, node.id)}
                  >
                    <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-white/5 pb-2">
                      <span className="flex items-center gap-2 text-xs font-extrabold text-slate-800 dark:text-slate-200">
                        {node.icon} {node.title}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {node.type}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xl font-bold font-mono tracking-tight text-slate-950 dark:text-white">
                        {node.type === 'logic' ? `${node.value}%` : node.value.toLocaleString()}
                      </span>

                      {node.type !== 'display' && (
                        <div className="flex gap-1.5" onMouseDown={(e) => e.stopPropagation()}>
                          <button
                            onClick={() =>
                              incrementNode(node.id, node.id === 'conversion' ? -0.1 : -100)
                            }
                            className="flex size-6 items-center justify-center rounded-md border border-slate-200 bg-white/80 dark:border-white/10 dark:bg-white/5 text-slate-600 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-white/10 font-bold"
                          >
                            -
                          </button>
                          <button
                            onClick={() =>
                              incrementNode(node.id, node.id === 'conversion' ? 0.1 : 100)
                            }
                            className="flex size-6 items-center justify-center rounded-md border border-slate-200 bg-white/80 dark:border-white/10 dark:bg-white/5 text-slate-600 dark:text-slate-300 transition hover:bg-slate-100 dark:hover:bg-white/10 font-bold"
                          >
                            <Plus size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* --- FEATURES GRID --- */}
      <motion.section
        id="features"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-7xl px-6 py-24 md:py-32"
      >
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <h2 className="text-xs font-extrabold uppercase tracking-[.25em] text-violet-600 dark:text-violet-400">
            Engineered for speed
          </h2>
          <p className="text-3xl font-extrabold tracking-tight sm:text-4xl text-slate-950 dark:text-white">
            A visual data workflow engine like no other.
          </p>
          <p className="text-slate-600 dark:text-slate-400 text-base font-medium">
            Replace static reports with interactive node-based systems that run instantly in the
            browser.
          </p>
        </div>

        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          <InteractiveTiltCard className="group">
            <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:scale-110 transition-transform duration-300">
              <GitBranch size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-950 dark:text-white">Logic Node Trees</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
              Wire input data into calculated math models. Formula dependencies update automatically
              whenever inputs change.
            </p>
          </InteractiveTiltCard>

          <InteractiveTiltCard className="group">
            <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 group-hover:scale-110 transition-transform duration-300">
              <Activity size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-950 dark:text-white">Real-Time Streams</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
              Stream live server data directly into metric blocks. Render responsive gauges,
              trendlines, and threshold warning states.
            </p>
          </InteractiveTiltCard>

          <InteractiveTiltCard className="group">
            <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:scale-110 transition-transform duration-300">
              <RefreshCw size={20} />
            </div>
            <h3 className="text-lg font-bold text-slate-950 dark:text-white">Interactive Rive Component</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400 font-medium">
              Rive-powered interactive visual state controllers that respond to system updates
              dynamically.
            </p>
          </InteractiveTiltCard>
        </div>
      </motion.section>

      {/* --- DESIGN PARALLAX/INTERCONNECTION SECTION --- */}
      <motion.section
        id="integration"
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="bg-slate-100/50 dark:bg-slate-950/40 py-24 md:py-32 transition-colors duration-200"
      >
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-16 lg:grid-cols-12 lg:items-center">
            {/* Visuals */}
            <div className="order-2 lg:order-1 lg:col-span-7 grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="apple-liquid-card rounded-2xl p-6 shadow-lg">
                  <div className="flex items-center gap-2 text-xs font-bold text-cyan-600 dark:text-cyan-400">
                    <Database size={14} /> postgresql-prod
                  </div>
                  <div className="mt-3 text-2xl font-bold font-mono text-slate-950 dark:text-white">12,042</div>
                  <div className="mt-1 text-[10px] font-semibold text-slate-500">Live DB Connections</div>
                </div>
                <div className="apple-liquid-card rounded-2xl p-6 shadow-lg">
                  <div className="flex items-center gap-2 text-xs font-bold text-violet-600 dark:text-violet-400">
                    <Layers size={14} /> metric-aggregator
                  </div>
                  <div className="mt-3 text-2xl font-bold font-mono text-slate-950 dark:text-white">99.98%</div>
                  <div className="mt-1 text-[10px] font-semibold text-slate-500">Success Rate</div>
                </div>
              </div>

              <div className="space-y-4 pt-8">
                <div className="apple-liquid-card rounded-2xl p-6 shadow-lg">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                    <Zap size={14} /> event-triggers
                  </div>
                  <div className="mt-3 text-2xl font-bold font-mono text-slate-950 dark:text-white">0.4ms</div>
                  <div className="mt-1 text-[10px] font-semibold text-slate-500">Pipeline Latency</div>
                </div>
                <div className="apple-liquid-card rounded-2xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 dark:from-violet-600/20 dark:to-indigo-600/20 p-6 shadow-lg border-violet-500/30">
                  <h4 className="text-sm font-extrabold text-slate-950 dark:text-white">Connect anything</h4>
                  <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 font-medium">
                    Input files, Webhook relays, Postgres, or Redis caches are modeled as simple
                    nodes.
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="order-1 lg:order-2 lg:col-span-5 space-y-6">
              <h2 className="text-xs font-extrabold uppercase tracking-[.25em] text-cyan-600 dark:text-cyan-400">
                Unified Pipelines
              </h2>
              <h3 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-slate-950 dark:text-white">
                Consolidate your stack into one visual logic map
              </h3>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                Why jump between Grafana, spreadsheets, and script runners? Voxel lets you map
                database connections directly into logic units that transform and display metrics
                visually in real-time.
              </p>

              <div className="pt-4 flex flex-col gap-3.5">
                {[
                  'Automated type-checking across connected nodes',
                  'Support for custom Javascript math calculations',
                  'Sub-millisecond visual updates using Zustand reactive bindings',
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold text-xs">
                      ✓
                    </span>
                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* --- HERO FOOTER CTA --- */}
      <motion.section
        initial={{ opacity: 0, y: 50 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto max-w-7xl px-6 py-24 md:py-32"
      >
        <div className="apple-liquid-glass relative overflow-hidden rounded-3xl px-8 py-16 text-center shadow-2xl border border-slate-200/80 dark:border-white/10">
          <div className="absolute top-0 left-1/2 -z-10 h-64 w-64 -translate-x-1/2 rounded-full bg-violet-500/10 blur-[80px]" />

          <div className="max-w-2xl mx-auto space-y-6">
            <img
              src={appIcon}
              alt="Voxel"
              className="mx-auto w-12 h-12 object-contain block dark:hidden animate-[pulse_2s_infinite]"
            />
            <img
              src={appIconDark}
              alt="Voxel"
              className="mx-auto w-12 h-12 object-contain hidden dark:block animate-[pulse_2s_infinite]"
            />
            <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl text-slate-950 dark:text-white">
              Ready to construct your workspace?
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-base max-w-lg mx-auto font-medium">
              Create your account, design dashboards using visual nodes, and connect your team's
              live systems in minutes.
            </p>
            <div className="pt-4">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3.5 text-sm font-bold text-white shadow-xl hover:bg-violet-500 transition cursor-pointer"
              >
                Start Building Free <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        </div>
      </motion.section>

      {/* --- FOOTER --- */}
      <motion.footer
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="py-12 text-slate-600 dark:text-slate-400 text-sm font-medium transition-colors duration-200"
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-950 dark:text-white">
            <img src={appIcon} alt="Voxel Logo" className="w-5 h-5 object-contain block dark:hidden" />
            <img src={appIconDark} alt="Voxel Logo" className="w-5 h-5 object-contain hidden dark:block" /> Voxel Workspace Platform
          </div>
          <p>© {new Date().getFullYear()} Voxel Inc. All rights reserved.</p>
        </div>
      </motion.footer>
    </div>
  );
}
