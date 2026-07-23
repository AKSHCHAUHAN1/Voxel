import { useState, useMemo } from 'react';
import {
  User,
  Users,
  Palette,
  Shield,
  Bell,
  Code2,
  AlertTriangle,
  Check,
  Plus,
  Trash2,
  Laptop,
  Copy,
  Sliders,
  X,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '@/store/theme-store';
import { useNotificationStore } from '@/store/notification-store';
import { useSettingsStore } from '@/store/settings-store';
import { authService } from '@/features/auth/auth-service';
import { workspaceService } from '@/features/workspaces/workspace-service';

const INITIAL_MEMBERS = [
  { id: '1', name: 'Alex Rivers', email: 'alex@company.com', role: 'OWNER', avatar: 'AR', color: 'bg-violet-600' },
  { id: '2', name: 'Elena Rostova', email: 'elena@company.com', role: 'ADMIN', avatar: 'ER', color: 'bg-indigo-600' },
  { id: '3', name: 'Marcus Chen', email: 'marcus@company.com', role: 'EDITOR', avatar: 'MC', color: 'bg-cyan-600' },
  { id: '4', name: 'Sarah Jenkins', email: 'sarah@company.com', role: 'VIEWER', avatar: 'SJ', color: 'bg-emerald-600' },
];

const INITIAL_SESSIONS = [
  {
    id: 's1',
    device: 'MacBook Pro 16" (macOS)',
    browser: 'Chrome 122.0',
    location: 'San Francisco, CA, USA',
    ip: '192.168.1.104',
    lastActive: 'Active now',
    current: true,
  },
  {
    id: 's2',
    device: 'iPhone 15 Pro (iOS)',
    browser: 'Safari Mobile',
    location: 'San Francisco, CA, USA',
    ip: '172.56.21.90',
    lastActive: '2 hours ago',
    current: false,
  },
  {
    id: 's3',
    device: 'Dell XPS 15 (Windows 11)',
    browser: 'Firefox 123.0',
    location: 'New York, NY, USA',
    ip: '68.192.44.12',
    lastActive: '3 days ago',
    current: false,
  },
];

const AUDIT_LOGS = [
  { id: 'a1', action: 'workspace.update', resource: 'Design Systems Workspace', actor: 'Alex Rivers', time: '10 mins ago' },
  { id: 'a2', action: 'dashboard.create', resource: 'Q3 Financial Overview', actor: 'Elena Rostova', time: '1 hour ago' },
  { id: 'a3', action: 'member.invite', resource: 'sarah@company.com', actor: 'Alex Rivers', time: '4 hours ago' },
  { id: 'a4', action: 'security.session_revoke', resource: 'Safari (macOS)', actor: 'Alex Rivers', time: 'Yesterday' },
];

export default function SettingsPage() {
  const { theme, setTheme } = useThemeStore();
  const addToast = useNotificationStore((s) => s.add);

  // Active Tab State
  const [activeTab, setActiveTab] = useState('account');

  // Fetch Current User
  const { data: user } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authService.me,
    retry: false,
  });

  // Fetch Workspaces
  const { data: workspacesData } = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspaceService.list,
  });

  // Account & Profile State
  const [displayName, setDisplayName] = useState(user?.displayName || 'Alex Rivers');
  const [email, setEmail] = useState(user?.email || 'alex@company.com');
  const [jobTitle, setJobTitle] = useState('Principal Product Architect');
  const [timezone, setTimezone] = useState('America/Los_Angeles (UTC-08:00)');
  const [language, setLanguage] = useState('English (US)');
  const [bio, setBio] = useState('Designing interactive canvas workspaces and visual telemetry systems.');
  const [avatarColor, setAvatarColor] = useState('bg-violet-600');

  // Appearance & Canvas State
  const [accentColor, setAccentColor] = useState('violet');
  const [defaultGridStyle, setDefaultGridStyle] = useState('dots');
  const { autosaveEnabled, autosaveInterval, setAutosaveEnabled, setAutosaveInterval } =
    useSettingsStore();
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);

  // Workspace & Team State
  const [members, setMembers] = useState(INITIAL_MEMBERS);
  const [memberSearch, setMemberSearch] = useState('');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('EDITOR');
  const [inviteCopied, setInviteCopied] = useState(false);

  // Security & Sessions State
  const [sessions, setSessions] = useState(INITIAL_SESSIONS);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // Notifications State
  const [notifEmailDigest, setNotifEmailDigest] = useState(true);
  const [notifMentions, setNotifMentions] = useState(true);
  const [notifDesktop, setNotifDesktop] = useState(false);
  const [notifUpdates, setNotifUpdates] = useState(true);

  // Developer API State
  const [apiKey, setApiKey] = useState('vxl_live_948f2a1b6c890e1d2e3f4a5b6c7d8e9f');
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('https://api.company.com/webhooks/voxel');

  // Danger Zone State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');

  // Handlers
  const handleSaveProfile = (e) => {
    e.preventDefault();
    addToast('Profile preferences updated successfully.', 'success');
  };

  const handleSavePassword = (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      addToast('New password must be at least 6 characters.', 'warning');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      addToast('New passwords do not match.', 'warning');
      return;
    }
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    addToast('Security password updated successfully.', 'success');
  };

  const handleCopyInvite = () => {
    navigator.clipboard.writeText('https://voxel.app/invite/ws_981273918237');
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
    addToast('Workspace invite link copied to clipboard.', 'info');
  };

  const handleCopyApiKey = () => {
    navigator.clipboard.writeText(apiKey);
    setApiKeyCopied(true);
    setTimeout(() => setApiKeyCopied(false), 2000);
    addToast('API key copied to clipboard.', 'info');
  };

  const handleRegenerateKey = () => {
    const nextKey = `vxl_live_${Math.random().toString(36).substring(2)}${Math.random().toString(36).substring(2)}`;
    setApiKey(nextKey);
    addToast('New production API key generated.', 'warning');
  };

  const handleRevokeSession = (id) => {
    setSessions(sessions.filter((s) => s.id !== id));
    addToast('Session revoked successfully.', 'info');
  };

  const handleInviteSubmit = (e) => {
    e.preventDefault();
    if (!inviteName || !inviteEmail) return;
    const initials = inviteName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
    const newMember = {
      id: Math.random().toString(),
      name: inviteName,
      email: inviteEmail,
      role: inviteRole,
      avatar: initials || 'MB',
      color: 'bg-violet-600',
    };
    setMembers([...members, newMember]);
    setInviteName('');
    setInviteEmail('');
    setInviteModalOpen(false);
    addToast(`Invitation sent to ${inviteEmail}`, 'success');
  };

  const filteredMembers = useMemo(() => {
    return members.filter(
      (m) =>
        m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.email.toLowerCase().includes(memberSearch.toLowerCase())
    );
  }, [members, memberSearch]);

  const tabs = [
    { id: 'account', label: 'Account & Profile', icon: User },
    { id: 'appearance', label: 'Appearance & Canvas', icon: Palette },
    { id: 'workspace', label: 'Workspace & Team', icon: Users },
    { id: 'security', label: 'Security & Sessions', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'developer', label: 'API & Developer SDK', icon: Code2 },
    { id: 'danger', label: 'Danger Zone', icon: AlertTriangle, danger: true },
  ];

  return (
    <div className="mx-auto max-w-7xl pb-16 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-3 py-1 text-xs font-extrabold uppercase tracking-[.18em] text-violet-600 dark:bg-violet-500/15 dark:text-violet-300 border border-violet-200/60 dark:border-violet-500/20">
              <Sliders size={13} /> Settings Suite
            </span>
            {workspacesData && (
              <span className="text-xs text-slate-400 font-semibold">
                • {workspacesData.length} Workspace{workspacesData.length === 1 ? '' : 's'} Managed
              </span>
            )}
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950 dark:text-white">
            Platform Settings
          </h1>
          <p className="mt-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 max-w-2xl">
            Configure your personal identity, theme preferences, team access controls, API keys, and workspace parameters.
          </p>
        </div>
      </div>

      {/* Main Settings Layout */}
      <div className="grid grid-cols-12 gap-8 items-start">
        {/* Navigation Sidebar */}
        <aside className="col-span-12 lg:col-span-3 space-y-1.5">
          <nav className="flex lg:flex-col overflow-x-auto gap-1 bg-white/70 dark:bg-slate-900/60 rounded-2xl border border-slate-200/80 dark:border-white/10 p-1.5 shadow-sm backdrop-blur-xl">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-3 px-4 py-3 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                    isActive
                      ? tab.danger
                        ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                        : 'bg-violet-600 text-white shadow-md shadow-violet-600/20 dark:bg-violet-600'
                      : tab.danger
                        ? 'text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-950 dark:hover:text-white'
                  }`}
                >
                  <Icon size={17} className={isActive ? 'text-white' : tab.danger ? 'text-rose-500' : 'text-slate-400'} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Content Area */}
        <main className="col-span-12 lg:col-span-9">
          <AnimatePresence mode="wait">
            {/* TAB 1: Account & Profile */}
            {activeTab === 'account' && (
              <motion.div
                key="account"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-white/10 dark:bg-slate-900/60 shadow-sm relative overflow-hidden">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-1.5 h-6 bg-violet-600 rounded-full" />
                    <h2 className="text-lg font-extrabold tracking-tight">Account & Profile</h2>
                  </div>

                  <form onSubmit={handleSaveProfile} className="space-y-6">
                    {/* Avatar Customizer */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5">
                      <div
                        className={`grid size-16 place-items-center rounded-2xl ${avatarColor} text-2xl font-extrabold text-white shadow-inner transition-colors shrink-0`}
                      >
                        {displayName.slice(0, 2).toUpperCase() || 'GU'}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                          Avatar Badge Color
                        </p>
                        <div className="flex gap-2.5">
                          {[
                            'bg-violet-600',
                            'bg-indigo-600',
                            'bg-blue-600',
                            'bg-cyan-600',
                            'bg-emerald-600',
                            'bg-rose-600',
                            'bg-amber-600',
                          ].map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setAvatarColor(color)}
                              className={`size-6 rounded-full border border-white/20 transition hover:scale-110 cursor-pointer ${color} ${
                                avatarColor === color ? 'ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-slate-900 scale-105' : ''
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                          Display Name
                        </label>
                        <input
                          type="text"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-white/10"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                          Email Address
                        </label>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-white/10"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                          Job Title / Role
                        </label>
                        <input
                          type="text"
                          value={jobTitle}
                          onChange={(e) => setJobTitle(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-white/10"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                          Primary Language
                        </label>
                        <select
                          value={language}
                          onChange={(e) => setLanguage(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-white/10 dark:bg-slate-900"
                        >
                          <option value="English (US)">English (US)</option>
                          <option value="English (UK)">English (UK)</option>
                          <option value="Spanish">Spanish</option>
                          <option value="German">German</option>
                          <option value="Japanese">Japanese</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                          Timezone
                        </label>
                        <select
                          value={timezone}
                          onChange={(e) => setTimezone(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-white/10 dark:bg-slate-900"
                        >
                          <option value="America/Los_Angeles (UTC-08:00)">Pacific Time (US & Canada)</option>
                          <option value="America/New_York (UTC-05:00)">Eastern Time (US & Canada)</option>
                          <option value="Europe/London (UTC+00:00)">London, UTC</option>
                          <option value="Asia/Kolkata (UTC+05:30)">India Standard Time (IST)</option>
                          <option value="Asia/Tokyo (UTC+09:00)">Tokyo Standard Time</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                        Bio / Notes
                      </label>
                      <textarea
                        rows={3}
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        className="w-full resize-none rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-white/10"
                      />
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex justify-end">
                      <button
                        type="submit"
                        className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/25 hover:bg-violet-500 transition cursor-pointer"
                      >
                        <Check size={16} /> Save Account Preferences
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}

            {/* TAB 2: Appearance & Canvas */}
            {activeTab === 'appearance' && (
              <motion.div
                key="appearance"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-white/10 dark:bg-slate-900/60 shadow-sm space-y-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-1.5 h-6 bg-violet-600 rounded-full" />
                    <h2 className="text-lg font-extrabold tracking-tight">Appearance & Canvas Mode</h2>
                  </div>

                  {/* Theme Mode */}
                  <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Interface Theme Mode
                    </p>
                    <div className="grid grid-cols-2 gap-3 sm:w-80">
                      <button
                        type="button"
                        onClick={() => setTheme('light')}
                        className={`flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                          theme === 'light'
                            ? 'border-violet-600 bg-violet-50 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200 shadow-sm'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5'
                        }`}
                      >
                        Light Mode
                      </button>
                      <button
                        type="button"
                        onClick={() => setTheme('dark')}
                        className={`flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                          theme === 'dark'
                            ? 'border-violet-600 bg-violet-500/20 text-violet-200 shadow-sm'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5'
                        }`}
                      >
                        Dark Mode
                      </button>
                    </div>
                  </div>

                  {/* Brand Accent Color */}
                  <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Canvas Accent Theme Palette
                    </p>
                    <div className="flex gap-3">
                      {[
                        { id: 'violet', label: 'Violet', bg: 'bg-violet-600' },
                        { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-600' },
                        { id: 'cyan', label: 'Cyan', bg: 'bg-cyan-600' },
                        { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-600' },
                        { id: 'rose', label: 'Rose', bg: 'bg-rose-600' },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setAccentColor(item.id)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            accentColor === item.id
                              ? 'border-violet-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                              : 'border-slate-200 dark:border-white/10 text-slate-500'
                          }`}
                        >
                          <span className={`size-3.5 rounded-full ${item.bg}`} />
                          <span>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Default Grid Style */}
                  <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 space-y-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Default Canvas Grid Style
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {[
                        { id: 'dots', label: 'Dot Matrix' },
                        { id: 'lines', label: 'Grid Lines' },
                        { id: 'mesh', label: 'Radial Mesh' },
                        { id: 'blank', label: 'Clean Canvas' },
                      ].map((grid) => (
                        <button
                          key={grid.id}
                          type="button"
                          onClick={() => setDefaultGridStyle(grid.id)}
                          className={`py-3 px-3 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                            defaultGridStyle === grid.id
                              ? 'border-violet-600 bg-violet-600 text-white shadow-md'
                              : 'border-slate-200 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-violet-300'
                          }`}
                        >
                          {grid.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Autosave Engine Controls */}
                  <div className="p-4.5 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">
                          Automatic Canvas Saving (Autosave Engine)
                        </div>
                        <div className="text-[11px] text-slate-500 max-w-lg mt-0.5 leading-relaxed">
                          {autosaveEnabled
                            ? 'Autosave is ENABLED. Changes automatically persist to backend database. The manual Save button is hidden on dashboards.'
                            : 'Autosave is DISABLED. You must manually click the Save button on dashboards to save changes.'}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={autosaveEnabled}
                        onChange={(e) => {
                          setAutosaveEnabled(e.target.checked);
                          addToast(
                            e.target.checked
                              ? 'Autosave ENABLED. Manual save button hidden.'
                              : 'Autosave DISABLED. Manual save button enabled on dashboards.',
                            e.target.checked ? 'success' : 'warning'
                          );
                        }}
                        className="size-5 accent-violet-600 cursor-pointer"
                      />
                    </div>

                    {autosaveEnabled && (
                      <div className="pt-3 border-t border-slate-200/60 dark:border-white/5 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Autosave Sync Frequency
                        </p>
                        <div className="grid grid-cols-3 gap-2.5 sm:w-96">
                          {[
                            { id: 'realtime', label: 'Realtime (Instant)' },
                            { id: '5s', label: 'Every 5s' },
                            { id: '30s', label: 'Every 30s' },
                          ].map((freq) => (
                            <button
                              key={freq.id}
                              type="button"
                              onClick={() => {
                                setAutosaveInterval(freq.id);
                                addToast(`Autosave sync frequency set to ${freq.label}`, 'info');
                              }}
                              className={`py-2 px-2 text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                                autosaveInterval === freq.id
                                  ? 'border-violet-600 bg-violet-600 text-white shadow-md'
                                  : 'border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                              }`}
                            >
                              {freq.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Canvas Options */}
                  <div className="space-y-4 pt-2">
                    <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 cursor-pointer">
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Snap-to-Grid Snapping</div>
                        <div className="text-[11px] text-slate-500">Automatically aligns layout cards to nearest grid coordinates</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={snapToGrid}
                        onChange={(e) => setSnapToGrid(e.target.checked)}
                        className="size-4 accent-violet-600 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 cursor-pointer">
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Reduced Motion & Animations</div>
                        <div className="text-[11px] text-slate-500">Disables 3D parallax effects and ambient floating bubbles</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={reducedMotion}
                        onChange={(e) => setReducedMotion(e.target.checked)}
                        className="size-4 accent-violet-600 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 3: Workspace & Team */}
            {activeTab === 'workspace' && (
              <motion.div
                key="workspace"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-white/10 dark:bg-slate-900/60 shadow-sm space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-6 bg-violet-600 rounded-full" />
                      <h2 className="text-lg font-extrabold tracking-tight">Workspace & Member Access</h2>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleCopyInvite}
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                      >
                        <Copy size={14} /> {inviteCopied ? 'Link Copied!' : 'Copy Invite Link'}
                      </button>
                      <button
                        onClick={() => setInviteModalOpen(true)}
                        type="button"
                        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-violet-500 cursor-pointer"
                      >
                        <Plus size={15} /> Invite Member
                      </button>
                    </div>
                  </div>

                  {/* Search Bar */}
                  <div className="relative">
                    <input
                      type="text"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      placeholder="Search team members by name or email..."
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 dark:bg-white/5 px-4 py-2.5 text-xs outline-none focus:ring-2 focus:ring-violet-500 dark:border-white/10"
                    />
                  </div>

                  {/* Members Table */}
                  <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-900/80 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">
                        <tr>
                          <th className="px-4 py-3.5">Member</th>
                          <th className="px-4 py-3.5">Workspace Role</th>
                          <th className="px-4 py-3.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {filteredMembers.map((member) => (
                          <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-3">
                                <span className={`grid size-9 place-items-center rounded-xl ${member.color} text-xs font-extrabold text-white shrink-0`}>
                                  {member.avatar}
                                </span>
                                <div>
                                  <div className="font-bold text-slate-800 dark:text-slate-200">{member.name}</div>
                                  <div className="text-[10px] text-slate-400">{member.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className={`inline-block rounded-full px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${
                                  member.role === 'OWNER'
                                    ? 'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200'
                                    : member.role === 'ADMIN'
                                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200'
                                      : member.role === 'EDITOR'
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200'
                                        : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400'
                                }`}
                              >
                                {member.role}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-right">
                              {member.role !== 'OWNER' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMembers(members.filter((m) => m.id !== member.id));
                                    addToast(`Removed ${member.name} from workspace`, 'info');
                                  }}
                                  className="text-slate-400 hover:text-rose-600 p-1.5 rounded-lg transition-colors cursor-pointer"
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
              </motion.div>
            )}

            {/* TAB 4: Security & Sessions */}
            {activeTab === 'security' && (
              <motion.div
                key="security"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                {/* Change Password Card */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-white/10 dark:bg-slate-900/60 shadow-sm space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-violet-600 rounded-full" />
                    <h2 className="text-lg font-extrabold tracking-tight">Security Credentials</h2>
                  </div>

                  <form onSubmit={handleSavePassword} className="space-y-4 max-w-md">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                        Current Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPass ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 pr-10 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-white/10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPass(!showPass)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                        >
                          {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                        New Password
                      </label>
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-white/10"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                        Confirm New Password
                      </label>
                      <input
                        type={showPass ? 'text' : 'password'}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="••••••••••••"
                        className="w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-white/10"
                      />
                    </div>

                    <label className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 cursor-pointer mt-3">
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Two-Factor Authentication (2FA)</div>
                        <div className="text-[11px] text-slate-500">Enforce TOTP authenticator prompt upon device sign in</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={twoFactorEnabled}
                        onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                        className="size-4 accent-violet-600 cursor-pointer"
                      />
                    </label>

                    <button
                      type="submit"
                      className="rounded-xl bg-violet-600 px-4.5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-violet-500 cursor-pointer"
                    >
                      Update Security Password
                    </button>
                  </form>
                </div>

                {/* Active Sessions */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-white/10 dark:bg-slate-900/60 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-6 bg-violet-600 rounded-full" />
                      <h2 className="text-lg font-extrabold tracking-tight">Active Browser & Device Sessions</h2>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5"
                      >
                        <div className="flex items-center gap-3">
                          <span className="grid size-10 place-items-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-200 shrink-0">
                            <Laptop size={18} />
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{session.device}</span>
                              {session.current && (
                                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[9px] font-extrabold uppercase text-emerald-600 dark:text-emerald-400">
                                  Current Device
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              {session.browser} • {session.location} ({session.ip})
                            </div>
                          </div>
                        </div>

                        {!session.current && (
                          <button
                            type="button"
                            onClick={() => handleRevokeSession(session.id)}
                            className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-400 cursor-pointer self-start sm:self-auto"
                          >
                            Revoke Access
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Audit Logs */}
                <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-white/10 dark:bg-slate-900/60 shadow-sm space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-violet-600 rounded-full" />
                    <h2 className="text-lg font-extrabold tracking-tight">Recent Security Audit Logs</h2>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-900/80 dark:text-slate-400 border-b border-slate-200 dark:border-white/10">
                        <tr>
                          <th className="px-4 py-3">Event Action</th>
                          <th className="px-4 py-3">Resource</th>
                          <th className="px-4 py-3">Actor</th>
                          <th className="px-4 py-3 text-right">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                        {AUDIT_LOGS.map((log) => (
                          <tr key={log.id}>
                            <td className="px-4 py-3 font-mono text-[11px] text-violet-600 dark:text-violet-300">{log.action}</td>
                            <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">{log.resource}</td>
                            <td className="px-4 py-3 text-slate-500">{log.actor}</td>
                            <td className="px-4 py-3 text-right text-slate-400 text-[10px]">{log.time}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 5: Notifications */}
            {activeTab === 'notifications' && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-white/10 dark:bg-slate-900/60 shadow-sm space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-1.5 h-6 bg-violet-600 rounded-full" />
                    <h2 className="text-lg font-extrabold tracking-tight">Notification Channels</h2>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center justify-between p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 cursor-pointer">
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Email Digest Notifications</div>
                        <div className="text-[11px] text-slate-500">Receive weekly summaries of workspace canvas updates</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifEmailDigest}
                        onChange={(e) => setNotifEmailDigest(e.target.checked)}
                        className="size-4 accent-violet-600 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 cursor-pointer">
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Team Collaboration Mentions</div>
                        <div className="text-[11px] text-slate-500">Alert when a team peer mentions @you in a card node or comment</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifMentions}
                        onChange={(e) => setNotifMentions(e.target.checked)}
                        className="size-4 accent-violet-600 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 cursor-pointer">
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Real-time Desktop Alerts</div>
                        <div className="text-[11px] text-slate-500">Pop up push notifications for live canvas events</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifDesktop}
                        onChange={(e) => setNotifDesktop(e.target.checked)}
                        className="size-4 accent-violet-600 cursor-pointer"
                      />
                    </label>

                    <label className="flex items-center justify-between p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 cursor-pointer">
                      <div>
                        <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Platform Feature & Security Updates</div>
                        <div className="text-[11px] text-slate-500">Get notified about new Voxel features, API versions, and system releases</div>
                      </div>
                      <input
                        type="checkbox"
                        checked={notifUpdates}
                        onChange={(e) => setNotifUpdates(e.target.checked)}
                        className="size-4 accent-violet-600 cursor-pointer"
                      />
                    </label>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 6: API & Developer SDK */}
            {activeTab === 'developer' && (
              <motion.div
                key="developer"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-white/10 dark:bg-slate-900/60 shadow-sm space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-violet-600 rounded-full" />
                    <h2 className="text-lg font-extrabold tracking-tight">API Keys & Webhooks</h2>
                  </div>

                  {/* API Key */}
                  <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                        Production Secret Key
                      </label>
                      <button
                        type="button"
                        onClick={handleRegenerateKey}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 hover:text-amber-500 cursor-pointer"
                      >
                        <RefreshCw size={12} /> Regenerate Key
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={apiKey}
                        className="w-full font-mono text-xs rounded-xl border border-slate-200 bg-white dark:bg-slate-900 px-3.5 py-2.5 dark:border-white/10"
                      />
                      <button
                        type="button"
                        onClick={handleCopyApiKey}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-violet-500 cursor-pointer shrink-0"
                      >
                        <Copy size={14} /> {apiKeyCopied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>

                  {/* Webhook Endpoint */}
                  <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      Webhook Event Endpoint URL
                    </label>
                    <input
                      type="url"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      className="w-full font-mono text-xs rounded-xl border border-slate-200 bg-white dark:bg-slate-900 px-3.5 py-2.5 outline-none focus:ring-2 focus:ring-violet-500 dark:border-white/10"
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 7: Danger Zone */}
            {activeTab === 'danger' && (
              <motion.div
                key="danger"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                <div className="rounded-3xl border border-rose-300/80 bg-rose-500/5 p-6 sm:p-8 dark:border-rose-500/30 dark:bg-rose-950/20 shadow-sm space-y-6">
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-6 bg-rose-600 rounded-full" />
                    <h2 className="text-lg font-extrabold tracking-tight text-rose-600 dark:text-rose-400">
                      Danger Zone
                    </h2>
                  </div>

                  <p className="text-xs text-rose-600/80 dark:text-rose-300/80 leading-relaxed">
                    Actions performed in the danger zone affect team data permanently. Please review carefully before proceeding.
                  </p>

                  <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-rose-200 dark:border-rose-500/20 bg-white/80 dark:bg-slate-900/60">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">Delete Account</div>
                        <div className="text-[11px] text-slate-500">Permanently delete your account and all associated workspace nodes</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDeleteModalOpen(true)}
                        className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-rose-500 cursor-pointer shrink-0"
                      >
                        Delete Account
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* Invite Modal */}
      {inviteModalOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onMouseDown={() => setInviteModalOpen(false)}
        >
          <form
            onSubmit={handleInviteSubmit}
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-2xl dark:border-white/10 dark:bg-slate-900"
          >
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-base font-extrabold">Invite Workspace Member</h3>
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Member Name
                </label>
                <input
                  type="text"
                  required
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Elena Rostova"
                  className="w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 dark:border-white/10"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="elena@company.com"
                  className="w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 dark:border-white/10"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                  Workspace Access Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 dark:border-white/10 dark:bg-slate-900"
                >
                  <option value="ADMIN">ADMIN — Full admin rights</option>
                  <option value="EDITOR">EDITOR — Edit canvas nodes & layout</option>
                  <option value="VIEWER">VIEWER — Read-only access</option>
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInviteModalOpen(false)}
                className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-violet-600 px-4.5 py-2.5 text-xs font-bold text-white hover:bg-violet-500 shadow-md cursor-pointer"
              >
                Send Invitation
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {deleteModalOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onMouseDown={() => setDeleteModalOpen(false)}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-6 sm:p-8 shadow-2xl dark:border-rose-500/30 dark:bg-slate-900 space-y-4"
          >
            <h3 className="text-base font-extrabold text-rose-600 dark:text-rose-400">
              Confirm Account Deletion
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              This will permanently soft-delete your account, workspace memberships, and node credentials. Type <b className="font-mono text-rose-600">DELETE MY ACCOUNT</b> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
              className="w-full rounded-xl border border-rose-300 bg-transparent px-3.5 py-2.5 text-xs font-mono outline-none focus:ring-2 focus:ring-rose-500 dark:border-rose-500/40"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalOpen(false)}
                className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmation !== 'DELETE MY ACCOUNT'}
                onClick={() => {
                  setDeleteModalOpen(false);
                  addToast('Account deletion request queued.', 'warning');
                }}
                className="rounded-xl bg-rose-600 px-4.5 py-2.5 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-40 cursor-pointer"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
