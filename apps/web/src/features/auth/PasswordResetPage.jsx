import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { authService } from './auth-service';

export default function PasswordResetPage() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}`);
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!token) {
      setError('This reset link is missing its token. Request a new link and try again.');
      return;
    }
    if (password.length < 12) {
      setError('Use at least 12 characters for your new password.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await authService.resetPassword(token, password);
      setComplete(true);
      setPassword('');
      setConfirmPassword('');
    } catch (requestError) {
      setError(requestError.message || 'This reset link is invalid or expired. Request a new link and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-slate-900 dark:bg-[#060812] dark:text-white">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl shadow-violet-950/5 dark:border-white/10 dark:bg-slate-950 sm:p-10">
        <div className="grid size-12 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">{complete ? <CheckCircle2 size={23} /> : <ShieldCheck size={23} />}</div>
        <p className="mt-7 text-xs font-bold uppercase tracking-[.18em] text-violet-600 dark:text-violet-300">Account recovery</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{complete ? 'Password updated' : 'Choose a new password'}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">{complete ? 'Your other sessions have been signed out. Sign in again with your new password.' : 'Use at least 12 characters. This reset link can only be used once.'}</p>

        {error && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
        {!complete && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label htmlFor="new-password" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">New password</label>
            <input id="new-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 12 characters" className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-white/10 dark:bg-white/5" />
            <label htmlFor="confirm-password" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Confirm new password</label>
            <input id="confirm-password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter it again" className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-white/10 dark:bg-white/5" />
            <button type="submit" disabled={loading || !token} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? <Loader2 size={17} className="animate-spin" /> : <KeyRound size={17} />}
              {loading ? 'Updating password…' : 'Update password'}
            </button>
          </form>
        )}

        {!token && !complete && <Link to="/forgot-password" className="mt-4 inline-flex text-xs font-semibold text-violet-600 underline underline-offset-2 dark:text-violet-300">Request a new reset link</Link>}
        {complete && <Link to="/login" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white"><ArrowLeft size={15} /> Return to sign in</Link>}
      </section>
    </main>
  );
}
