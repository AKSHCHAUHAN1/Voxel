import { useState } from 'react';
import {
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Moon,
  Sun,
  PanelsTopLeft,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  AlertCircle,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { authService } from './auth-service';
import { useThemeStore } from '@/store/theme-store';
import appIcon from '@/assets/app-icon.png';
import appIconDark from '@/assets/app-icon-dark.png';
import horizontalLogo from '@/assets/horizontal-logo.png';
import horizontalLogoDark from '@/assets/horizontal-logo-dark.png';
import { toggleThemeWithRipple } from '@/utils/theme-ripple';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme, setTheme } = useThemeStore();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Mode: 'signin' | 'signup'
  const [mode, setMode] = useState(searchParams.get('mode') === 'signup' ? 'signup' : 'signin');
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

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
      setLoading(true);
      setErrorMsg('');
      await authService.guestLogin();
      navigate('/workspaces');
    } catch (error) {
      console.error('Failed to log in as guest:', error);
      setErrorMsg(error.message || 'Guest login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (mode === 'signup') {
      if (!displayName.trim()) {
        setErrorMsg('Please enter your full name.');
        return;
      }
      if (password.length < 6) {
        setErrorMsg('Password must be at least 6 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Passwords do not match.');
        return;
      }
    }

    try {
      setLoading(true);
      if (mode === 'signup') {
        await authService.signup({ email, password, displayName: displayName.trim() });
      } else {
        await authService.login({ email, password });
      }
      navigate('/workspaces');
    } catch (err) {
      setErrorMsg(err.message || (mode === 'signup' ? 'Failed to create account.' : 'Invalid email or password.'));
    } finally {
      setLoading(false);
    }
  };

  const toggleTheme = (e) => {
    toggleThemeWithRipple(e, theme, setTheme);
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
          backgroundImage:
            theme === 'dark'
              ? 'radial-gradient(circle, rgba(255, 255, 255, 0.12) 1px, transparent 1px)'
              : 'radial-gradient(circle, rgba(99, 102, 241, 0.3) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }}
      />

      {/* --- SLOW-MOTION INTERACTIVE 3D BLURRED BUBBLES --- */}
      <motion.div
        animate={{ y: [0, -50, 0], x: [0, 40, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
        style={{ transform: `translate3d(${mousePos.x * -70}px, ${mousePos.y * -70}px, 0px)` }}
        className="absolute top-[-15%] left-[-10%] w-[680px] h-[680px] rounded-full blur-[170px] bg-gradient-to-br from-indigo-500/50 via-purple-400/40 to-violet-600/35 dark:from-violet-600/45 dark:via-indigo-900/40 dark:to-purple-950/30 pointer-events-none transition-transform duration-700 ease-out"
      />
      <motion.div
        animate={{ y: [0, 55, 0], x: [0, -45, 0], scale: [1, 1.18, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        style={{ transform: `translate3d(${mousePos.x * 80}px, ${mousePos.y * 80}px, 0px)` }}
        className="absolute bottom-[-15%] right-[-10%] w-[720px] h-[720px] rounded-full blur-[180px] bg-gradient-to-br from-cyan-400/50 via-teal-300/40 to-blue-500/35 dark:from-cyan-500/40 dark:via-blue-900/40 dark:to-teal-950/30 pointer-events-none transition-transform duration-700 ease-out"
      />
      <motion.div
        animate={{ y: [0, -40, 0], x: [0, -35, 0], scale: [1, 1.12, 1] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        style={{ transform: `translate3d(${mousePos.x * -55}px, ${mousePos.y * 55}px, 0px)` }}
        className="absolute top-[5%] right-[5%] w-[520px] h-[520px] rounded-full blur-[150px] bg-gradient-to-br from-fuchsia-400/40 via-pink-300/35 to-rose-500/25 dark:from-fuchsia-600/35 dark:via-purple-900/30 dark:to-slate-950/25 pointer-events-none transition-transform duration-700 ease-out"
      />

      {/* Top Bar Theme Toggle */}
      <div className="absolute top-6 right-8 z-50">
        <button
          onClick={(e) => toggleTheme(e)}
          aria-label="Toggle Theme"
          className="flex items-center justify-center size-11 rounded-2xl border border-white/80 bg-white/70 text-slate-700 shadow-lg shadow-slate-950/5 backdrop-blur-2xl hover:bg-white/90 dark:border-white/15 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800 transition-all cursor-pointer hover:scale-105 active:scale-95"
        >
          {theme === 'dark' ? (
            <Sun size={20} className="text-amber-400" />
          ) : (
            <Moon size={20} className="text-violet-600" />
          )}
        </button>
      </div>

      {/* Main Container Section */}
      <motion.section
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        style={{ transform: `translate3d(${mousePos.x * 14}px, ${mousePos.y * 14}px, 0px)` }}
        className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/90 bg-white/60 shadow-[0_30px_90px_-20px_rgba(99,102,241,0.3),inset_0_1.5px_1.5px_rgba(255,255,255,0.95)] backdrop-blur-3xl dark:border-white/10 dark:bg-[#0c111e]/75 dark:shadow-[0_30px_90px_-20px_rgba(0,0,0,0.85),inset_0_1.5px_1.5px_rgba(255,255,255,0.15)] lg:grid-cols-[1.1fr_.9fr] relative z-10 transition-transform duration-500 ease-out"
      >
        {/* Left Visual Branding Panel */}
        <div className="hidden min-h-[620px] flex-col justify-between bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-cyan-500/10 dark:from-violet-950/30 dark:via-indigo-950/20 dark:to-slate-950/40 p-12 lg:flex border-r border-slate-100 dark:border-white/5 relative">
          <div className="flex items-center">
            <img src={horizontalLogo} alt="Voxel" className="h-14 object-contain block dark:hidden" />
            <img src={horizontalLogoDark} alt="Voxel" className="h-14 object-contain hidden dark:block" />
          </div>

          <div className="space-y-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[.18em] text-violet-600 dark:bg-violet-500/15 dark:text-violet-300 border border-violet-200/60 dark:border-violet-500/20">
              <PanelsTopLeft size={13} /> Visual Workspace Platform
            </span>
            <h1 className="max-w-md text-4xl font-extrabold tracking-tight text-slate-950 dark:text-white leading-[1.15]">
              {mode === 'signup' ? 'Build your team’s engine.' : 'Make the work visible.'}
            </h1>
            <p className="max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-300 font-medium">
              {mode === 'signup'
                ? 'Create a unified Voxel workspace for your metrics, layout cards, interactive notes, and live team collaboration.'
                : 'A secure visual canvas for teams to organize information, systems, and decisions that move work forward.'}
            </p>
          </div>

          <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 bg-white/60 dark:bg-white/5 p-3.5 rounded-2xl border border-slate-200/60 dark:border-white/5 backdrop-blur-md">
            <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>End-to-end authentication, JWT sessions, and RBAC authorization are active.</span>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="flex min-h-[620px] flex-col justify-center p-8 sm:p-12 bg-white/60 dark:bg-transparent">
          <div className="mb-6 lg:hidden">
            <img src={appIcon} alt="Voxel" className="w-10 h-10 object-contain block dark:hidden" />
            <img src={appIconDark} alt="Voxel" className="w-10 h-10 object-contain hidden dark:block" />
          </div>

          <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-violet-600 dark:text-violet-400">
            <Sparkles size={15} /> Welcome to Voxel
          </p>

          {/* Mode Switcher Tabs */}
          <div className="flex rounded-2xl bg-slate-200/80 dark:bg-white/5 p-1 mb-6 border border-slate-300/50 dark:border-white/10">
            <button
              type="button"
              onClick={() => {
                setMode('signin');
                setErrorMsg('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                mode === 'signin'
                  ? 'bg-white text-slate-950 shadow-md dark:bg-violet-600 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <LogIn size={14} /> Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('signup');
                setErrorMsg('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                mode === 'signup'
                  ? 'bg-white text-slate-950 shadow-md dark:bg-violet-600 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <UserPlus size={14} /> Create Account
            </button>
          </div>

          <h2 className="text-2xl font-extrabold tracking-tight text-slate-950 dark:text-white">
            {mode === 'signup' ? 'Create your Voxel account' : 'Sign in to your workspace'}
          </h2>

          <AnimatePresence mode="wait">
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mt-4 flex items-center gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 dark:border-rose-500/30 dark:bg-rose-950/40 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300"
              >
                <AlertCircle size={16} className="shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{errorMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Alex Rivers"
                  className="w-full rounded-xl border border-slate-200 bg-white/80 dark:bg-white/5 px-3.5 py-2.5 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-white/10 dark:text-white placeholder:text-slate-400"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@company.com"
                className="w-full rounded-xl border border-slate-200 bg-white/80 dark:bg-white/5 px-3.5 py-2.5 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-white/10 dark:text-white placeholder:text-slate-400"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-white/80 dark:bg-white/5 px-3.5 py-2.5 pr-10 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-white/10 dark:text-white placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Confirm Password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full rounded-xl border border-slate-200 bg-white/80 dark:bg-white/5 px-3.5 py-2.5 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-white/10 dark:text-white placeholder:text-slate-400"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/25 hover:bg-violet-500 transition cursor-pointer disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
            >
              {loading ? (
                <span>{mode === 'signup' ? 'Creating Account…' : 'Signing In…'}</span>
              ) : (
                <>
                  <span>{mode === 'signup' ? 'Create Free Account' : 'Sign In with Email'}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-white/10" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-wider font-extrabold text-slate-400">
              <span className="bg-white/80 dark:bg-[#0c111e] px-2.5">Or continue with</span>
            </div>
          </div>

          {/* Social / SSO Buttons */}
          <div className="space-y-2">
            <a
              href={authService.loginUrl()}
              className="w-full inline-flex items-center justify-center gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500"
            >
              <span className="grid size-5 place-items-center rounded-full bg-gradient-to-br from-red-500 via-amber-400 to-blue-500 text-[10px] font-bold text-white">
                G
              </span>{' '}
              Continue with Google
            </a>

            <button
              onClick={handleGuestLogin}
              type="button"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/60 bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:border-white/5 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 transition cursor-pointer"
            >
              Log in as Guest User
            </button>
          </div>
        </div>
      </motion.section>
    </main>
  );
}
