import { ArrowRight, ShieldCheck, Sparkles, Moon, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
    <main className="relative grid min-h-screen place-items-center bg-slate-50 text-slate-900 dark:bg-[#060913] dark:text-slate-100 p-6 transition-colors overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="absolute top-10 left-1/4 -z-10 h-[500px] w-[500px] rounded-full bg-violet-500/10 blur-[130px] dark:bg-violet-600/15" />
      <div className="absolute bottom-10 right-1/4 -z-10 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[130px] dark:bg-cyan-600/15" />

      {/* Top Bar Theme Toggle */}
      <div className="absolute top-6 right-8 z-50">
        <button
          onClick={toggleTheme}
          aria-label="Toggle Theme"
          className="flex items-center justify-center size-10 rounded-xl border border-slate-200/80 bg-white/80 text-slate-600 shadow-sm backdrop-blur-md hover:bg-slate-100 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 transition cursor-pointer"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>

      <section className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0c111e]/90 lg:grid-cols-[1.1fr_.9fr]">
        <div className="hidden min-h-[580px] flex-col justify-between bg-gradient-to-br from-violet-500/5 via-indigo-500/5 to-cyan-500/5 dark:from-violet-950/20 dark:via-indigo-950/20 dark:to-slate-950/30 p-12 lg:flex border-r border-slate-100 dark:border-white/5">
          <div className="flex items-center">
            <img src={horizontalLogo} alt="Voxel" className="h-14 object-contain block dark:hidden" />
            <img src={horizontalLogoDark} alt="Voxel" className="h-14 object-contain hidden dark:block" />
          </div>
          <div>
            <p className="mb-3 text-xs font-extrabold uppercase tracking-[.2em] text-violet-600 dark:text-violet-400">
              Visual workspace
            </p>
            <h1 className="max-w-md text-5xl font-extrabold tracking-tight text-slate-950 dark:text-white leading-[1.15]">
              Make the work visible.
            </h1>
            <p className="mt-5 max-w-sm text-sm leading-6 text-slate-600 dark:text-slate-300 font-medium">
              A secure canvas for teams to organize the information, systems, and decisions that
              move work forward.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400">
            <ShieldCheck size={17} className="text-emerald-600 dark:text-emerald-400" /> Google identity, device sessions,
            and access control are verified server-side.
          </div>
        </div>
        <div className="flex min-h-[580px] flex-col justify-center p-8 sm:p-12 bg-white/50 dark:bg-transparent">
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
      </section>
    </main>
  );
}
