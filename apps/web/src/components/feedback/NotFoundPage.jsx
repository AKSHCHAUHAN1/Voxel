import { Link } from 'react-router-dom';
import { Compass, ArrowRight } from 'lucide-react';
import appIcon from '@/assets/app-icon.png';

/**
 * NotFoundPage — Premium 404 error fallback view.
 */
export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#030509] flex flex-col items-center justify-center p-6 text-center select-none">
      {/* Glow ambient background */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-violet-500/10 blur-[80px] rounded-full pointer-events-none" />

      <div className="max-w-md mx-auto space-y-6 relative z-10">
        <Link to="/" className="inline-block hover:opacity-90 transition">
          <img src={appIcon} alt="Voxel Logo" className="h-12 w-auto mx-auto" />
        </Link>

        <div className="space-y-2">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-white text-violet-650 shadow-md dark:bg-slate-900 border border-slate-100 dark:border-white/5">
            <Compass size={28} className="animate-spin-slow text-violet-500" />
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-4">404</h1>
          <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Page not found</h2>
          <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            The page you are looking for doesn&apos;t exist or has been moved to another visual workspace directory.
          </p>
        </div>

        <div className="pt-4">
          <Link
            to="/workspaces"
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/10 cursor-pointer hover:bg-violet-500 transition"
          >
            Go to Workspaces <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
