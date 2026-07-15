import { useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Boxes,
  ChevronDown,
  Command,
  LogOut,
  Moon,
  PanelsTopLeft,
  Search,
  Settings,
  Sun,
} from 'lucide-react';
import { authService } from '@/features/auth/auth-service';
import { useThemeStore } from '@/store/theme-store';

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const logout = async (): Promise<void> => {
    await authService.logout();
    queryClient.clear();
    navigate('/login');
  };
  return (
    <div
      className={
        theme === 'dark'
          ? 'dark min-h-screen bg-slate-950 text-slate-100'
          : 'min-h-screen bg-slate-50 text-slate-900'
      }
    >
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
          to="/workspaces"
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
        <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-slate-200 bg-slate-50/85 px-5 backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/85 sm:px-8">
          <Link
            to="/workspaces"
            className="grid size-9 place-items-center rounded-xl bg-violet-600 text-white lg:hidden"
          >
            <Boxes size={17} />
          </Link>
          <button className="ml-auto hidden items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-sm dark:border-white/10 dark:bg-white/5 sm:flex">
            <Search size={16} /> Search <kbd className="ml-8 text-[10px]">⌘ K</kbd>
          </button>
          <button
            aria-label="Toggle theme"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/10"
          >
            {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <button
            aria-label="Open command palette"
            className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/10"
          >
            <Command size={17} />
          </button>
          <button
            aria-label="Notifications"
            className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-white/10"
          >
            <Bell size={17} />
          </button>
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-200 dark:hover:bg-white/10"
            >
              <span className="grid size-7 place-items-center rounded-full bg-violet-600 text-[10px] font-bold text-white">
                VX
              </span>
              <ChevronDown size={14} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-11 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-xl dark:border-white/10 dark:bg-slate-900">
                <button
                  onClick={() => void logout()}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                >
                  <LogOut size={15} /> Sign out
                </button>
              </div>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-[1600px] p-5 sm:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
