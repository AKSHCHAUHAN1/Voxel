import { useState } from 'react';
import { ArrowLeft, ArrowRight, KeyRound, Loader2, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { authService } from './auth-service';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetUrl, setResetUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const result = await authService.requestPasswordReset(email.trim());
      setSent(true);
      setResetUrl(result.resetUrl || '');
    } catch (requestError) {
      setError(requestError.message || 'The request could not be completed. Try again shortly.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-slate-900 dark:bg-[#060812] dark:text-white">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl shadow-violet-950/5 dark:border-white/10 dark:bg-slate-950 sm:p-10">
        <div className="grid size-12 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><KeyRound size={23} /></div>
        <p className="mt-7 text-xs font-bold uppercase tracking-[.18em] text-violet-600 dark:text-violet-300">Account recovery</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">Reset your password</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">Enter your account email. If it matches an active password account, we’ll send a one-time reset link.</p>

        {error && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
        {sent ? (
          <div role="status" className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-950/25 dark:text-emerald-100">
            <div className="flex items-center gap-2 font-bold"><Mail size={17} /> Check your email</div>
            <p className="mt-2 text-xs">If an eligible account uses that address, a reset link is on its way. The link expires in one hour and works once.</p>
            {resetUrl && <a href={resetUrl} className="mt-3 inline-flex items-center gap-1 font-semibold underline underline-offset-2">Open the development reset link <ArrowRight size={14} /></a>}
            <button type="button" onClick={() => { setSent(false); setResetUrl(''); }} className="mt-3 block text-xs font-semibold underline underline-offset-2">Try another address</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label htmlFor="password-reset-email" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Email address</label>
            <input id="password-reset-email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="alex@company.com" className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-white/10 dark:bg-white/5" />
            <button type="submit" disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50">
              {loading ? <Loader2 size={17} className="animate-spin" /> : <Mail size={17} />}
              {loading ? 'Sending…' : 'Send reset link'}
              {!loading && <ArrowRight size={16} />}
            </button>
          </form>
        )}

        <Link to="/login" className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-slate-500 hover:text-violet-600 dark:hover:text-violet-300"><ArrowLeft size={14} /> Back to sign in</Link>
      </section>
    </main>
  );
}
