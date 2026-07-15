import { useState } from 'react';
import {
  User,
  Users,
  Check,
  Plus,
  Trash2,
  Lock,
  Computer,
  X,
} from 'lucide-react';
import { useThemeStore } from '@/store/theme-store';

interface Member {
  id: string;
  name: string;
  email: string;
  role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'COMMENTER' | 'VIEWER';
}

const INITIAL_MEMBERS: Member[] = [
  { id: '1', name: 'Guest User', email: 'guest@voxel.com', role: 'OWNER' },
  { id: '2', name: 'Alice Vance', email: 'alice@voxel.com', role: 'EDITOR' },
  { id: '3', name: 'Bob Smith', email: 'bob@voxel.com', role: 'VIEWER' },
];

export default function SettingsPage() {
  // Profile state
  const [displayName, setDisplayName] = useState('Guest User');
  const [email, setEmail] = useState('guest@voxel.com');
  const [avatarColor, setAvatarColor] = useState('bg-violet-600');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Workspace members state
  const [members, setMembers] = useState<Member[]>(INITIAL_MEMBERS);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'EDITOR' | 'VIEWER'>('EDITOR');
  const [inviteOpen, setInviteOpen] = useState(false);

  // Theme settings
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const [selectedGrid, setSelectedGrid] = useState('Dots');

  const handleProfileSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaveStatus('Saving…');
    setTimeout(() => {
      setSaveStatus('Profile updated successfully!');
      setTimeout(() => setSaveStatus(null), 3000);
    }, 800);
  };

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName || !inviteEmail) return;
    const newMember: Member = {
      id: Math.random().toString(),
      name: inviteName,
      email: inviteEmail,
      role: inviteRole,
    };
    setMembers([...members, newMember]);
    setInviteName('');
    setInviteEmail('');
    setInviteOpen(false);
  };

  const removeMember = (id: string) => {
    setMembers(members.filter((m) => m.id !== id));
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-12">
      {/* Premium Header Design */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/60 dark:border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Platform Settings</h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed">
            Manage your visual identities, visual themes, collaborators, and security access logs in a unified workspace settings dashboard.
          </p>
        </div>
      </div>

      {/* Unified Settings Grid Layout */}
      <div className="grid grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Profile & Team Collaboration */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          
          {/* Card 1: Profile Settings */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900/60 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.02] dark:opacity-[0.03] pointer-events-none">
              <User size={150} />
            </div>
            
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-6 bg-violet-600 rounded-full" />
              <h2 className="text-base font-bold tracking-tight">Profile & Persona</h2>
            </div>
            <p className="text-xs text-slate-500 mb-6">Manage your Voxel display details and visual avatar color theme.</p>

            <form onSubmit={handleProfileSave} className="space-y-6">
              <div className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 w-fit">
                <div className={`grid size-14 place-items-center rounded-2xl ${avatarColor} text-xl font-bold text-white shadow-inner transition-colors duration-300 shrink-0`}>
                  {displayName.slice(0, 2).toUpperCase() || 'GU'}
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Avatar Theme</p>
                  <div className="flex gap-2">
                    {['bg-violet-600', 'bg-emerald-600', 'bg-blue-600', 'bg-rose-600', 'bg-amber-600'].map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setAvatarColor(color)}
                        className={`size-5 rounded-full border border-white/20 transition hover:scale-110 ${color} ${
                          avatarColor === color ? 'ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-slate-900' : ''
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block text-xs font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider">
                  Display Name
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none ring-violet-400 focus:ring-2 dark:border-white/10"
                  />
                </label>
                <label className="block text-xs font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider">
                  Email Address
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none ring-violet-400 focus:ring-2 dark:border-white/10"
                  />
                </label>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-slate-100 dark:border-white/5">
                <button
                  type="submit"
                  className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 hover:bg-violet-500 transition-all"
                >
                  Save Profile Changes
                </button>
                {saveStatus && (
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-450 animate-scale-in">
                    {saveStatus}
                  </p>
                )}
              </div>
            </form>
          </div>

          {/* Card 2: Workspace Collaboration */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900/60 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-[0.02] dark:opacity-[0.03] pointer-events-none">
              <Users size={150} />
            </div>

            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-1 h-6 bg-violet-600 rounded-full" />
                <h2 className="text-base font-bold tracking-tight">Team Collaboration</h2>
              </div>
              <button
                onClick={() => setInviteOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-violet-500 transition-all"
              >
                <Plus size={14} /> Add Member
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-6">Manage team access controls and invite new peers to your organization workspaces.</p>

            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10 mt-4">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-550 dark:bg-slate-900/60 dark:text-slate-400 border-b border-slate-100 dark:border-white/5">
                  <tr>
                    <th className="px-4 py-3">Member</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {members.map((member) => (
                    <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-slate-800 dark:text-slate-200 text-xs">{member.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{member.email}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${
                          member.role === 'OWNER'
                            ? 'bg-violet-100 text-violet-750 dark:bg-violet-500/10 dark:text-violet-200'
                            : member.role === 'EDITOR'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200'
                            : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-400'
                        }`}>
                          {member.role}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {member.role !== 'OWNER' && (
                          <button
                            type="button"
                            onClick={() => removeMember(member.id)}
                            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition-colors"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* Right Column: Visual Atelier & Security details */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          
          {/* Card 3: Visual Atelier (Theme Mode & Grid styles) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900/60 shadow-sm">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-6 bg-violet-600 rounded-full" />
              <h2 className="text-base font-bold tracking-tight">Visual Atelier</h2>
            </div>
            <p className="text-xs text-slate-500 mb-6">Toggle dark themes and background grids.</p>

            <div className="space-y-4">
              <div className="p-3.5 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                <p className="text-xs font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider mb-3">Theme Selection</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setTheme('light')}
                    className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold border transition-all ${
                      theme === 'light'
                        ? 'border-violet-600 bg-violet-50 text-violet-750 dark:bg-violet-500/10 dark:text-violet-200'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-white/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <Check size={12} className={theme === 'light' ? 'opacity-100' : 'opacity-0'} /> Light
                  </button>
                  <button
                    onClick={() => setTheme('dark')}
                    className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold border transition-all ${
                      theme === 'dark'
                        ? 'border-violet-600 bg-violet-500/10 text-violet-200'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-white/5 dark:hover:bg-white/5'
                    }`}
                  >
                    <Check size={12} className={theme === 'dark' ? 'opacity-100' : 'opacity-0'} /> Dark
                  </button>
                </div>
              </div>

              <div className="p-3.5 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                <p className="text-xs font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider mb-3">Background Grid</p>
                <div className="grid grid-cols-2 gap-2">
                  {['Dots', 'Grid Lines', 'Radial Glow', 'Blank'].map((style) => (
                    <button
                      key={style}
                      type="button"
                      onClick={() => setSelectedGrid(style)}
                      className={`py-2 text-xs font-semibold rounded-xl border text-center transition-all ${
                        selectedGrid === style
                          ? 'border-violet-600 bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-200'
                          : 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-white/5 dark:hover:bg-white/5'
                      }`}
                    >
                      {style}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Card 4: Security Access & Audit Details */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900/60 shadow-sm relative overflow-hidden">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-1 h-6 bg-violet-600 rounded-full" />
              <h2 className="text-base font-bold tracking-tight">Security & Access</h2>
            </div>
            <p className="text-xs text-slate-500 mb-6">Review connected browser sessions and organization logs.</p>

            <div className="space-y-4">
              <div className="p-3.5 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5 space-y-3">
                <p className="text-xs font-bold text-slate-450 dark:text-slate-400 uppercase tracking-wider">Active Session</p>
                <div className="flex justify-between items-center">
                  <div className="flex gap-2.5 items-center">
                    <Computer className="text-slate-400" size={16} />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold">Chrome (macOS)</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">Mumbai, India • Active</div>
                    </div>
                  </div>
                  <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-450 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0">
                    Live
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-rose-200/50 dark:border-rose-500/15 bg-rose-500/5 space-y-3">
                <div className="flex gap-2 items-center text-rose-600 dark:text-rose-450">
                  <Lock size={15} />
                  <h3 className="text-xs font-bold uppercase tracking-wider">Danger Zone</h3>
                </div>
                <p className="text-[11px] text-rose-600/80 dark:text-rose-400/80 leading-5">
                  Closing your account permanently soft-deletes all visual canvas workspace credentials. This action is irreversible.
                </p>
                <button
                  type="button"
                  className="w-full py-2 rounded-xl bg-rose-600 text-white font-semibold text-xs hover:bg-rose-500 shadow-sm transition-all"
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Invite Member modal */}
      {inviteOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={() => setInviteOpen(false)}>
          <form
            onSubmit={handleInvite}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold">Invite Member</h3>
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Name
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 dark:border-white/10"
                  placeholder="Alice Vance"
                />
              </label>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Email Address
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 dark:border-white/10"
                  placeholder="alice@voxel.com"
                />
              </label>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                Workspace Role
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 dark:border-white/10 dark:bg-slate-900"
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="EDITOR">EDITOR</option>
                  <option value="VIEWER">VIEWER</option>
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => setInviteOpen(false)}
                className="rounded-lg px-3 py-2 font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-lg bg-violet-600 px-3.5 py-2 font-semibold text-white hover:bg-violet-500"
              >
                Invite
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
