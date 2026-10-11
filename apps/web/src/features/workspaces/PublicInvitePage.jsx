import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, CheckCircle2, LockKeyhole, Users } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { authService } from '@/features/auth/auth-service';
import { workspaceService } from './workspace-service';

export default function PublicInvitePage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const invite = useQuery({
    queryKey: ['invite', token],
    queryFn: () => workspaceService.invite(token),
    retry: false,
  });
  const auth = useQuery({ queryKey: ['auth', 'me'], queryFn: authService.me, retry: false });
  const accept = useMutation({
    mutationFn: () => workspaceService.acceptInvite(token),
    onSuccess: async ({ workspaceId }) => {
      await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      navigate(`/workspaces/${workspaceId}/dashboards`, { replace: true });
    },
  });
  const logout = useMutation({
    mutationFn: authService.logout,
    onSuccess: async () => {
      await queryClient.removeQueries({ queryKey: ['auth', 'me'] });
      navigate(`/login?email=${encodeURIComponent(invite.data.email)}&returnTo=${encodeURIComponent(`/invite/${token}`)}`);
    },
  });

  const signInHref = `/login?email=${encodeURIComponent(invite.data?.email || '')}&returnTo=${encodeURIComponent(`/invite/${token}`)}`;
  const loading = invite.isPending || auth.isPending;
  const inviteError = invite.error?.message;
  const signedInEmailMatches = auth.data?.email?.toLowerCase() === invite.data?.email?.toLowerCase();

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-5 py-10 text-slate-900 dark:bg-[#070a13] dark:text-slate-100">
      <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-xl dark:border-white/10 dark:bg-slate-900 sm:p-10">
        <div className="mb-7 grid size-14 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-300"><Users size={24} /></div>
        <div className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-300">Workspace invitation</div>
        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Checking invitation…</p>
        ) : invite.isError ? (
          <>
            <h1 className="mt-2 text-2xl font-black">This invitation is unavailable</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">{inviteError || 'The link may have expired or been revoked.'}</p>
            <button type="button" onClick={() => navigate('/')} className="mt-7 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white">Go to Voxel <ArrowRight size={16} /></button>
          </>
        ) : (
          <>
            <h1 className="mt-2 text-2xl font-black">Join {invite.data.workspace.name}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">You’ve been invited as a <strong className="text-slate-800 dark:text-slate-200">{invite.data.role.toLowerCase()}</strong> using <strong className="text-slate-800 dark:text-slate-200">{invite.data.email}</strong>.</p>
            {auth.isError ? (
              <div className="mt-7 space-y-3">
                <p className="flex items-center gap-2 text-xs text-slate-500"><LockKeyhole size={14} /> Sign in with the invited email to accept.</p>
                <button type="button" onClick={() => navigate(signInHref)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white">Sign in or create account <ArrowRight size={16} /></button>
              </div>
            ) : signedInEmailMatches ? (
              <button type="button" disabled={accept.isPending} onClick={() => accept.mutate()} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60">
                <CheckCircle2 size={16} /> {accept.isPending ? 'Joining workspace…' : 'Accept invitation'}
              </button>
            ) : (
              <div className="mt-7 space-y-3">
                <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">You’re signed in as {auth.data.email}. Switch to the invited email to continue.</p>
                <button type="button" disabled={logout.isPending} onClick={() => logout.mutate()} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold dark:border-white/10">{logout.isPending ? 'Signing out…' : 'Switch account'}</button>
              </div>
            )}
            {accept.isError && <p role="alert" className="mt-3 text-xs text-rose-600">{accept.error.message}</p>}
          </>
        )}
      </section>
    </main>
  );
}
