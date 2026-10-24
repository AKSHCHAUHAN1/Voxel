import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Copy, Download, KeyRound, ShieldCheck } from 'lucide-react';
import { authService } from '@/features/auth/auth-service';

const fieldClass = 'w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-white/10';

export function TwoFactorSettingsCard({ addToast }) {
  const queryClient = useQueryClient();
  const [setup, setSetup] = useState(null);
  const [setupPassword, setSetupPassword] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [recoveryCodesAuthenticatorCode, setRecoveryCodesAuthenticatorCode] = useState('');
  const [disableAuthenticatorCode, setDisableAuthenticatorCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState(null);
  const [busyAction, setBusyAction] = useState('');
  const { data: status, isPending, error } = useQuery({
    queryKey: ['auth', 'mfa'],
    queryFn: authService.mfaStatus,
  });

  const runAction = async (action, successMessage, callback) => {
    setBusyAction(action);
    try {
      const result = await callback();
      if (result?.recoveryCodes) setRecoveryCodes(result.recoveryCodes);
      if (result?.otpauthUrl) setSetup(result);
      if (successMessage) addToast(successMessage, 'success');
      await queryClient.invalidateQueries({ queryKey: ['auth', 'mfa'] });
      return result;
    } catch (requestError) {
      addToast(requestError.message || 'The security setting could not be updated.', 'error');
      return null;
    } finally {
      setBusyAction('');
    }
  };

  const copyText = async (value, message) => {
    try {
      await navigator.clipboard.writeText(value);
      addToast(message, 'success');
    } catch {
      addToast('Clipboard access is unavailable. Select and copy the text instead.', 'warning');
    }
  };

  const downloadRecoveryCodes = () => {
    const file = new Blob([`Voxel recovery codes\nSave these codes somewhere private. Each code works once.\n\n${recoveryCodes.join('\n')}\n`], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'voxel-recovery-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleConfirmSetup = async (event) => {
    event.preventDefault();
    const result = await runAction('confirm', 'Authenticator app enabled. Other active sessions were signed out.', () => authService.confirmTotpSetup(setupCode.trim()));
    if (result) {
      setSetup(null);
      setSetupCode('');
      setSetupPassword('');
    }
  };

  const handleRotateCodes = async (event) => {
    event.preventDefault();
    const result = await runAction('rotate', 'New recovery codes created. Old codes have been invalidated.', () => authService.rotateMfaRecoveryCodes(recoveryCodesAuthenticatorCode.trim()));
    if (result) setRecoveryCodesAuthenticatorCode('');
  };

  const handleDisable = async (event) => {
    event.preventDefault();
    const result = await runAction('disable', 'Two-factor authentication disabled. Other sessions were signed out.', () => authService.disableTotp({
      ...(disableAuthenticatorCode.trim() ? { code: disableAuthenticatorCode.trim() } : {}),
      ...(disablePassword ? { currentPassword: disablePassword } : {}),
    }));
    if (result) {
      setDisableAuthenticatorCode('');
      setDisablePassword('');
      setRecoveryCodes(null);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-white/10 dark:bg-slate-900/60 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><ShieldCheck size={19} /></span>
          <div>
            <h2 className="text-lg font-extrabold tracking-tight">Two factor authentication</h2>
            <p className="mt-1 max-w-xl text-xs leading-5 text-slate-500 dark:text-slate-400">Use an authenticator app for sign-in codes and keep recovery codes somewhere private.</p>
          </div>
        </div>
        {!isPending && status && (
          <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider ${status.enabled ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400'}`}>
            {status.enabled ? 'Enabled' : 'Off'}
          </span>
        )}
      </div>

      {isPending && <p className="text-xs text-slate-500">Loading security status…</p>}
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-300">Two factor status could not be loaded.</p>}

      {recoveryCodes && (
        <div role="status" className="space-y-4 rounded-2xl border border-amber-300/70 bg-amber-50/80 p-4 dark:border-amber-500/25 dark:bg-amber-950/20">
          <div>
            <h3 className="text-sm font-bold text-amber-950 dark:text-amber-100">Save your recovery codes</h3>
            <p className="mt-1 text-xs leading-5 text-amber-900/80 dark:text-amber-200/80">Each code can be used once. These codes are shown only now; store them somewhere private before leaving this page.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {recoveryCodes.map((code) => <code key={code} className="rounded-lg border border-amber-900/10 bg-white/70 px-2 py-2 text-center font-mono text-xs text-slate-800 dark:border-white/10 dark:bg-black/15 dark:text-slate-100">{code}</code>)}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => copyText(recoveryCodes.join('\n'), 'Recovery codes copied.')} className="inline-flex items-center gap-2 rounded-xl bg-amber-900 px-3 py-2 text-xs font-bold text-white hover:bg-amber-800"><Copy size={14} /> Copy codes</button>
            <button type="button" onClick={downloadRecoveryCodes} className="inline-flex items-center gap-2 rounded-xl border border-amber-900/20 px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-500/10"><Download size={14} /> Download codes</button>
            <button type="button" onClick={() => setRecoveryCodes(null)} className="rounded-xl px-3 py-2 text-xs font-bold text-amber-900 underline underline-offset-2 dark:text-amber-100">I saved these codes</button>
          </div>
        </div>
      )}

      {!isPending && status && !status.enabled && !setup && !recoveryCodes && (
        <form onSubmit={(event) => {
          event.preventDefault();
          runAction('setup', '', () => authService.startTotpSetup(setupPassword || undefined));
        }} className="max-w-xl space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-2 text-xs font-bold"><KeyRound size={15} className="text-violet-500" /> Add an authenticator app</div>
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">Sign in again first if your session is more than 10 minutes old. Password accounts can also confirm with their current password.</p>
          <input type="password" autoComplete="current-password" value={setupPassword} onChange={(event) => setSetupPassword(event.target.value)} placeholder="Current password (optional for recent sign-in)" className={fieldClass} />
          <button type="submit" disabled={Boolean(busyAction)} className="rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-60">{busyAction === 'setup' ? 'Creating setup key…' : 'Set up authenticator'}</button>
        </form>
      )}

      {setup && !recoveryCodes && (
        <form onSubmit={handleConfirmSetup} className="max-w-xl space-y-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-500/20 dark:bg-violet-500/5">
          <div>
            <h3 className="text-sm font-bold">Connect your authenticator app</h3>
            <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-400">In your app, add an account with a setup key and enter this secret. The app should generate a fresh six digit code every 30 seconds.</p>
          </div>
          <div className="flex gap-2">
            <code className="min-w-0 flex-1 break-all rounded-xl border border-slate-200 bg-white px-3 py-3 font-mono text-sm tracking-wider dark:border-white/10 dark:bg-slate-950">{setup.secret}</code>
            <button type="button" aria-label="Copy authenticator setup key" onClick={() => copyText(setup.secret, 'Setup key copied.')} className="grid size-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white hover:bg-slate-50 dark:border-white/10 dark:bg-slate-950"><Copy size={15} /></button>
          </div>
          <label className="block text-xs font-bold" htmlFor="voxel-totp-confirm">Authenticator code</label>
          <input id="voxel-totp-confirm" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={setupCode} onChange={(event) => setSetupCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className={fieldClass} />
          <button type="submit" disabled={Boolean(busyAction) || setupCode.length !== 6} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-60">{busyAction === 'confirm' ? 'Verifying…' : <><Check size={14} /> Verify and enable</>}</button>
        </form>
      )}

      {!isPending && status?.enabled && !recoveryCodes && (
        <div className="grid gap-4 lg:grid-cols-2">
          <form onSubmit={handleRotateCodes} className="space-y-3 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 dark:border-white/10 dark:bg-white/5">
            <div><h3 className="text-xs font-bold">Recovery codes</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{status.recoveryCodesRemaining} unused codes remain. Create new codes to invalidate the previous set.</p></div>
            <input inputMode="numeric" autoComplete="one-time-code" value={recoveryCodesAuthenticatorCode} onChange={(event) => setRecoveryCodesAuthenticatorCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Current six digit app code" className={fieldClass} />
            <button type="submit" disabled={Boolean(busyAction) || recoveryCodesAuthenticatorCode.length !== 6} className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold hover:bg-white disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10">{busyAction === 'rotate' ? 'Creating codes…' : 'Replace recovery codes'}</button>
          </form>
          <form onSubmit={handleDisable} className="space-y-3 rounded-2xl border border-rose-200/80 bg-rose-50/50 p-4 dark:border-rose-500/20 dark:bg-rose-500/5">
            <div><h3 className="text-xs font-bold text-rose-800 dark:text-rose-200">Turn off two factor authentication</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Confirm with your current app code or account password. Other signed-in sessions will be revoked.</p></div>
            <input value={disableAuthenticatorCode} onChange={(event) => setDisableAuthenticatorCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="Current six digit app code" className={fieldClass} />
            <input type="password" autoComplete="current-password" value={disablePassword} onChange={(event) => setDisablePassword(event.target.value)} placeholder="Current account password" className={fieldClass} />
            <button type="submit" disabled={Boolean(busyAction) || (!disableAuthenticatorCode && !disablePassword)} className="rounded-xl border border-rose-300 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50 dark:border-rose-500/30 dark:text-rose-300 dark:hover:bg-rose-500/10">{busyAction === 'disable' ? 'Turning off…' : 'Turn off 2FA'}</button>
          </form>
        </div>
      )}
    </section>
  );
}
