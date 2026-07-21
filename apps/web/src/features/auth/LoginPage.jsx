import { useState } from 'react';
import { ArrowRight, ShieldCheck, Sparkles, Moon, Sun, PanelsTopLeft } from 'lucide-react';
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
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    const { clientX, clientY } = e;
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    setMousePos({
      x: (clientX - centerX) / centerX,
      y: (clientY - centerY) / centerY,
    });
  };

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
    <main 
      onMouseMove={handleMouseMove}
      className="relative grid min-h-screen place-items-center bg-slate-100/90 text-slate-900 dark:bg-[#04060d] dark:text-slate-100 p-6 transition-colors overflow-hidden perspective-1000"
    >
      {/* 3D Background Grid Mesh */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-30 dark:opacity-15"
        style={{
          backgroundImage: theme === 'dark' 
            ? 'radial-gradient(circle, rgba(255, 255, 255, 0.12) 1px, transparent 1px)' 
            : 'radial-gradient(circle, rgba(99, 102, 241, 0.3) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />

      {/* --- SLOW-MOTION INTERACTIVE 3D BLURRED BUBBLES --- */}
      {/* Bubble 1 - Top-Left Indigo/Violet Iris */}
      <motion.div
        animate={{ 
          y: [0, -40, 0], 
          x: [0, 30, 0], 
          scale: [1, 1.08, 1] 
        }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          transform: `translate3d(${mousePos.x * -60}px, ${mousePos.y * -60}px, 0px)`,
        }}
        className="absolute top-[-10%] left-[-5%] w-[520px] h-[520px] rounded-full backdrop-blur-3xl bg-gradient-to-br from-indigo-400/40 via-purple-300/30 to-violet-500/25 shadow-2xl shadow-indigo-300/30 border border-white/60 dark:from-violet-600/35 dark:via-indigo-900/30 dark:to-purple-950/20 dark:border-white/10 dark:shadow-none pointer-events-none transition-transform duration-700 ease-out"
      />

      {/* Bubble 2 - Bottom-Right Cyan/Blue Aqua */}
      <motion.div
        animate={{ 
          y: [0, 45, 0], 
          x: [0, -35, 0], 
          scale: [1, 1.1, 1] 
        }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        style={{
          transform: `translate3d(${mousePos.x * 70}px, ${mousePos.y * 70}px, 0px)`,
        }}
        className="absolute bottom-[-12%] right-[-5%] w-[560px] h-[560px] rounded-full backdrop-blur-3xl bg-gradient-to-br from-cyan-300/45 via-teal-200/35 to-blue-400/25 shadow-2xl shadow-cyan-200/30 border border-white/60 dark:from-cyan-500/30 dark:via-blue-900/30 dark:to-teal-950/20 dark:border-white/10 dark:shadow-none pointer-events-none transition-transform duration-700 ease-out"
      />

      {/* Bubble 3 - Top-Right Fuchsia/Rose Orb */}
      <motion.div
        animate={{ 
          y: [0, -30, 0], 
          x: [0, -25, 0], 
          scale: [1, 1.05, 1] 
        }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        style={{
          transform: `translate3d(${mousePos.x * -45}px, ${mousePos.y * 45}px, 0px)`,
        }}
        className="absolute top-[8%] right-[8%] w-[380px] h-[380px] rounded-full backdrop-blur-3xl bg-gradient-to-br from-fuchsia-300/35 via-pink-200/30 to-rose-400/20 shadow-2xl shadow-fuchsia-200/30 border border-white/60 dark:from-fuchsia-600/30 dark:via-purple-900/25 dark:to-slate-950/20 dark:border-white/10 dark:shadow-none pointer-events-none transition-transform duration-700 ease-out"
      />

      {/* Bubble 4 - Bottom-Left Amber/Gold Orb */}
      <motion.div
        animate={{ 
          y: [0, 35, 0], 
          x: [0, 30, 0], 
          scale: [1, 1.07, 1] 
        }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
        style={{
          transform: `translate3d(${mousePos.x * 55}px, ${mousePos.y * -55}px, 0px)`,
        }}
        className="absolute bottom-[10%] left-[6%] w-[360px] h-[360px] rounded-full backdrop-blur-3xl bg-gradient-to-br from-amber-300/35 via-orange-200/30 to-yellow-400/20 shadow-2xl shadow-amber-200/30 border border-white/60 dark:from-amber-500/25 dark:via-orange-950/20 dark:to-slate-950/20 dark:border-white/10 dark:shadow-none pointer-events-none transition-transform duration-700 ease-out"
      />

      {/* Bubble 5 - Center Emerald Ambient Glow */}
      <motion.div
        animate={{ 
          y: [0, -25, 0], 
          x: [0, -20, 0], 
          scale: [1, 1.06, 1] 
        }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
        style={{
          transform: `translate3d(${mousePos.x * -35}px, ${mousePos.y * -35}px, 0px)`,
        }}
        className="absolute top-[40%] left-[45%] w-[300px] h-[300px] rounded-full backdrop-blur-3xl bg-gradient-to-br from-emerald-300/35 via-teal-200/30 to-green-400/20 shadow-2xl shadow-emerald-200/30 border border-white/60 dark:from-emerald-500/25 dark:via-teal-900/20 dark:to-slate-950/20 dark:border-white/10 dark:shadow-none pointer-events-none transition-transform duration-700 ease-out"
      />

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
        style={{
          transform: `translate3d(${mousePos.x * 12}px, ${mousePos.y * 12}px, 0px)`,
        }}
        className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200/90 bg-white/85 shadow-[0_25px_70px_-15px_rgba(99,102,241,0.25)] backdrop-blur-2xl dark:border-white/10 dark:bg-[#0c111e]/90 dark:shadow-[0_25px_70px_-15px_rgba(0,0,0,0.8)] lg:grid-cols-[1.1fr_.9fr] relative z-10 transition-transform duration-500 ease-out"
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
          <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-white/60 dark:bg-white/5 p-3 rounded-2xl border border-slate-200/60 dark:border-white/5 backdrop-blur-md">
            <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" /> 
            <span>Google identity, device sessions, and access control are verified server-side.</span>
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
