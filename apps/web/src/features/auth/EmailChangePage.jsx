import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2, Loader2, MailCheck, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { authService } from './auth-service';

export default function EmailChangePage() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [pending, setPending] = useState(false);
  const [changedEmail, setChangedEmail] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) window.history.replaceState(window.history.state, '', window.location.pathname);
  }, [token]);

  const confirmChange = async (event) => {
    event.preventDefault();
    if (!token || pending) return;
    setPending(true);
    setError('');
    try {
      const result = await authService.verifyEmailChange(token);
      setChangedEmail(result.email);
    } catch (requestError) {
      setError(requestError.message || 'This email change link is invalid or expired.');
    } finally {
      setPending(false);
    }
  };

  const complete = Boolean(changedEmail);
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-slate-900 dark:bg-[#060812] dark:text-white">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl shadow-violet-950/5 dark:border-white/10 dark:bg-slate-950 sm:p-10">
        <div className="grid size-12 place-items-center rounded-2xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
          {complete ? <CheckCircle2 size={23} /> : <MailCheck size={23} />}
        </div>
        <p className="mt-7 text-xs font-bold uppercase tracking-[.18em] text-violet-600 dark:text-violet-300">Account security</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{complete ? 'Email updated' : 'Confirm your new email'}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
          {complete
            ? `Your sign-in email is now ${changedEmail}. All sessions have been signed out. Sign in again with the new address.`
            : 'Confirm that you control this address. The link works once and expires after 24 hours. You will need to sign in again after the change.'}
        </p>

        {error && <p role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-200">{error}</p>}
        {!token && !complete && <p role="alert" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-950/30 dark:text-amber-100">This link is missing its confirmation token. Request a new email change from Settings.</p>}

        {complete ? (
          <Link to="/login" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-violet-500">Sign in again <ArrowRight size={16} /></Link>
        ) : (
          <form onSubmit={confirmChange} className="mt-6">
            <button type="submit" disabled={pending || !token} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-violet-500/20 transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50">
              {pending ? <Loader2 size={17} className="animate-spin" /> : <ShieldCheck size={17} />}
              {pending ? 'Confirming…' : 'Confirm email change and sign out'}
            </button>
          </form>
        )}

        <Link to="/login" className="mt-5 inline-flex text-xs font-semibold text-slate-500 underline underline-offset-2 hover:text-violet-600 dark:hover:text-violet-300">Back to sign in</Link>
      </section>
    </main>
  );
}
