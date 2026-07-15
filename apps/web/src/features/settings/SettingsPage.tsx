import { useState } from 'react';
import {
  User,
  Shield,
  Palette,
  Users,
  Check,
  Plus,
  Trash2,
  Lock,
  Computer,
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
  const [activeTab, setActiveTab] = useState<'profile' | 'workspace' | 'appearance' | 'security'>('profile');
  
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

  const tabs = [
    { id: 'profile', label: 'My Profile', icon: User },
    { id: 'workspace', label: 'Team Workspace', icon: Users },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'security', label: 'Security & Access', icon: Shield },
  ] as const;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-violet-500">System Preferences</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Configure Voxel workspaces, member credentials, and visual presets.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row">
        {/* Navigation Sidebar */}
        <aside className="w-full shrink-0 lg:w-64">
          <nav className="flex flex-row gap-1 overflow-x-auto pb-3 lg:flex-col lg:overflow-visible lg:pb-0">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                      : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5'
                  }`}
                >
                  <Icon size={18} />
                  <span className="whitespace-nowrap">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Tab Panel Content */}
        <main className="flex-1 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-slate-900/60 dark:backdrop-blur-xl">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Profile Settings</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Update your account information and visual persona.</p>
              </div>

              <form onSubmit={handleProfileSave} className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className={`grid size-16 place-items-center rounded-2xl ${avatarColor} text-2xl font-bold text-white shadow-inner transition-colors duration-300`}>
                    {displayName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">Avatar Theme</p>
                    <div className="mt-2 flex gap-2">
                      {['bg-violet-600', 'bg-emerald-600', 'bg-blue-600', 'bg-rose-600', 'bg-amber-600'].map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setAvatarColor(color)}
                          className={`size-6 rounded-full border border-white/20 transition hover:scale-110 ${color} ${
                            avatarColor === color ? 'ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-slate-900' : ''
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-sm font-medium">
                    Display Name
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 outline-none ring-violet-400 focus:ring-2 dark:border-white/10"
                    />
                  </label>
                  <label className="block text-sm font-medium">
                    Email Address
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2.5 outline-none ring-violet-400 focus:ring-2 dark:border-white/10"
                    />
                  </label>
                </div>

                <div className="flex items-center gap-4 pt-4">
                  <button
                    type="submit"
                    className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 hover:bg-violet-500"
                  >
                    Save Changes
                  </button>
                  {saveStatus && (
                    <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      {saveStatus}
                    </p>
                  )}
                </div>
              </form>
            </div>
          )}

          {activeTab === 'workspace' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Workspace Collaboration</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Manage members, configure security permissions, and invite peers.</p>
                </div>
                <button
                  onClick={() => setInviteOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-md hover:bg-violet-500"
                >
                  <Plus size={14} /> Add Member
                </button>
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-white/10">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Member</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {members.map((member) => (
                      <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5">
                        <td className="px-4 py-3.5">
                          <div className="font-semibold">{member.name}</div>
                          <div className="text-xs text-slate-400">{member.email}</div>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            member.role === 'OWNER'
                              ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200'
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
                              className="text-slate-400 hover:text-rose-600 transition p-1 rounded-lg"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {inviteOpen && (
                <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={() => setInviteOpen(false)}>
                  <form
                    onSubmit={handleInvite}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900"
                  >
                    <h3 className="text-base font-semibold">Invite Member</h3>
                    <div className="mt-4 space-y-3">
                      <label className="block text-xs font-medium text-slate-500">
                        Name
                        <input
                          type="text"
                          required
                          value={inviteName}
                          onChange={(e) => setInviteName(e.target.value)}
                          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 dark:border-white/10"
                        />
                      </label>
                      <label className="block text-xs font-medium text-slate-500">
                        Email Address
                        <input
                          type="email"
                          required
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 dark:border-white/10"
                        />
                      </label>
                      <label className="block text-xs font-medium text-slate-500">
                        Workspace Role
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value as any)}
                          className="mt-1.5 w-full rounded-lg border border-slate-200 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-violet-500 dark:border-white/10 dark:bg-slate-900"
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
                        className="rounded-lg bg-violet-600 px-3 py-2 font-semibold text-white hover:bg-violet-500"
                      >
                        Invite
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Visual Aesthetics</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Personalize dashboard background grids and application theme styles.</p>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-100 p-4 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                  <h3 className="text-sm font-semibold">Theme Preference</h3>
                  <p className="mt-1 text-xs text-slate-400">Toggle dark mode values.</p>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold border ${
                        theme === 'light'
                          ? 'border-violet-600 bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-200'
                          : 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-white/5 dark:hover:bg-white/5'
                      }`}
                    >
                      <Check size={14} className={theme === 'light' ? 'opacity-100' : 'opacity-0'} /> Light Mode
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-semibold border ${
                        theme === 'dark'
                          ? 'border-violet-600 bg-violet-500/10 text-violet-200'
                          : 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-white/5'
                      }`}
                    >
                      <Check size={14} className={theme === 'dark' ? 'opacity-100' : 'opacity-0'} /> Dark Mode
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 p-4 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
                  <h3 className="text-sm font-semibold">Default Background Grid</h3>
                  <p className="mt-1 text-xs text-slate-400">Configure visual defaults for new dashboards.</p>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {['Dots', 'Grid Lines', 'Radial Glow', 'Blank'].map((style) => (
                      <span
                        key={style}
                        className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 dark:bg-white/5 dark:text-slate-300"
                      >
                        {style}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold">Security & Audit Logs</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Track connected sessions and rotate workspace tokens.</p>
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-slate-100 p-4 dark:border-white/5 space-y-3">
                  <h3 className="text-sm font-semibold">Active Sessions</h3>
                  <div className="space-y-3 divide-y divide-slate-100 dark:divide-white/5">
                    <div className="flex justify-between items-center pt-2">
                      <div className="flex gap-3 items-center">
                        <Computer className="text-slate-400" size={18} />
                        <div>
                          <div className="text-xs font-semibold">Chrome (macOS)</div>
                          <div className="text-[10px] text-slate-400">Mumbai, India • Current active session</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide">Active</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 p-4 dark:border-white/5 bg-rose-500/5 flex items-start gap-4">
                  <div className="rounded-lg bg-rose-500/10 p-2 text-rose-500">
                    <Lock size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-200">Close Account & Delete Workspace</h3>
                    <p className="mt-1 text-xs text-rose-600/80 dark:text-rose-400/80 leading-5">
                      Closing your account will permanently delete all dashboard canvas designs, connected nodes, metrics history, and organization workspaces. This process is irreversible.
                    </p>
                    <button
                      type="button"
                      className="mt-4 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-500 shadow-md shadow-rose-500/10"
                    >
                      Delete Account
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
