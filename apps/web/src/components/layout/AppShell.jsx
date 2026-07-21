import { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import appIcon from '@/assets/app-icon.png';
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
} from 'lucide-react';
import { authService } from '@/features/auth/auth-service';
import { useThemeStore } from '@/store/theme-store';
import { workspaceService } from '@/features/workspaces/workspace-service';
import { CommandPalette } from '@/components/command/CommandPalette';
import { attachGlobalShortcuts, detachGlobalShortcuts, useShortcut } from '@/lib/keyboard';
import { useNotificationStore } from '@/store/notification-store';

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Theme state and bubble animation state
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const [bubble, setBubble] = useState(null);

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const searchRef = useRef(null);
  const searchInputRef = useRef(null);
  const notifRef = useRef(null);

  const notifications = useNotificationStore((s) => s.notifications);
  const dismiss = useNotificationStore((s) => s.dismiss);
  const markAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const clearAll = useNotificationStore((s) => s.clearAll);
  const addNotification = useNotificationStore((s) => s.add);
  const toasts = useNotificationStore((s) => s.toasts);
  const removeToast = useNotificationStore((s) => s.removeToast);

  // Simulate mock-live notifications periodically
  useEffect(() => {
    const mockMessages = [
      { text: 'Core Postgres scaling sequence completed.', type: 'success' },
      { text: 'Alice Vance updated the Operations Center layout.', type: 'info' },
      { text: 'System check verified 100% operational relay.', type: 'success' },
      { text: 'New login detected from Safari (macOS).', type: 'warning' },
    ];
    const interval = setInterval(() => {
      if (Math.random() < 0.25) {
        const selected = mockMessages[Math.floor(Math.random() * mockMessages.length)];
        addNotification(selected.text, selected.type);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [addNotification]);

  // Fetch current user details
  const userQuery = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authService.me,
    retry: false,
  });

  const user = userQuery.data;
  const isGoogleLogin = user && user.email !== 'guest@voxel.com';
  const displayName = user?.displayName || 'Guest User';
  const email = user?.email || 'guest@voxel.com';
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

  const logout = async () => {
    await authService.logout();
    queryClient.clear();
    navigate('/');
  };

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

  useShortcut('meta+/', () => setCommandOpen((prev) => !prev), {
    label: 'Toggle keyboard shortcuts menu',
    category: 'General',
    allowInInput: true,
  });

  // Close search dropdown and notifications outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (notificationsOpen) {
      markAllAsRead();
    }
  }, [notificationsOpen, markAllAsRead]);

  // Theme switch bubble transition effect
  const handleThemeToggle = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    const color = nextTheme === 'dark' ? '#020617' : '#f8fafc'; // background color of target theme

    setBubble({ x, y, active: false, color });
    // Trigger expansion
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setBubble((prev) => (prev ? { ...prev, active: true } : null));
      });
    });

    // Toggle theme at the peak of transition
    setTimeout(() => {
      setTheme(nextTheme);
    }, 450);

    // Clean up bubble element
    setTimeout(() => {
      setBubble(null);
    }, 750);
  };

  // Fetch dashboards for search index
  const dashboardsQueries = useQuery({
    queryKey: ['all-dashboards', workspaces.data?.map(w => w.id)],
    queryFn: async () => {
      if (!workspaces.data) return [];
      const all = [];
      for (const ws of workspaces.data) {
        try {
          const res = await workspaceService.dashboards(ws.id);
          if (res && res.data) {
            all.push(...res.data.map(d => ({ ...d, workspaceName: ws.name })));
          }
        } catch (e) {
          // ignore
        }
      }
      return all;
    },
    enabled: Boolean(workspaces.data),
    staleTime: 60_000,
  });

  const filteredDashboards = dashboardsQueries.data
    ? dashboardsQueries.data.filter((d) => d.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const filteredWorkspaces = workspaces.data
    ? workspaces.data.filter((ws) => ws.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div
      className="min-h-screen bg-slate-50 text-slate-900 dark:bg-[#060913] dark:text-slate-100 transition-colors duration-300"
    >
      {/* Expanding Transition Bubble */}
      {bubble && (
        <div
          className="fixed pointer-events-none rounded-full z-[9999] -translate-x-1/2 -translate-y-1/2 transition-transform duration-700 ease-out"
          style={{
            left: bubble.x,
            top: bubble.y,
            width: '250vmax',
            height: '250vmax',
            backgroundColor: bubble.color,
            transform: `translate(-50%, -50%) scale(${bubble.active ? 1 : 0})`,
          }}
        />
      )}

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
              <img src={appIcon} alt="Voxel" className="w-10 h-10 object-contain" />
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
                <span className="grid size-9 place-items-center rounded-full bg-violet-600 text-xs font-bold text-white shrink-0">
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
            <span className="w-12 h-12 mx-auto rounded-xl bg-violet-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
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
        <header className="sticky top-0 z-40 flex h-20 items-center justify-between border-b border-slate-200 bg-slate-50/70 px-5 backdrop-blur-md dark:border-white/10 dark:bg-slate-950/70 sm:px-8">
          <Link
            to="/workspaces"
            className="flex items-center justify-center size-9 rounded-xl bg-violet-600 text-white lg:hidden overflow-hidden"
          >
            <img src={appIcon} alt="Voxel" className="w-6 h-6 object-contain" />
          </Link>

          {/* Inline Dropdown Search Bar */}
          <div className="relative w-full max-w-md" ref={searchRef}>
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search workspaces or settings..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSearchDropdownOpen(true);
              }}
              onFocus={() => setSearchDropdownOpen(true)}
              className="w-full bg-slate-100 dark:bg-white/5 border-none rounded-full pl-12 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-violet-500/40 focus:bg-white dark:focus:bg-slate-900 transition-all text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none"
            />

            {searchDropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl dark:border-white/10 dark:bg-slate-900 z-50 overflow-hidden max-h-80 overflow-y-auto">
                <p className="text-[10px] font-bold text-slate-400 px-3 py-1 uppercase tracking-wider">
                  Workspaces
                </p>
                {filteredWorkspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => {
                      navigate(`/workspaces/${ws.id}/dashboards`);
                      setSearchDropdownOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 rounded-xl text-left text-xs hover:bg-violet-50 dark:hover:bg-violet-500/10 transition"
                  >
                    <Boxes size={15} className="text-violet-500" />
                    <div>
                      <div className="font-semibold">{ws.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {ws.description || 'View dashboards'}
                      </div>
                    </div>
                  </button>
                ))}
                {filteredWorkspaces.length === 0 && (
                  <p className="text-xs text-slate-400 py-2 px-3">
                    No workspaces match your query.
                  </p>
                )}
                <p className="text-[10px] font-bold text-slate-400 px-3 py-1 uppercase tracking-wider mt-2">
                  Dashboards
                </p>
                {filteredDashboards.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => {
                      navigate(`/workspaces/${d.workspaceId}/dashboards/${d.id}`);
                      setSearchDropdownOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 rounded-xl text-left text-xs hover:bg-violet-50 dark:hover:bg-violet-500/10 transition"
                  >
                    <PanelsTopLeft size={15} className="text-violet-500" />
                    <div>
                      <div className="font-semibold">{d.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {d.workspaceName}
                      </div>
                    </div>
                  </button>
                ))}
                {filteredDashboards.length === 0 && (
                  <p className="text-xs text-slate-400 py-2 px-3">
                    No dashboards match your query.
                  </p>
                )}
                <p className="text-[10px] font-bold text-slate-400 px-3 py-1 uppercase tracking-wider mt-2">
                  Settings Shortcuts
                </p>
                {[
                  { label: 'Profile preferences', path: '/settings' },
                  { label: 'Workspace members & collaboration', path: '/settings' },
                  { label: 'Appearance & theme mode', path: '/settings' },
                ].map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      navigate(opt.path);
                      setSearchDropdownOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 rounded-xl text-left text-xs hover:bg-violet-50 dark:hover:bg-violet-500/10 transition"
                  >
                    <Settings size={15} className="text-slate-400" />
                    <span className="font-semibold">{opt.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right side Controls matching Header.jsx */}
          <div className="flex items-center gap-4 flex-shrink-0">
            {/* Command Shortcut Cheatsheet Button */}
            <button
              aria-label="Open command palette"
              onClick={() => setCommandOpen(true)}
              className="grid size-11 rounded-xl place-items-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all duration-300"
            >
              <CommandIcon size={20} />
            </button>

            {/* Notifications Button */}
            <div className="relative" ref={notifRef}>
              <button
                aria-label="Notifications"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative grid size-11 rounded-xl place-items-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all duration-300"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-2.5 right-2.5 size-2 rounded-full bg-rose-500 animate-pulse" />
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 top-14 w-80 rounded-2xl border border-slate-200 bg-white p-0 shadow-dramatic dark:border-white/10 dark:bg-slate-900 z-50 origin-top animate-scale-in">
                  <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between">
                    <h3 className="font-extrabold text-sm text-slate-950 dark:text-white tracking-tight">
                      Notifications
                    </h3>
                     {notifications.length > 0 && (
                      <button
                        onClick={() => clearAll()}
                        className="uppercase font-bold text-slate-400 dark:text-slate-500 hover:text-rose-500 transition-colors"
                        style={{ fontSize: '8px', letterSpacing: '0.15em' }}
                      >
                        CLEAR ALL
                      </button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.map((notif, i) => (
                      <div
                        key={notif.id}
                        className="relative group p-4 flex items-start gap-3.5 bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors cursor-pointer"
                      >
                        <div
                          className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${notif.read ? 'bg-slate-200 dark:bg-slate-800' : 'bg-violet-600 dark:bg-violet-400 shadow-[0_0_8px_rgba(124,58,237,0.5)] animate-pulse'}`}
                        />
                        <div className="flex-1 min-w-0 pr-6">
                          <p
                            className={`text-xs text-slate-900 dark:text-slate-100 leading-snug font-semibold`}
                          >
                            {notif.text}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 font-bold">
                            {notif.time}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dismiss(notif.id);
                          }}
                          className="absolute right-4 top-4 text-slate-400 hover:text-rose-500 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-50 dark:hover:bg-rose-500/10 shrink-0"
                          title="Dismiss"
                        >
                          <X size={12} />
                        </button>
                        {i < notifications.length - 1 && (
                          <div className="h-px w-full absolute bottom-0 left-0 bg-gradient-to-r from-transparent via-slate-100 dark:via-white/5 to-transparent opacity-60 z-0" />
                        )}
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          All caught up
                        </p>
                        <p className="text-[10px] text-slate-400">You have no new notifications.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Sun/Moon Theme Toggle */}
            <button
              aria-label="Toggle theme"
              onClick={handleThemeToggle}
              className="grid size-11 rounded-xl place-items-center text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 transition-all duration-300"
            >
              {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* Profile Avatar VX dropdown area */}
            <div className="flex items-center gap-3 relative">
              <div className="text-right hidden md:block select-none leading-snug">
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {displayName}
                </p>
                {isGoogleLogin && (
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold opacity-70">
                    Verified User
                  </p>
                )}
              </div>

              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-1.5 rounded-full p-1 border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:scale-105 transition-all duration-300"
              >
                <span className="grid size-8 place-items-center rounded-full bg-violet-600 text-xs font-bold text-white shadow-md">
                  {avatarInitials}
                </span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-12 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-slate-900 z-50">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-white/5">
                    <div className="text-xs font-semibold">{displayName}</div>
                    <div className="text-[10px] text-slate-400">{email}</div>
                  </div>
                  <Link
                    to="/settings"
                    onClick={() => setMenuOpen(false)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/5"
                  >
                    <User size={15} /> My Settings
                  </Link>
                  <button
                    onClick={() => void logout()}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                  >
                    <LogOut size={15} /> Sign out
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
                        className="px-2 py-0.5 rounded border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-white/5 font-mono text-[10px]"
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
      <CommandPalette open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />

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
