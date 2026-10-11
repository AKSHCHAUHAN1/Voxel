import { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import appIcon from '@/assets/app-icon.png';
import appIconDark from '@/assets/app-icon-dark.png';
import horizontalLogo from '@/assets/horizontal-logo.png';
import horizontalLogoDark from '@/assets/horizontal-logo-dark.png';
import {
  Bell,
  Boxes,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Command as CommandIcon,
  LogOut,
  Moon,
  PanelsTopLeft,
  Search,
  Settings,
  Sun,
  X,
  Keyboard,
  User,
  Users,
  Bookmark,
  Puzzle,
  Archive,
  Check,
  MailOpen,
  Trash2,
  LoaderCircle,
} from 'lucide-react';
import { authService } from '@/features/auth/auth-service';
import { useThemeStore } from '@/store/theme-store';
import { toggleThemeWithRipple } from '@/utils/theme-ripple';
import { workspaceService } from '@/features/workspaces/workspace-service';
import { CommandPalette } from '@/components/command/CommandPalette';
import { CustomConfirmModal } from '@/components/feedback/CustomConfirmModal';
import { attachGlobalShortcuts, detachGlobalShortcuts, formatCombo, useShortcut } from '@/lib/keyboard';
import { useNotificationStore } from '@/store/notification-store';
import { useSettingsStore } from '@/store/settings-store';
import { notificationService } from '@/features/notifications/notification-service';

function SearchResultSection({ title, children }) {
  return (
    <section className="py-1">
      <h2 className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

function SearchResultButton({ icon: Icon, title, detail, onClick }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-xs transition hover:bg-violet-50 dark:hover:bg-violet-500/10">
      <Icon size={15} className="shrink-0 text-violet-500" />
      <span className="min-w-0">
        <span className="block truncate font-semibold text-slate-900 dark:text-white">{title}</span>
        {detail && <span className="mt-0.5 block truncate text-[10px] text-slate-400">{detail}</span>}
      </span>
    </button>
  );
}

function groupNotificationsByDate(notifications) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;
  const groups = new Map();
  notifications.forEach((notification) => {
    const date = new Date(notification.createdAt);
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const label = day === today ? 'Today' : day === yesterday ? 'Yesterday' : date.toLocaleDateString();
    groups.set(label, [...(groups.get(label) || []), notification]);
  });
  return [...groups.entries()];
}

function formatNotificationDate(value) {
  const date = new Date(value);
  return date.toLocaleDateString() === new Date().toLocaleDateString()
    ? date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationScope, setNotificationScope] = useState('all');
  const [showGuestLogoutModal, setShowGuestLogoutModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const normalizedSearch = searchQuery.trim().toLowerCase();
  // Theme state and bubble animation state
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const notifRef = useRef(null);
  const userMenuRef = useRef(null);

  const toasts = useNotificationStore((s) => s.toasts);
  const removeToast = useNotificationStore((s) => s.removeToast);

  // Fetch current user details
  const userQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authService.me,
    retry: false,
  });

  const user = userQuery.data;
  const notificationQuery = useQuery({
    queryKey: ['notifications', user?.id, notificationScope],
    queryFn: () => notificationService.list(notificationScope),
    enabled: Boolean(user?.id),
    staleTime: 10_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
  const notificationQueryKey = ['notifications', user?.id];
  const updateNotification = useMutation({
    mutationFn: ({ id, ...input }) => notificationService.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationQueryKey }),
  });
  const deleteNotification = useMutation({
    mutationFn: notificationService.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationQueryKey }),
  });
  const markNotificationsRead = useMutation({
    mutationFn: notificationService.markAllRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationQueryKey }),
  });
  const archiveNotifications = useMutation({
    mutationFn: notificationService.archiveAll,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notificationQueryKey }),
  });
  const notifications = notificationQuery.data?.items || [];
  const unreadCount = notificationQuery.data?.unreadCount || 0;
  const notificationGroups = groupNotificationsByDate(notifications);
  const setAccentColor = useSettingsStore((s) => s.setAccentColor);
  const setDefaultGridStyle = useSettingsStore((s) => s.setDefaultGridStyle);
  const setSnapToGrid = useSettingsStore((s) => s.setSnapToGrid);
  const setReducedMotion = useSettingsStore((s) => s.setReducedMotion);
  const setAutosaveEnabled = useSettingsStore((s) => s.setAutosaveEnabled);
  const setAutosaveInterval = useSettingsStore((s) => s.setAutosaveInterval);
  const isGoogleLogin = user && user.email !== 'guest@voxel.com';
  const displayName = user?.displayName || 'Guest User';
  const email = user?.email || 'guest@voxel.com';
  const avatarColor = useSettingsStore((s) => s.avatarColor || 'bg-violet-600');
  const avatarInitials =
    displayName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'GU';

  // Fetch workspaces list for search lookup
  const workspaces = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspaceService.list,
  });

  const isGuestUser = user && (user.email === 'guest@voxel.com' || user.googleSubject === 'guest-google-sub');

  useEffect(() => {
    const preferences = user?.preferences;
    if (!preferences) return;
    if (preferences.theme) setTheme(preferences.theme);
    if (preferences.accentColor) setAccentColor(preferences.accentColor);
    if (preferences.defaultGridStyle) setDefaultGridStyle(preferences.defaultGridStyle === 'mesh' ? 'radial' : preferences.defaultGridStyle);
    if (typeof preferences.snapToGrid === 'boolean') setSnapToGrid(preferences.snapToGrid);
    if (typeof preferences.reducedMotion === 'boolean') setReducedMotion(preferences.reducedMotion);
    if (preferences.autosaveInterval) setAutosaveInterval(preferences.autosaveInterval);
    if (typeof preferences.autosaveEnabled === 'boolean') setAutosaveEnabled(preferences.autosaveEnabled);
  }, [user?.id, user?.preferences, setTheme, setAccentColor, setDefaultGridStyle, setSnapToGrid, setReducedMotion, setAutosaveEnabled, setAutosaveInterval]);

  const logout = async () => {
    useNotificationStore.getState().clearAll();
    await authService.logout();
    queryClient.clear();
    navigate('/login');
  };

  const handleLogoutClick = () => {
    setMenuOpen(false);
    if (isGuestUser) {
      setShowGuestLogoutModal(true);
    } else {
      void logout();
    }
  };

  // Clear previous notifications if user ID changes
  useEffect(() => {
    if (user?.id) {
      const activeSessionUser = sessionStorage.getItem('voxel_active_user');
      if (activeSessionUser && activeSessionUser !== user.id) {
        useNotificationStore.getState().clearAll();
      }
      sessionStorage.setItem('voxel_active_user', user.id);
    }
  }, [user?.id]);

  // Sync theme with document.documentElement classList
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Initialize global shortcuts listener
  useEffect(() => {
    attachGlobalShortcuts();
    return () => detachGlobalShortcuts();
  }, []);

  useShortcut('meta+k', () => setCommandPaletteOpen(true), {
    label: 'Open command palette',
    category: 'General',
    allowInInput: true,
  });

  useShortcut('meta+shift+f', () => {
    searchInputRef.current?.focus();
    setSearchDropdownOpen(true);
  }, {
    label: 'Search Voxel resources',
    category: 'Navigation',
    allowInInput: true,
  });

  useShortcut('meta+/', () => setCommandOpen((prev) => !prev), {
    label: 'Toggle keyboard shortcuts menu',
    category: 'General',
    allowInInput: true,
  });

  // Close search dropdown, notifications, and user profile menu outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const openNotification = (notification) => {
    if (!notification.read) updateNotification.mutate({ id: notification.id, read: true });
    setNotificationsOpen(false);
    const { workspaceId, dashboardId, inviteToken } = notification.payload || {};
    if (inviteToken) {
      navigate(`/invite/${encodeURIComponent(inviteToken)}`);
      return;
    }
    if (workspaceId && dashboardId) {
      navigate(`/workspaces/${workspaceId}/dashboards/${dashboardId}`, {
        state: notification.type.startsWith('collaboration.') ? { openComments: true } : undefined,
      });
    }
  };

  // Nothing OS Screen Power Ripple Theme Transition
  const handleThemeToggle = (e) => {
    toggleThemeWithRipple(e, theme, setTheme);
  };

  // Fetch dashboards for search index
  const dashboardsQueries = useQuery({
    queryKey: ['all-dashboards', workspaces.data?.map(w => w.id)],
    queryFn: async () => {
      if (!workspaces.data) return [];
      const all = [];
      for (const ws of workspaces.data) {
        try {
          const results = await workspaceService.dashboards(ws.id);
          if (Array.isArray(results)) all.push(...results.map((dashboard) => ({ ...dashboard, workspaceName: ws.name })));
        } catch (_e) {
          // ignore
        }
      }
      return all;
    },
    enabled: Boolean(workspaces.data),
    staleTime: 60_000,
  });

  const templatesQueries = useQuery({
    queryKey: ['all-templates', workspaces.data?.map((workspace) => workspace.id)],
    queryFn: async () => {
      const results = await Promise.all((workspaces.data || []).map(async (workspace) => {
        const templates = await workspaceService.templates(workspace.id).catch(() => []);
        return templates.map((template) => ({ ...template, workspaceName: workspace.name }));
      }));
      return results.flat();
    },
    enabled: normalizedSearch.length > 1 && Boolean(workspaces.data),
    staleTime: 60_000,
  });

  const membersQueries = useQuery({
    queryKey: ['all-workspace-members', workspaces.data?.map((workspace) => workspace.id)],
    queryFn: async () => {
      const results = await Promise.all((workspaces.data || []).map(async (workspace) => {
        const members = await workspaceService.members(workspace.id).catch(() => []);
        return members.map((member) => ({ ...member, workspaceId: workspace.id, workspaceName: workspace.name }));
      }));
      return results.flat();
    },
    enabled: normalizedSearch.length > 1 && Boolean(workspaces.data),
    staleTime: 60_000,
  });

  const filteredDashboards = dashboardsQueries.data
    ? dashboardsQueries.data.filter((dashboard) => `${dashboard.name} ${dashboard.description || ''} ${dashboard.workspaceName || ''}`.toLowerCase().includes(normalizedSearch))
    : [];

  const filteredWorkspaces = workspaces.data
    ? workspaces.data.filter((workspace) => `${workspace.name} ${workspace.description || ''}`.toLowerCase().includes(normalizedSearch))
    : [];

  const filteredWidgets = normalizedSearch.length > 1 && dashboardsQueries.data
    ? dashboardsQueries.data.flatMap((dashboard) => (dashboard.scene?.nodes || [])
      .map((node) => ({ ...node, dashboardId: dashboard.id, dashboardName: dashboard.name, workspaceId: dashboard.workspaceId, workspaceName: dashboard.workspaceName }))
      .filter((node) => [node.title, node.type, node.content, node.description, node.code, node.url, node.rows, node.dashboardName].filter((value) => value != null).map(String).join(' ').toLowerCase().includes(normalizedSearch)))
      .slice(0, 8)
    : [];
  const filteredTemplates = templatesQueries.data
    ? templatesQueries.data.filter((template) => `${template.name} ${template.description || ''} ${template.category} ${(template.tags || []).join(' ')} ${template.workspaceName}`.toLowerCase().includes(normalizedSearch)).slice(0, 8)
    : [];
  const filteredMembers = membersQueries.data
    ? membersQueries.data.filter((member) => `${member.user?.displayName || ''} ${member.user?.email || ''} ${member.workspaceName}`.toLowerCase().includes(normalizedSearch)).slice(0, 8)
    : [];

  const globalCommands = normalizedSearch ? [
    ...(workspaces.data || []).filter((workspace) => ['OWNER', 'ADMIN', 'EDITOR'].includes(workspace.role)).map((workspace) => ({
      id: `new-dashboard-${workspace.id}`,
      label: `Create dashboard in ${workspace.name}`,
      icon: PanelsTopLeft,
      run: () => { navigate(`/workspaces/${workspace.id}/dashboards`, { state: { openCreateDashboard: true } }); setSearchDropdownOpen(false); },
    })),
    ...(workspaces.data || []).filter((workspace) => ['OWNER', 'ADMIN'].includes(workspace.role)).map((workspace) => ({
      id: `invite-member-${workspace.id}`,
      label: `Invite member to ${workspace.name}`,
      icon: Users,
      run: () => { navigate('/settings', { state: { settingsTab: 'workspace', workspaceId: workspace.id, openInvite: true } }); setSearchDropdownOpen(false); },
    })),
    { id: 'new-workspace', label: 'Create workspace', icon: Boxes, run: () => { navigate('/workspaces', { state: { openCreateWorkspace: true } }); setSearchDropdownOpen(false); } },
    { id: 'settings', label: 'Open settings', icon: Settings, run: () => { navigate('/settings'); setSearchDropdownOpen(false); } },
    ...[
      { id: 'profile', label: 'Profile preferences', tab: 'account' },
      { id: 'appearance', label: 'Appearance and canvas settings', tab: 'appearance' },
      { id: 'team-settings', label: 'Workspace members and collaboration', tab: 'workspace' },
      { id: 'security', label: 'Security and sessions', tab: 'security' },
      { id: 'notifications', label: 'Notification preferences', tab: 'notifications' },
    ].map((setting) => ({
      id: `settings-${setting.id}`,
      label: setting.label,
      icon: Settings,
      run: () => { navigate('/settings', { state: { settingsTab: setting.tab } }); setSearchDropdownOpen(false); },
    })),
    { id: 'theme', label: `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`, icon: theme === 'dark' ? Sun : Moon, run: () => { setTheme(theme === 'dark' ? 'light' : 'dark'); setSearchDropdownOpen(false); } },
  ].filter((command) => command.label.toLowerCase().includes(normalizedSearch)).slice(0, 8) : [];

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#060913] dark:text-slate-100 transition-colors duration-300"
    >
      {/* Main Content Area */}

      <aside
        className={`flex flex-col fixed left-0 top-0 h-full bg-white dark:bg-slate-950 z-50 transition-all duration-300 overflow-hidden border-r border-slate-200 dark:border-white/10 ${collapsed ? 'w-20' : 'w-64'}`}
      >
        {/* Brand Logo header */}
        <div className="py-8 px-4 transition-all duration-300">
          <Link
            to="/workspaces"
            className={`flex items-center transition-all duration-300 ${collapsed ? 'justify-center' : 'gap-3 px-2'}`}
          >
            {collapsed ? (
              <>
                <img src={appIcon} alt="Voxel" className="w-10 h-10 object-contain block dark:hidden" />
                <img src={appIconDark} alt="Voxel" className="w-10 h-10 object-contain hidden dark:block" />
              </>
            ) : (
              <>
                <img src={horizontalLogo} alt="Voxel" className="h-14 object-contain block dark:hidden" />
                <img src={horizontalLogoDark} alt="Voxel" className="h-14 object-contain hidden dark:block" />
              </>
            )}
          </Link>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-4 space-y-1.5">
          {[
            {
              path: '/workspaces',
              label: 'Workspaces',
              icon: PanelsTopLeft,
              activeCheck: (p) => p.startsWith('/workspaces'),
            },
            {
              path: '/settings',
              label: 'Settings',
              icon: Settings,
              activeCheck: (p) => p === '/settings',
            },
          ].map((item) => {
            const active = item.activeCheck(location.pathname);
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 rounded-xl transition-all duration-300 group relative overflow-hidden border
                  ${
                    active
                      ? 'text-violet-600 dark:text-violet-200 bg-violet-50 dark:bg-violet-500/10 border-violet-100/50 dark:border-violet-500/20 shadow-sm font-bold'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 border-transparent'
                  }
                  ${collapsed ? 'justify-center w-12 h-12 mx-auto p-0' : 'px-4 py-3'}
                `}
              >
                {active && (
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-violet-600 rounded-l-full" />
                )}
                <Icon
                  size={20}
                  strokeWidth={active ? 2.2 : 1.8}
                  className="shrink-0 relative z-10"
                />
                <span
                  className={`text-sm font-semibold relative z-10 whitespace-nowrap overflow-hidden transition-all duration-300 ${collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* User profile & Collapse controls at bottom */}
        <div className="p-4 mt-auto transition-all duration-300">
          <div
            className={`overflow-hidden transition-all duration-300 ${collapsed ? 'max-h-0 opacity-0' : 'max-h-24 opacity-100'}`}
          >
            <div className="bg-slate-100 dark:bg-white/5 rounded-xl p-3">
              <div className="flex items-center gap-3">
                <span className={`grid size-9 place-items-center rounded-full ${avatarColor} text-xs font-bold text-white shrink-0 shadow-sm transition-colors`}>
                  {avatarInitials}
                </span>
                <div className="min-w-0 whitespace-nowrap overflow-hidden">
                  <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
                    {displayName}
                  </div>
                  <div className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">
                    {isGoogleLogin ? 'Verified Member' : 'Guest Member'}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div
            className={`overflow-hidden transition-all duration-300 ${collapsed ? 'max-h-16 opacity-100' : 'max-h-0 opacity-0'}`}
          >
            <span className={`w-12 h-12 mx-auto rounded-xl ${avatarColor} flex items-center justify-center text-white font-bold text-sm shadow-md transition-colors`}>
              {avatarInitials}
            </span>
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={`mt-3 flex items-center justify-center gap-2 rounded-xl text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all duration-300 ${collapsed ? 'w-12 h-12 mx-auto p-0' : 'w-full py-2'}`}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            <span
              className={`text-xs font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}
            >
              Collapse
            </span>
          </button>
        </div>
      </aside>
      <div
        className={
          collapsed
            ? 'lg:pl-20 transition-all duration-300'
            : 'lg:pl-64 transition-all duration-300'
        }
      >
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200/80 bg-white/80 px-5 backdrop-blur-xl dark:border-white/10 dark:bg-[#060913]/80 sm:px-8 transition-colors">
          <Link
            to="/workspaces"
            className="flex items-center justify-center size-9 rounded-xl bg-violet-600 text-white lg:hidden overflow-hidden shadow-sm"
          >
            <img src={appIcon} alt="Voxel" className="w-6 h-6 object-contain block dark:hidden" />
            <img src={appIconDark} alt="Voxel" className="w-6 h-6 object-contain hidden dark:block" />
          </Link>

          {/* Inline Dropdown Search Bar with ⌘K Badge */}
          <div className="relative w-full max-w-md hidden sm:block" ref={searchRef}>
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search Voxel resources..."
              aria-label="Search Voxel resources"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchDropdownOpen(true);
              }}
              onFocus={() => setSearchDropdownOpen(true)}
              className="w-full bg-slate-100/80 dark:bg-white/5 border border-transparent dark:border-white/5 rounded-xl pl-10 pr-12 py-2 text-xs focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/40 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center">
              <kbd className="inline-flex h-5 items-center justify-center gap-0.5 rounded-md border border-slate-200/90 dark:border-white/10 bg-white/90 dark:bg-white/10 px-1.5 font-mono text-[10px] font-bold text-slate-400 dark:text-slate-400 shadow-2xs select-none">
                <span className="text-[10px] leading-none inline-block font-sans font-extrabold">{formatCombo('meta+shift+f')}</span>
              </kbd>
            </div>

            {searchDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-full rounded-2xl border border-slate-200/90 bg-white/95 p-2 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0c111e]/95 z-50 overflow-hidden max-h-[min(70vh,34rem)] overflow-y-auto">
                {!normalizedSearch ? (
                  <div className="px-3 py-4">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Search across Voxel</p>
                    <p className="mt-1 text-[11px] text-slate-400">Find dashboards, widgets, templates, members, workspaces, and actions.</p>
                  </div>
                ) : (
                  <>
                    {filteredWorkspaces.length > 0 && <SearchResultSection title="Workspaces">
                      {filteredWorkspaces.slice(0, 6).map((workspace) => <SearchResultButton key={workspace.id} icon={Boxes} title={workspace.name} detail={workspace.description || 'Workspace'} onClick={() => { navigate(`/workspaces/${workspace.id}/dashboards`); setSearchDropdownOpen(false); }} />)}
                    </SearchResultSection>}
                    {filteredDashboards.length > 0 && <SearchResultSection title="Dashboards">
                      {filteredDashboards.slice(0, 8).map((dashboard) => <SearchResultButton key={dashboard.id} icon={PanelsTopLeft} title={dashboard.name} detail={dashboard.workspaceName} onClick={() => { navigate(`/workspaces/${dashboard.workspaceId}/dashboards/${dashboard.id}`); setSearchDropdownOpen(false); }} />)}
                    </SearchResultSection>}
                    {filteredWidgets.length > 0 && <SearchResultSection title="Widgets">
                      {filteredWidgets.map((widget) => <SearchResultButton key={`${widget.dashboardId}:${widget.id}`} icon={Puzzle} title={widget.title || widget.type || 'Untitled widget'} detail={`${widget.type || 'Widget'} · ${widget.dashboardName} · ${widget.workspaceName}`} onClick={() => { navigate(`/workspaces/${widget.workspaceId}/dashboards/${widget.dashboardId}`, { state: { focusNodeId: widget.id } }); setSearchDropdownOpen(false); }} />)}
                    </SearchResultSection>}
                    {filteredTemplates.length > 0 && <SearchResultSection title="Templates">
                      {filteredTemplates.map((template) => <SearchResultButton key={`${template.workspaceId}:${template.id}`} icon={Bookmark} title={template.name} detail={`${template.category || 'Template'} · ${template.workspaceName}`} onClick={() => { navigate(`/workspaces/${template.workspaceId}/dashboards`, { state: { showTemplates: true } }); setSearchDropdownOpen(false); }} />)}
                    </SearchResultSection>}
                    {filteredMembers.length > 0 && <SearchResultSection title="Members">
                      {filteredMembers.map((member) => <SearchResultButton key={`${member.workspaceId}:${member.id}`} icon={Users} title={member.user?.displayName || member.user?.email || 'Workspace member'} detail={`${member.workspaceName} · ${member.role.toLowerCase()}`} onClick={() => { navigate('/settings', { state: { settingsTab: 'workspace', workspaceId: member.workspaceId, memberSearch: member.user?.displayName || member.user?.email || '' } }); setSearchDropdownOpen(false); }} />)}
                    </SearchResultSection>}
                    {globalCommands.length > 0 && <SearchResultSection title="Actions">
                      {globalCommands.map((command) => <SearchResultButton key={command.id} icon={command.icon} title={command.label} onClick={command.run} />)}
                    </SearchResultSection>}
                    {filteredWorkspaces.length === 0 && filteredDashboards.length === 0 && filteredWidgets.length === 0 && filteredTemplates.length === 0 && filteredMembers.length === 0 && globalCommands.length === 0 && (
                      <p className="px-3 py-4 text-xs text-slate-400">
                        {workspaces.isPending || dashboardsQueries.isPending || (normalizedSearch.length > 1 && (templatesQueries.isFetching || membersQueries.isFetching)) ? 'Searching…' : `No results for “${searchQuery.trim()}”.`}
                      </p>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right side Controls matching Header.jsx */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Command Shortcut Cheatsheet Button */}
            <button
              aria-label="Open command palette"
              onClick={() => setCommandPaletteOpen(true)}
              className="grid size-10 rounded-xl place-items-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all duration-200 cursor-pointer"
            >
              <CommandIcon size={18} />
            </button>

            {/* Notifications Button */}
            <div className="relative" ref={notifRef}>
              <button
                aria-label="Notifications"
                onClick={() => {
                  const nextOpen = !notificationsOpen;
                  setNotificationsOpen(nextOpen);
                  if (nextOpen) void notificationQuery.refetch();
                }}
                className="relative grid size-10 rounded-xl place-items-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all duration-200 cursor-pointer"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 size-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 top-12 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0c111e]/95 z-50 origin-top animate-scale-in">
                  <div className="border-b border-slate-100 p-4 dark:border-white/5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-extrabold text-sm text-slate-950 dark:text-white tracking-tight">Notifications</h3>
                        <p className="mt-1 text-[10px] text-slate-500">{unreadCount} unread</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {unreadCount > 0 && <button type="button" onClick={() => markNotificationsRead.mutate()} disabled={markNotificationsRead.isPending} className="text-[9px] font-bold text-violet-600 hover:underline disabled:opacity-50 dark:text-violet-300">Mark all read</button>}
                        {notifications.length > 0 && notificationScope !== 'archived' && <button type="button" onClick={() => archiveNotifications.mutate()} disabled={archiveNotifications.isPending} className="text-[9px] font-bold text-slate-500 hover:text-slate-800 disabled:opacity-50 dark:hover:text-white">Archive all</button>}
                      </div>
                    </div>
                    <div className="mt-3 flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/5" role="tablist" aria-label="Filter notifications">
                      {[['all', 'All'], ['unread', 'Unread'], ['archived', 'Archived']].map(([scope, label]) => (
                        <button key={scope} type="button" role="tab" aria-selected={notificationScope === scope} onClick={() => setNotificationScope(scope)} className={`flex-1 rounded-lg px-2 py-1.5 text-[10px] font-bold transition ${notificationScope === scope ? 'bg-white text-violet-700 shadow-xs dark:bg-slate-800 dark:text-violet-300' : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'}`}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  {notificationQuery.isError ? (
                    <div role="status" className="p-6 text-center">
                      <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Notifications could not be loaded.</p>
                      <button type="button" onClick={() => void notificationQuery.refetch()} className="mt-2 text-[10px] font-bold text-violet-600 hover:underline dark:text-violet-300">Try again</button>
                    </div>
                  ) : notificationQuery.isPending ? (
                    <div className="flex items-center justify-center gap-2 p-8 text-xs text-slate-500"><LoaderCircle size={14} className="animate-spin" /> Loading notifications</div>
                  ) : notifications.length === 0 ? (
                    <div className="p-8 text-center">
                      <span className="mx-auto grid size-9 place-items-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300"><Bell size={16} /></span>
                      <p className="mt-3 text-xs font-bold text-slate-700 dark:text-slate-200">{notificationScope === 'archived' ? 'No archived notifications' : notificationScope === 'unread' ? 'You are all caught up' : 'No notifications yet'}</p>
                      <p className="mt-1 text-[10px] text-slate-400">Team updates will appear here.</p>
                    </div>
                  ) : (
                    <div className="max-h-[min(26rem,65vh)] overflow-y-auto p-2">
                      {notificationGroups.map(([group, items]) => (
                        <section key={group} aria-label={group}>
                          <h4 className="px-2 pb-1 pt-2 text-[9px] font-extrabold uppercase tracking-wider text-slate-400">{group}</h4>
                          <div className="space-y-1">
                            {items.map((notification) => (
                              <article key={notification.id} className={`group relative rounded-xl px-2.5 py-2.5 transition ${notification.read ? 'hover:bg-slate-50 dark:hover:bg-white/5' : 'bg-violet-50/70 hover:bg-violet-50 dark:bg-violet-500/[0.07] dark:hover:bg-violet-500/10'}`}>
                                <div className="flex items-start gap-2.5">
                                  <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${notification.read ? 'bg-slate-200 dark:bg-slate-700' : 'bg-violet-600 dark:bg-violet-400'}`} />
                                  <button type="button" onClick={() => openNotification(notification)} className="min-w-0 flex-1 text-left">
                                    <span className="block truncate text-[11px] font-bold text-slate-900 dark:text-slate-100">{notification.title}</span>
                                    <span className="mt-0.5 block text-[10px] leading-relaxed text-slate-600 dark:text-slate-300">{notification.message}</span>
                                    <time className="mt-1 block text-[9px] text-slate-400" dateTime={notification.createdAt}>{formatNotificationDate(notification.createdAt)}</time>
                                  </button>
                                  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                                    <button type="button" aria-label={notification.read ? 'Mark unread' : 'Mark read'} title={notification.read ? 'Mark unread' : 'Mark read'} onClick={() => updateNotification.mutate({ id: notification.id, read: !notification.read })} className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-violet-600 dark:hover:bg-white/10 dark:hover:text-violet-300">{notification.read ? <MailOpen size={12} /> : <Check size={12} />}</button>
                                    <button type="button" aria-label={notification.archivedAt ? 'Unarchive notification' : 'Archive notification'} title={notification.archivedAt ? 'Unarchive' : 'Archive'} onClick={() => updateNotification.mutate({ id: notification.id, archived: !notification.archivedAt })} className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-violet-600 dark:hover:bg-white/10 dark:hover:text-violet-300"><Archive size={12} /></button>
                                    <button type="button" aria-label="Delete notification" title="Delete" onClick={() => deleteNotification.mutate(notification.id)} className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"><Trash2 size={12} /></button>
                                  </div>
                                </div>
                              </article>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sun/Moon Theme Toggle */}
            <button
              aria-label="Toggle theme"
              onClick={handleThemeToggle}
              className="grid size-10 rounded-xl place-items-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all duration-200 cursor-pointer"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Profile Avatar dropdown */}
            <div className="flex items-center gap-2.5 relative" ref={userMenuRef}>
              <div className="text-right hidden md:block select-none leading-tight">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {displayName}
                </p>
                <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold opacity-70">
                  {isGoogleLogin ? 'Verified Member' : 'Guest Member'}
                </p>
              </div>

              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-1.5 rounded-full p-0.5 border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:scale-105 transition-all duration-200 cursor-pointer"
              >
                <span className={`grid size-8 place-items-center rounded-full ${avatarColor} text-xs font-bold text-white shadow-md transition-colors`}>
                  {avatarInitials}
                </span>
                <ChevronDown size={12} className="text-slate-400 mr-1" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-11 w-52 rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-[#0c111e]/95 z-50 animate-scale-in">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-white/5">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{displayName}</div>
                    <div className="text-[10px] text-slate-400 truncate">{email}</div>
                  </div>
                  <Link
                    to="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5 transition"
                  >
                    <User size={14} /> My Settings
                  </Link>
                  <button
                    onClick={handleLogoutClick}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 cursor-pointer transition"
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] p-5 sm:p-8">
          <Outlet />
        </main>
      </div>

      {/* Keyboard Shortcuts Palette Cheatsheet Modal */}
      {commandOpen && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm"
          onMouseDown={() => setCommandOpen(false)}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900"
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <Keyboard size={18} className="text-violet-500" /> Keyboard Shortcuts
              </h3>
              <button
                onClick={() => setCommandOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 text-slate-400"
              >
                <X size={16} />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { keys: ['⌘', 'K'], desc: 'Global search workspaces & settings' },
                { keys: ['⌘', '/'], desc: 'Toggle keyboard shortcuts menu' },
                { keys: ['N'], desc: 'Create a new item (workspace or dashboard)' },
                { keys: ['Esc'], desc: 'Close dialog overlays / Deselect nodes' },
                { keys: ['Backspace'], desc: 'Delete selected visual node in editor' },
                { keys: ['⌘', 'C'], desc: 'Copy selected node card' },
                { keys: ['⌘', 'V'], desc: 'Paste copied card to canvas' },
              ].map((shortcut, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 dark:text-slate-400">{shortcut.desc}</span>
                  <div className="flex gap-1">
                    {shortcut.keys.map((k, j) => (
                      <kbd
                        key={j}
                        className="inline-flex h-5 items-center justify-center px-2 rounded-md border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5 font-mono text-[10px] leading-none text-slate-600 dark:text-slate-300"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Command Palette */}
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} onLogout={handleLogoutClick} />

      {/* Guest Logout Warning Modal */}
      <CustomConfirmModal
        isOpen={showGuestLogoutModal}
        type="danger"
        title="Delete Guest Workspaces & Sign Out?"
        message="Warning: Logging out of your guest session will permanently delete all guest workspaces, dashboards, and custom canvas nodes created during this session. This action cannot be undone."
        confirmText="Delete All Data & Logout"
        cancelText="Cancel"
        onConfirm={async () => {
          setShowGuestLogoutModal(false);
          await logout();
        }}
        onCancel={() => setShowGuestLogoutModal(false)}
      />

      {/* Toast Notifications Queue */}
      <div className="fixed bottom-5 right-5 z-[150] space-y-2 pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={() => removeToast(toast.id)} />
        ))}
      </div>
    </div>
  );
}

function ToastItem({ toast, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [toast.duration, onClose]);

  return (
    <div
      className="pointer-events-auto w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-slate-900 flex items-start justify-between gap-3 animate-scale-in"
      style={{ animationDuration: '200ms' }}
    >
      <div className="flex-1 text-xs font-semibold text-slate-800 dark:text-slate-200">
        {toast.text}
      </div>
      <button
        onClick={onClose}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
      >
        <X size={12} />
      </button>
    </div>
  );
}
