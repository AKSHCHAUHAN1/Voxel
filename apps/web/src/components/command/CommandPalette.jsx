import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  ArrowRight,
  LayoutDashboard,
  Settings,
  Moon,
  Sun,
  LogOut,
  Plus,
  Command,
  Keyboard,
  Undo2,
  Redo2,
  Home,
  Layers,
} from 'lucide-react';
import { useThemeStore } from '@/store/theme-store';
import { workspaceService } from '@/features/workspaces/workspace-service';
import { authService } from '@/features/auth/auth-service';
import { getAllShortcuts, formatCombo } from '@/lib/keyboard';

/**
 * CommandPalette — ⌘K global command launcher.
 *
 * Provides fuzzy search across:
 * - Navigation (pages, workspaces, dashboards)
 * - Actions (create workspace, toggle theme, logout)
 * - Keyboard shortcuts reference
 */
export function CommandPalette({ open, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  // Fetch workspaces for navigation
  const workspaces = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspaceService.list,
    enabled: open,
    staleTime: 30_000,
  });

  // Build command list
  const commands = useMemo(() => {
    const items = [];

    // Navigation
    items.push({
      id: 'nav-home',
      label: 'Go to Home',
      category: 'Navigation',
      icon: Home,
      action: () => { navigate('/'); onClose(); },
    });
    items.push({
      id: 'nav-workspaces',
      label: 'Go to Workspaces',
      category: 'Navigation',
      icon: LayoutDashboard,
      action: () => { navigate('/workspaces'); onClose(); },
    });
    items.push({
      id: 'nav-settings',
      label: 'Go to Settings',
      category: 'Navigation',
      icon: Settings,
      action: () => { navigate('/settings'); onClose(); },
    });

    // Dynamic workspace entries
    if (workspaces.data && Array.isArray(workspaces.data)) {
      workspaces.data.forEach((ws) => {
        items.push({
          id: `ws-${ws.id}`,
          label: `Open workspace: ${ws.name}`,
          category: 'Workspaces',
          icon: Layers,
          action: () => { navigate(`/workspaces/${ws.id}/dashboards`); onClose(); },
        });
      });
    }

    // Actions
    items.push({
      id: 'action-new-workspace',
      label: 'Create new workspace',
      category: 'Actions',
      icon: Plus,
      action: () => { navigate('/workspaces'); onClose(); },
    });
    items.push({
      id: 'action-theme',
      label: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      category: 'Actions',
      icon: theme === 'dark' ? Sun : Moon,
      action: () => { setTheme(theme === 'dark' ? 'light' : 'dark'); onClose(); },
    });
    items.push({
      id: 'action-logout',
      label: 'Sign out',
      category: 'Actions',
      icon: LogOut,
      action: async () => { await authService.logout(); navigate('/login'); onClose(); },
    });

    // Keyboard shortcuts reference
    const shortcuts = getAllShortcuts();
    shortcuts.forEach((sc) => {
      items.push({
        id: `shortcut-${sc.combo}`,
        label: sc.label,
        category: 'Shortcuts',
        icon: Keyboard,
        suffix: formatCombo(sc.combo),
        action: () => { sc.handler(); onClose(); },
      });
    });

    return items;
  }, [workspaces.data, theme, navigate, onClose, setTheme]);

  // Fuzzy filter
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const q = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(q) ||
        cmd.category.toLowerCase().includes(q),
    );
  }, [commands, query]);

  // Reset selection when query or list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, filtered.length]);

  // Auto-focus input
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Scroll selected into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex];
    if (item) item.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[selectedIndex]) filtered[selectedIndex].action();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  // Group by category for display
  const groups = {};
  filtered.forEach((cmd) => {
    if (!groups[cmd.category]) groups[cmd.category] = [];
    groups[cmd.category].push(cmd);
  });
  const groupEntries = Object.entries(groups);

  // Flatten for index mapping
  let flatIndex = 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
      onMouseDown={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" />

      {/* Palette */}
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl dark:border-white/10 dark:bg-slate-900 animate-scale-in"
        style={{ animationDuration: '150ms' }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 dark:border-white/5">
          <Search size={16} className="shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search…"
            className="flex-1 bg-transparent py-3.5 text-sm outline-none placeholder:text-slate-400 dark:text-white"
          />
          <kbd className="hidden rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 sm:block dark:border-white/10 dark:bg-white/5">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto overscroll-contain p-1.5">
          {filtered.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-slate-400">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
          {groupEntries.map(([category, items]) => (
            <div key={category}>
              <div className="px-3 pb-1 pt-2.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {category}
              </div>
              {items.map((cmd) => {
                const thisIndex = flatIndex++;
                const isSelected = thisIndex === selectedIndex;
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    onClick={() => cmd.action()}
                    onMouseEnter={() => setSelectedIndex(thisIndex)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      isSelected
                        ? 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-300'
                        : 'text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5'
                    }`}
                  >
                    <Icon size={15} className="shrink-0 opacity-60" />
                    <span className="flex-1 truncate">{cmd.label}</span>
                    {cmd.suffix && (
                      <kbd className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 dark:border-white/10 dark:bg-white/5">
                        {cmd.suffix}
                      </kbd>
                    )}
                    {isSelected && <ArrowRight size={13} className="shrink-0 opacity-40" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-[10px] text-slate-400 dark:border-white/5">
          <div className="flex items-center gap-2">
            <Command size={11} />
            <span>Voxel Command Palette</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[9px] dark:border-white/10 dark:bg-white/5">↑↓</kbd>
            <span>navigate</span>
            <kbd className="ml-1 rounded border border-slate-200 bg-slate-50 px-1 py-0.5 text-[9px] dark:border-white/10 dark:bg-white/5">↵</kbd>
            <span>select</span>
          </div>
        </div>
      </div>
    </div>
  );
}
