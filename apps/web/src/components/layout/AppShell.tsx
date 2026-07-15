import { useState, useEffect, useRef } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import {
  Bell,
  Boxes,
  ChevronDown,
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

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchDropdownOpen, setSearchDropdownOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Theme state and bubble animation state
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const [bubble, setBubble] = useState<{ x: number; y: number; active: boolean; color: string } | null>(null);

  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Seeded notifications
  const [notifications, setNotifications] = useState([
    { id: 1, text: '🟢 Database service fully connected to Postgres', read: false },
    { id: 2, text: '🛠️ Guest user credentials successfully initialized', read: false },
    { id: 3, text: '🔒 Google OAuth callback proxy verified', read: false },
  ]);

  // Fetch workspaces list for search lookup
  const workspaces = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspaceService.list,
  });

  const logout = async (): Promise<void> => {
    await authService.logout();
    queryClient.clear();
    navigate('/');
  };

  // Keyboard shortcut listener (Cmd+K and Cmd+/)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchDropdownOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close search dropdown and notifications outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Theme switch bubble transition effect
  const handleThemeToggle = (e: React.MouseEvent<HTMLButtonElement>) => {
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

  const filteredWorkspaces = workspaces.data
    ? workspaces.data.filter((ws) =>
        ws.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div
      className={
        theme === 'dark'
          ? 'dark min-h-screen bg-slate-950 text-slate-100'
          : 'min-h-screen bg-slate-50 text-slate-900'
      }
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

      <aside className="fixed inset-y-0 left-0 z-20 hidden w-72 border-r border-slate-200 bg-white p-5 dark:border-white/10 dark:bg-slate-950 lg:flex lg:flex-col">
        <Link
          to="/workspaces"
          className="flex items-center gap-3 px-2 text-lg font-semibold tracking-tight"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-500/20">
            <Boxes size={18} />
          </span>{' '}
          Voxel
        </Link>
        <Link
          to="/workspaces"
          className="mt-10 flex items-center gap-3 rounded-xl bg-violet-50 px-3 py-2.5 text-sm font-semibold text-violet-700 dark:bg-violet-500/15 dark:text-violet-200"
        >
          <PanelsTopLeft size={18} /> Workspaces
        </Link>
        <Link
          to="/settings"
          className="mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/5"
        >
          <Settings size={18} /> Settings
        </Link>
        <div className="mt-auto rounded-2xl border border-violet-100 bg-violet-50 p-4 text-xs text-violet-900 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-100">
          <b>Secure workspace</b>
          <p className="mt-1.5 leading-5 text-violet-700 dark:text-violet-200">
            Your canvas is encrypted in transit and protected by role-based access.
          </p>
        </div>
      </aside>
      <div className="lg:pl-72">
        <header className="sticky top-0 z-40 flex h-20 items-center justify-between border-b border-slate-200 bg-slate-50/70 px-5 backdrop-blur-md dark:border-white/10 dark:bg-slate-950/70 sm:px-8">
          <Link
            to="/workspaces"
            className="grid size-9 place-items-center rounded-xl bg-violet-600 text-white lg:hidden"
          >
            <Boxes size={17} />
          </Link>

          {/* Inline Dropdown Search Bar */}
          <div className="relative w-full max-w-md" ref={searchRef}>
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
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
                <p className="text-[10px] font-bold text-slate-400 px-3 py-1 uppercase tracking-wider">Workspaces</p>
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
                      <div className="text-[10px] text-slate-400">{ws.description || 'View dashboards'}</div>
                    </div>
                  </button>
                ))}
                {filteredWorkspaces.length === 0 && (
                  <p className="text-xs text-slate-400 py-2 px-3">No workspaces match your query.</p>
                )}

                <p className="text-[10px] font-bold text-slate-400 px-3 py-1 uppercase tracking-wider mt-2">Settings Shortcuts</p>
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
                <div className="absolute right-0 top-14 w-80 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-white/10 dark:bg-slate-900 z-50 origin-top animate-scale-in">
                  <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-white/5">
                    <h3 className="text-xs font-semibold">Notifications</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={() =>
                          setNotifications(notifications.map((n) => ({ ...n, read: true })))
                        }
                        className="text-[10px] text-violet-500 hover:underline"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`text-xs p-2 rounded-xl transition ${
                          n.read ? 'text-slate-400' : 'bg-violet-50/50 dark:bg-violet-500/5 font-medium'
                        }`}
                      >
                        {n.text}
                      </div>
                    ))}
                    {notifications.length === 0 && (
                      <p className="text-xs text-slate-400 py-4 text-center">No new notifications.</p>
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
                <p className="text-xs font-bold text-slate-800 dark:text-slate-200">Guest User</p>
                <p className="text-[9px] text-slate-400 uppercase tracking-wider font-semibold opacity-70">Verified User</p>
              </div>

              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-1.5 rounded-full p-1 border border-slate-200/60 dark:border-white/10 bg-slate-50 dark:bg-white/5 hover:scale-105 transition-all duration-300"
              >
                <span className="grid size-8 place-items-center rounded-full bg-violet-600 text-xs font-bold text-white shadow-md">
                  GU
                </span>
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-12 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-slate-900 z-50">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-white/5">
                    <div className="text-xs font-semibold">Guest User</div>
                    <div className="text-[10px] text-slate-400">guest@voxel.com</div>
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
    </div>
  );
}
