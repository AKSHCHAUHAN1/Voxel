import { useState } from 'react';
import { ArrowLeft, ArrowRight, Loader2, MailCheck, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authService } from './auth-service';
import { useNotificationStore } from '@/store/notification-store';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const verify = async () => {
    if (!token || pending) return;
    setPending(true);
    setError('');
    try {
      const result = await authService.verifyEmail(token);
      useNotificationStore.getState().clearAll();
      useNotificationStore.getState().add(`Email verified. Welcome to Voxel, ${result.user.displayName}.`, 'success');
      navigate('/workspaces', { replace: true });
    } catch (requestError) {
      setError(requestError.message || 'This verification link is invalid or has expired.');
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-slate-900 dark:bg-[#060812] dark:text-white">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl shadow-violet-950/5 dark:border-white/10 dark:bg-slate-950 sm:p-10">
        <div className="grid size-12 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><MailCheck size={23} /></div>
        <p className="mt-7 text-xs font-bold uppercase tracking-[.18em] text-violet-600 dark:text-violet-300">Secure your account</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Verify your email</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">Confirm that this address belongs to you. Once it is verified, Voxel will create your workspace and sign you in.</p>
        {error && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
        {!token && <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-200">This verification link is missing its token. Request a fresh email from the sign-in page.</p>}
        <button type="button" onClick={verify} disabled={!token || pending} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
          {pending ? 'Verifying address…' : 'Verify email and open Voxel'}
          {!pending && <ArrowRight size={16} />}
        </button>
        <Link to="/login" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-violet-600 dark:hover:text-violet-300"><ArrowLeft size={14} /> Back to sign in</Link>
      </section>
    </main>
  );
}
