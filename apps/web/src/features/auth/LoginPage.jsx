import { ArrowRight, ShieldCheck, Sparkles, Moon, Sun, Activity, Cpu, Zap, Layers, PanelsTopLeft, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authService } from './auth-service';
import { useThemeStore } from '@/store/theme-store';
import appIcon from '@/assets/app-icon.png';
import appIconDark from '@/assets/app-icon-dark.png';
import horizontalLogo from '@/assets/horizontal-logo.png';
import horizontalLogoDark from '@/assets/horizontal-logo-dark.png';

export function LoginPage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useThemeStore();

  const handleGuestLogin = async () => {
    try {
      await authService.guestLogin();
      navigate('/workspaces');
    } catch (error) {
      console.error('Failed to log in as guest:', error);
    }
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <main className="relative grid min-h-screen place-items-center bg-slate-100/90 text-slate-900 dark:bg-[#04060d] dark:text-slate-100 p-6 transition-colors overflow-hidden perspective-1000">
      {/* 3D Background Perspective Grid Mesh */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-20"
        style={{
          backgroundImage: theme === 'dark' 
            ? 'radial-gradient(circle, rgba(255, 255, 255, 0.1) 1px, transparent 1px)' 
            : 'radial-gradient(circle, rgba(99, 102, 241, 0.25) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Vibrant Ambient Gradient Mesh Halos */}
      <div className="absolute top-[-10%] left-[-5%] -z-10 h-[650px] w-[650px] rounded-full bg-gradient-to-br from-violet-500/25 to-indigo-600/20 blur-[140px] dark:from-violet-600/30 dark:to-indigo-900/20 animate-pulse-glow" />
      <div className="absolute bottom-[-10%] right-[-5%] -z-10 h-[650px] w-[650px] rounded-full bg-gradient-to-tr from-cyan-400/25 to-blue-600/20 blur-[140px] dark:from-cyan-600/25 dark:to-slate-900/30 animate-pulse-glow" />
      <div className="absolute top-[35%] right-[15%] -z-10 h-[450px] w-[450px] rounded-full bg-fuchsia-500/15 blur-[150px] dark:bg-fuchsia-600/10" />

      {/* 3D Floating Node Widgets in Background */}
      <motion.div
        animate={{ y: [0, -18, 0], rotate: [0, 4, 0] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute top-[12%] left-[8%] hidden xl:flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-white/5 text-xs font-semibold text-slate-700 dark:text-slate-200 pointer-events-none"
      >
        <div className="p-2 rounded-xl bg-violet-500/15 text-violet-600 dark:text-violet-300">
          <Activity size={18} />
        </div>
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Live Metrics</div>
          <div className="font-extrabold">99.98% System Uptime</div>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 20, 0], rotate: [0, -5, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        className="absolute bottom-[15%] left-[10%] hidden xl:flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-white/5 text-xs font-semibold text-slate-700 dark:text-slate-200 pointer-events-none"
      >
        <div className="p-2 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-300">
          <Cpu size={18} />
        </div>
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Logic Engine</div>
          <div className="font-extrabold">Autonomous Pipeline</div>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, -16, 0], rotate: [0, -3, 0] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        className="absolute top-[18%] right-[8%] hidden xl:flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-white/5 text-xs font-semibold text-slate-700 dark:text-slate-200 pointer-events-none"
      >
        <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-300">
          <Zap size={18} />
        </div>
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Realtime Sync</div>
          <div className="font-extrabold">Yjs CRDT Enabled</div>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 15, 0], rotate: [0, 3, 0] }}
        transition={{ duration: 7.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        className="absolute bottom-[18%] right-[10%] hidden xl:flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/70 p-4 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-white/5 text-xs font-semibold text-slate-700 dark:text-slate-200 pointer-events-none"
      >
        <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300">
          <Lock size={18} />
        </div>
        <div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">Enterprise Auth</div>
          <div className="font-extrabold">Zero-Trust Verified</div>
        </div>
      </motion.div>

      {/* Top Bar Theme Toggle */}
      <div className="absolute top-6 right-8 z-50">
        <button
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          className="flex items-center justify-center size-11 rounded-2xl border border-slate-200/90 bg-white/90 text-slate-700 shadow-md backdrop-blur-xl hover:bg-slate-100 dark:border-white/15 dark:bg-slate-900/80 dark:text-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer hover:scale-105 active:scale-95"
        >
          {theme === 'dark' ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-violet-600" />}
        </button>
      </div>

      {/* Main 3D Container Section */}
      <motion.section 
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200/90 bg-white/85 shadow-[0_25px_70px_-15px_rgba(99,102,241,0.25)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#0c111e]/90 dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.8)] lg:grid-cols-[1.1fr_.9fr] relative z-10"
      >
        <div className="hidden min-h-[580px] flex-col justify-between bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-cyan-500/10 dark:from-violet-950/30 dark:via-indigo-950/20 dark:to-slate-950/40 p-12 lg:flex border-r border-slate-100 dark:border-white/5 relative">
          <div className="flex items-center">
            <img src={horizontalLogo} alt="Voxel" className="h-14 object-contain block dark:hidden" />
            <img src={horizontalLogoDark} alt="Voxel" className="h-14 object-contain hidden dark:block" />
          </div>
          <div className="space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[.18em] text-violet-600 dark:bg-violet-500/15 dark:text-violet-300 border border-violet-200/60 dark:border-violet-500/20">
              <PanelsTopLeft size={13} /> Visual workspace
            </span>
            <h1 className="max-w-md text-5xl font-extrabold tracking-tight text-slate-950 dark:text-white leading-[1.15]">
              Make the work visible.
            </h1>
            <p className="max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-300 font-medium">
              A secure canvas for teams to organize the information, systems, and decisions that
              move work forward.
            </p>
          </div>
          {/* Mini Interactive 3D Canvas Showcase */}
          <div className="relative rounded-2xl border border-slate-200/80 bg-white/60 p-4 shadow-md backdrop-blur-md dark:border-white/10 dark:bg-white/5 space-y-3">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100 dark:border-white/5 pb-2">
              <span className="flex items-center gap-1.5 text-violet-600 dark:text-violet-400">
                <Activity size={13} className="animate-pulse" /> Live Canvas Stream
              </span>
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-[10px]">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" /> Synchronized
              </span>
            </div>

            <div className="relative h-20 w-full overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-900/60 p-2 border border-slate-100 dark:border-white/5 flex items-center justify-between px-4">
              {/* SVG Connecting Curved Beam */}
              <svg className="absolute inset-0 h-full w-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M 110 40 C 160 10, 180 70, 230 40"
                  fill="none"
                  stroke="url(#beam-gradient)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="beam-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.8" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Node Card A */}
              <motion.div 
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="z-10 flex items-center gap-2 rounded-xl bg-white p-2.5 shadow-sm border border-slate-200/80 dark:border-white/10 dark:bg-slate-800"
              >
                <div className="p-1.5 rounded-lg bg-cyan-500/15 text-cyan-600 dark:text-cyan-300">
                  <Cpu size={14} />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-800 dark:text-slate-200">Data Stream</div>
                  <div className="text-[9px] text-slate-400 font-medium">1,240 msg/s</div>
                </div>
              </motion.div>

              {/* Node Card B */}
              <motion.div 
                animate={{ y: [0, 3, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                className="z-10 flex items-center gap-2 rounded-xl bg-white p-2.5 shadow-sm border border-slate-200/80 dark:border-white/10 dark:bg-slate-800"
              >
                <div className="p-1.5 rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-300">
                  <Zap size={14} />
                </div>
                <div>
                  <div className="text-[10px] font-bold text-slate-800 dark:text-slate-200">Live Dashboard</div>
                  <div className="text-[9px] text-slate-400 font-medium">Synced</div>
                </div>
              </motion.div>
            </div>

            {/* Enterprise Security Badges */}
            <div className="flex items-center justify-between gap-2 pt-1">
              <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                <ShieldCheck size={14} className="text-emerald-500" /> Verified Auth
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                <Zap size={14} className="text-amber-500" /> CRDT Sync
              </span>
              <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                <Lock size={14} className="text-violet-500" /> SOC2 Type II
              </span>
            </div>
          </div>
        </div>
        <div className="flex min-h-[580px] flex-col justify-center p-8 sm:p-12 bg-white/60 dark:bg-transparent">
          <div className="mb-10 lg:hidden">
            <img src={appIcon} alt="Voxel" className="w-10 h-10 object-contain block dark:hidden" />
            <img src={appIconDark} alt="Voxel" className="w-10 h-10 object-contain hidden dark:block" />
          </div>
          <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            <Sparkles size={15} /> Welcome to Voxel
          </p>
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">Sign in to your workspace</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400 font-medium">
            Continue with your organization’s Google account. Voxel never stores your Google
            password.
          </p>
          <a
            href={authService.loginUrl()}
            className="mt-8 inline-flex items-center justify-center gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
          >
            <span className="grid size-5 place-items-center rounded-full bg-gradient-to-br from-red-500 via-amber-400 to-blue-500 text-[10px] font-bold text-white">
              G
            </span>{' '}
            Continue with Google <ArrowRight size={16} />
          </a>
          <button
            onClick={handleGuestLogin}
            className="mt-3 inline-flex items-center justify-center gap-3 rounded-xl bg-violet-600 px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-violet-600/25 hover:bg-violet-500 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
          >
            Log in as Guest <ArrowRight size={16} />
          </button>
          <p className="mt-6 text-xs leading-5 text-slate-500 dark:text-slate-400 font-medium">
            By continuing, you agree to your organization’s Voxel workspace policies.
          </p>
        </div>
      </motion.section>
    </main>
  );
}
