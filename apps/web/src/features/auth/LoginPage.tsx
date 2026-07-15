import { ArrowRight, Boxes, ShieldCheck, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authService } from './auth-service';

export function LoginPage() {
  const navigate = useNavigate();

  const handleGuestLogin = async () => {
    try {
      await authService.guestLogin();
      navigate('/workspaces');
    } catch (error) {
      console.error('Failed to log in as guest:', error);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-[#080a12] p-6 text-slate-100">
      <section className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-[#101522] shadow-2xl shadow-black/30 lg:grid-cols-[1.1fr_.9fr]">
        <div className="hidden min-h-[580px] flex-col justify-between bg-[radial-gradient(circle_at_20%_20%,rgba(139,92,246,.38),transparent_32%),radial-gradient(circle_at_80%_70%,rgba(56,189,248,.2),transparent_28%)] p-12 lg:flex">
          <div className="flex items-center gap-3 font-semibold">
            <span className="grid size-9 place-items-center rounded-xl bg-white text-violet-700">
              <Boxes size={18} />
            </span>{' '}
            Voxel
          </div>
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[.2em] text-violet-200">
              Visual workspace
            </p>
            <h1 className="max-w-md text-5xl font-semibold tracking-tight">
              Make the work visible.
            </h1>
            <p className="mt-5 max-w-sm text-base leading-7 text-slate-300">
              A secure canvas for teams to organize the information, systems, and decisions that
              move work forward.
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <ShieldCheck size={17} className="text-emerald-300" /> Google identity, device sessions,
            and access control are verified server-side.
          </div>
        </div>
        <div className="flex min-h-[580px] flex-col justify-center p-8 sm:p-12">
          <div className="mb-10 lg:hidden">
            <span className="grid size-9 place-items-center rounded-xl bg-violet-500 text-white">
              <Boxes size={18} />
            </span>
          </div>
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-violet-300">
            <Sparkles size={15} /> Welcome to Voxel
          </p>
          <h2 className="text-3xl font-semibold tracking-tight">Sign in to your workspace</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Continue with your organization’s Google account. Voxel never stores your Google
            password.
          </p>
          <a
            href={authService.loginUrl()}
            className="mt-8 inline-flex items-center justify-center gap-3 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
          >
            <span className="grid size-5 place-items-center rounded-full bg-gradient-to-br from-red-500 via-amber-400 to-blue-500 text-[10px] font-bold text-white">
              G
            </span>{' '}
            Continue with Google <ArrowRight size={16} />
          </a>
          <button
            onClick={handleGuestLogin}
            className="mt-3 inline-flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-slate-800 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-300"
          >
            Log in as Guest <ArrowRight size={16} />
          </button>
          <p className="mt-6 text-xs leading-5 text-slate-500">
            By continuing, you agree to your organization’s Voxel workspace policies.
          </p>
        </div>
      </section>
    </main>
  );
}
