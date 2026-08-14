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
import { useNotificationStore } from '@/store/notification-store';
import appIcon from '@/assets/app-icon.png';
import appIconDark from '@/assets/app-icon-dark.png';
import horizontalLogo from '@/assets/horizontal-logo.png';
import horizontalLogoDark from '@/assets/horizontal-logo-dark.png';
import { toggleThemeWithRipple } from '@/utils/theme-ripple';
import { getDeviceOSString } from '@/utils/device-info';

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
  const [googleModalOpen, setGoogleModalOpen] = useState(false);

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
      useNotificationStore.getState().add('Signed in as Guest User', 'info');
      useNotificationStore.getState().add(`New authentication session created from ${getDeviceOSString()}`, 'warning');
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
        useNotificationStore.getState().add(`Account created for ${email}. Welcome to Voxel!`, 'success');
      } else {
        await authService.login({ email, password });
        useNotificationStore.getState().add(`Signed in successfully as ${email}`, 'success');
        useNotificationStore.getState().add(`New authentication session active on ${getDeviceOSString()}`, 'info');
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
            <button
              type="button"
              onClick={() => setGoogleModalOpen(true)}
              className="w-full inline-flex items-center justify-center gap-3 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:text-slate-100 dark:hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 cursor-pointer"
            >
              <svg className="size-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.29v3.15C3.26 21.3 7.31 24 12 24z"/>
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.29C.47 8.21 0 10.05 0 12s.47 3.79 1.29 5.42l3.99-3.15z"/>
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.58l3.99 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
              </svg>
              <span>Continue with Google</span>
            </button>

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

      {/* Google OAuth Account Chooser & Permissions Consent Dialog */}
      <AnimatePresence>
        {googleModalOpen && (
          <GoogleOAuthConsentModal
            defaultEmail={email}
            onClose={() => setGoogleModalOpen(false)}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

// --- GOOGLE OAUTH ACCOUNT CHOOSER & CONSENT MODAL ---
function GoogleOAuthConsentModal({ defaultEmail, onClose }) {
  // Steps: 'accounts' | 'consent' | 'connecting'
  const [step, setStep] = useState('accounts');
  const [useOther, setUseOther] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customName, setCustomName] = useState('');
  const [otherError, setOtherError] = useState('');

  const accounts = [
    {
      name: 'Aksh Chauhan',
      email: defaultEmail && defaultEmail.includes('@') ? defaultEmail : 'aksh111828@gmail.com',
      avatarBg: 'bg-violet-600',
      initial: 'A',
    },
    {
      name: 'Voxel Workspace',
      email: 'aksh.voxel@gmail.com',
      avatarBg: 'bg-indigo-600',
      initial: 'V',
    },
  ];

  const [selectedAccount, setSelectedAccount] = useState(accounts[0]);

  const handleSelectAccount = (acc) => {
    setSelectedAccount(acc);
    setStep('consent');
  };

  const handleProceedCustom = (e) => {
    e.preventDefault();
    if (!customEmail.trim() || !customEmail.includes('@')) {
      setOtherError('Please enter a valid Google email address.');
      return;
    }
    const derivedName = customName.trim() || customEmail.split('@')[0];
    const acc = {
      name: derivedName.charAt(0).toUpperCase() + derivedName.slice(1),
      email: customEmail.trim(),
      avatarBg: 'bg-emerald-600',
      initial: derivedName.charAt(0).toUpperCase(),
    };
    setSelectedAccount(acc);
    setStep('consent');
  };

  const handleAllowPermissions = () => {
    setStep('connecting');
    setTimeout(() => {
      window.location.href = authService.loginUrl(selectedAccount.email, selectedAccount.name);
    }, 600);
  };

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      onMouseDown={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-[430px] rounded-[28px] border border-slate-200/80 bg-white p-7 sm:p-8 shadow-2xl dark:border-white/10 dark:bg-[#1f1f1f] text-slate-800 dark:text-[#e3e3e3] font-sans"
      >
        {/* Google Logo Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5">
          <div className="flex items-center gap-2.5">
            <svg className="size-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"/>
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.29v3.15C3.26 21.3 7.31 24 12 24z"/>
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.29C.47 8.21 0 10.05 0 12s.47 3.79 1.29 5.42l3.99-3.15z"/>
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.58l3.99 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
            </svg>
            <span className="text-sm font-semibold tracking-tight text-slate-700 dark:text-[#c4c7c5]">Sign in with Google</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* STEP 1: Account Selection */}
        {step === 'accounts' && (
          <div className="pt-5 space-y-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Choose an account</h2>
              <p className="text-xs text-slate-500 dark:text-[#9aa0a6] mt-0.5">to continue to <strong className="font-semibold text-slate-700 dark:text-slate-200">Voxel</strong></p>
            </div>

            <div className="space-y-1.5 pt-2">
              {accounts.map((acc, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSelectAccount(acc)}
                  className="w-full flex items-center justify-between p-3 rounded-2xl border border-transparent hover:border-slate-200 dark:hover:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`size-9 rounded-full ${acc.avatarBg} text-white flex items-center justify-center font-bold text-sm shadow-sm`}>
                      {acc.initial}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                        {acc.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {acc.email}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200">→</span>
                </button>
              ))}

              {/* Use another account toggle */}
              {!useOther ? (
                <button
                  type="button"
                  onClick={() => setUseOther(true)}
                  className="w-full flex items-center gap-3 p-3 rounded-2xl border border-transparent hover:bg-slate-50 dark:hover:bg-white/5 transition text-left cursor-pointer text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                >
                  <div className="size-9 rounded-full border border-dashed border-slate-300 dark:border-white/20 flex items-center justify-center text-slate-400">
                    <UserPlus size={15} />
                  </div>
                  <span className="text-xs font-semibold">Use another account</span>
                </button>
              ) : (
                <form onSubmit={handleProceedCustom} className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3 mt-2">
                  <div className="text-xs font-bold text-slate-900 dark:text-white">Enter Google Account Details</div>
                  <input
                    type="email"
                    required
                    placeholder="Enter your Gmail address"
                    value={customEmail}
                    onChange={(e) => {
                      setCustomEmail(e.target.value);
                      setOtherError('');
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-[#141414] dark:text-white"
                  />
                  <input
                    type="text"
                    placeholder="Full name (optional)"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 outline-none focus:border-blue-500 dark:border-white/10 dark:bg-[#141414] dark:text-white"
                  />
                  {otherError && <p className="text-[11px] text-rose-500 font-semibold">{otherError}</p>}
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setUseOther(false)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-200/60 dark:hover:bg-white/10 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-500 cursor-pointer shadow-sm"
                    >
                      Next
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-white/5 text-[11px] text-slate-500 dark:text-[#9aa0a6] leading-relaxed">
              To continue, Google will share your name, email address, language preference, and profile picture with Voxel.
            </div>
          </div>
        )}

        {/* STEP 2: Permissions Consent Screen */}
        {step === 'consent' && (
          <div className="pt-5 space-y-4">
            {/* Account Switcher Header */}
            <div className="flex items-center justify-between p-2.5 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-2.5 truncate">
                <div className={`size-7 rounded-full ${selectedAccount.avatarBg} text-white flex items-center justify-center font-bold text-xs shrink-0`}>
                  {selectedAccount.initial}
                </div>
                <div className="truncate text-left">
                  <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{selectedAccount.name}</div>
                  <div className="text-[10px] text-slate-500 truncate">{selectedAccount.email}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStep('accounts')}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0 ml-2 cursor-pointer"
              >
                Switch
              </button>
            </div>

            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                Voxel wants to access your Google Account
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                This will allow <strong className="font-bold text-slate-800 dark:text-slate-200">Voxel</strong> to:
              </p>
            </div>

            {/* Scope Permissions List */}
            <div className="space-y-3 py-1">
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/70 dark:border-blue-900/30">
                <span className="text-blue-600 dark:text-blue-400 text-sm mt-0.5">✉️</span>
                <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                  <strong>See your primary Google Account email address</strong>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">openid · email</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/70 dark:border-blue-900/30">
                <span className="text-blue-600 dark:text-blue-400 text-sm mt-0.5">👤</span>
                <div className="text-xs leading-relaxed text-slate-700 dark:text-slate-200">
                  <strong>See your personal info, including name and avatar</strong>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">profile</div>
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-500 dark:text-[#9aa0a6] leading-relaxed">
              Make sure you trust Voxel. You may be sharing sensitive info with this site or app. Review Voxel's Privacy Policy and Terms of Service.
            </div>

            {/* Actions */}
            <div className="flex justify-end items-center gap-2 pt-2 border-t border-slate-100 dark:border-white/5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAllowPermissions}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#1a73e8] hover:bg-[#1557b0] shadow-md shadow-blue-500/20 cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                Allow & Continue
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Connecting State */}
        {step === 'connecting' && (
          <div className="py-10 text-center space-y-4">
            <div className="mx-auto size-10 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Connecting to Google & Granting Permissions...
            </div>
            <div className="text-xs text-slate-500">
              Signing in as {selectedAccount.email}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
