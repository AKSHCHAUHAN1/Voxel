import { useState, useEffect, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  Home,
  Layers,
  Users,
} from 'lucide-react';
import { useThemeStore, useEffectiveTheme } from '@/store/theme-store';
import { useNotificationStore } from '@/store/notification-store';
import { workspaceService } from '@/features/workspaces/workspace-service';
import { authService } from '@/features/auth/auth-service';
import { getAllShortcuts, formatCombo } from '@/lib/keyboard';

const RECENT_PAGES_KEY = 'voxel-recent-pages';
const RECENT_PAGE_PATH = /^\/(?:settings|workspaces(?:\/[0-9a-f-]+(?:\/dashboards(?:\/[0-9a-f-]+)?)?)?)$/i;
const EMPTY_LIST = [];

function readRecentPages(userId) {
  try {
    const key = `${RECENT_PAGES_KEY}:${userId || 'anonymous'}`;
    const pages = JSON.parse(window.localStorage.getItem(key) || '[]');
    return Array.isArray(pages)
      ? pages.filter((page) => page && RECENT_PAGE_PATH.test(page.path) && typeof page.label === 'string').slice(0, 8)
      : [];
  } catch (_error) {
    return [];
  }
}

function getPageLabel(path, workspaces, currentDashboard) {
  if (path === '/settings') return { label: 'Open Settings', category: 'Navigation' };
  if (path === '/workspaces') return { label: 'Open Workspaces', category: 'Navigation' };

  const match = path.match(/^\/workspaces\/([0-9a-f-]+)\/dashboards(?:\/([0-9a-f-]+))?$/i);
  if (!match) return null;

  const [, workspaceId, dashboardId] = match;
  if (!workspaces.some((workspace) => workspace.id === workspaceId)) return null;
  if (dashboardId) {
    return currentDashboard?.id === dashboardId && currentDashboard.workspaceId === workspaceId
      ? { label: `Open dashboard: ${currentDashboard.name}`, category: 'Dashboards' }
      : null;
  }

  const workspace = workspaces.find((item) => item.id === workspaceId);
  return workspace
    ? { label: `Open workspace: ${workspace.name}`, category: 'Workspaces' }
    : null;
}

/**
 * CommandPalette — ⌘K global command launcher.
 *
 * Searches navigation, workspaces, dashboards, widgets, templates, members,
 * actions, recent pages, and the keyboard shortcut reference.
 */
export function CommandPalette({ open, onClose, onLogout, userId }) {
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [recentPagesState, setRecentPagesState] = useState(() => ({ userId, pages: readRecentPages(userId) }));
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useEffectiveTheme();
  const setTheme = useThemeStore((s) => s.setTheme);

  // Fetch workspaces for navigation
  const workspaces = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspaceService.list,
    enabled: open,
    staleTime: 30_000,
  });
  const normalizedQuery = query.trim().toLowerCase();
  const currentDashboardId = location.pathname.match(/^\/workspaces\/[0-9a-f-]+\/dashboards\/([0-9a-f-]+)$/i)?.[1];
  const currentDashboard = useQuery({
    queryKey: ['dashboard', currentDashboardId],
    queryFn: () => workspaceService.dashboard(currentDashboardId),
    enabled: open && Boolean(currentDashboardId),
    staleTime: 60_000,
  });
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(normalizedQuery), 220);
    return () => window.clearTimeout(timeout);
  }, [normalizedQuery]);
  const search = useQuery({
    queryKey: ['global-search', userId, debouncedQuery],
    queryFn: () => workspaceService.search(debouncedQuery),
    enabled: open && Boolean(userId) && debouncedQuery === normalizedQuery && debouncedQuery.length > 1,
    staleTime: 15_000,
  });
  const searchResults = debouncedQuery === normalizedQuery && search.data?.query === debouncedQuery
    ? search.data
    : null;
  const workspacesList = workspaces.data || EMPTY_LIST;
  const recentPages = recentPagesState.userId === userId ? recentPagesState.pages : readRecentPages(userId);
  const availableRecentPages = useMemo(() => workspaces.data
    ? recentPages.filter((page) => {
      const match = page.path.match(/^\/workspaces\/([0-9a-f-]+)\//i);
      return !match || workspacesList.some((workspace) => workspace.id === match[1]);
    })
    : recentPages, [recentPages, workspaces.data, workspacesList]);

  useEffect(() => {
    const currentPage = getPageLabel(location.pathname, workspacesList, currentDashboard.data);
    if (!currentPage) return;

    setRecentPagesState((previousState) => {
      const previous = previousState.userId === userId ? previousState.pages : readRecentPages(userId);
      const next = [
        { path: location.pathname, ...currentPage },
        ...previous.filter((page) => page.path !== location.pathname),
      ].slice(0, 8);
      try {
        window.localStorage.setItem(`${RECENT_PAGES_KEY}:${userId || 'anonymous'}`, JSON.stringify(next));
      } catch (_error) {
        // Recent navigation is a convenience; storage may be unavailable in private browsing.
      }
      return { userId, pages: next };
    });
  }, [location.pathname, workspacesList, currentDashboard.data, userId]);

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
    // Recently opened destinations
    availableRecentPages.forEach((page) => {
      items.push({
        id: `recent-${page.path}`,
        label: page.label,
        category: 'Recently Opened',
        icon: page.path === '/settings' ? Settings : page.category === 'Dashboards' ? LayoutDashboard : Layers,
        action: () => { navigate(page.path); onClose(); },
      });
    });

    // Search results are loaded for the current query; the palette does not download every dashboard scene.
    if (searchResults) {
      searchResults.dashboards.forEach((dashboard) => {
        items.push({
          id: `dashboard-${dashboard.id}`,
          label: `Open dashboard: ${dashboard.name}`,
          category: 'Dashboards',
          icon: LayoutDashboard,
          suffix: dashboard.workspaceName,
          action: () => { navigate(`/workspaces/${dashboard.workspaceId}/dashboards/${dashboard.id}`); onClose(); },
        });
      });
      searchResults.widgets.forEach((widget) => {
        items.push({
          id: `widget-${widget.dashboardId}-${widget.id}`,
          label: `Open widget: ${widget.title || widget.type || 'Untitled widget'}`,
          category: 'Widgets',
          icon: Layers,
          suffix: `${widget.dashboardName} · ${widget.workspaceName}`,
          action: () => {
            navigate(`/workspaces/${widget.workspaceId}/dashboards/${widget.dashboardId}`, { state: { focusNodeId: widget.id } });
            onClose();
          },
        });
      });
      searchResults.templates.forEach((template) => {
        items.push({
          id: `template-${template.workspaceId}-${template.id}`,
          label: `Open template: ${template.name}`,
          category: 'Templates',
          icon: Layers,
          suffix: template.workspaceName,
          action: () => {
            navigate(`/workspaces/${template.workspaceId}/dashboards`, { state: { showTemplates: true } });
            onClose();
          },
        });
      });
      searchResults.members.forEach((member) => {
        const memberName = member.user?.displayName || member.user?.email || 'Workspace member';
        items.push({
          id: `member-${member.workspaceId}-${member.id}`,
          label: `Open member: ${memberName}`,
          category: 'Members',
          icon: Users,
          suffix: member.workspaceName,
          action: () => {
            navigate('/settings', { state: { settingsTab: 'workspace', workspaceId: member.workspaceId, memberSearch: memberName } });
            onClose();
          },
        });
      });
    }

    // Actions
    items.push({
      id: 'action-new-workspace',
      label: 'Create new workspace',
      category: 'Actions',
      icon: Plus,
      action: () => { navigate('/workspaces', { state: { openCreateWorkspace: true } }); onClose(); },
    });
    workspacesList.filter((workspace) => ['OWNER', 'ADMIN', 'EDITOR'].includes(workspace.role)).forEach((workspace) => {
      items.push({
        id: `action-create-dashboard-${workspace.id}`,
        label: `Create dashboard in ${workspace.name}`,
        category: 'Actions',
        icon: Plus,
        action: () => {
          navigate(`/workspaces/${workspace.id}/dashboards`, { state: { openCreateDashboard: true } });
          onClose();
        },
      });
    });
    workspacesList.filter((workspace) => ['OWNER', 'ADMIN'].includes(workspace.role)).forEach((workspace) => {
      items.push({
        id: `action-invite-member-${workspace.id}`,
        label: `Invite member to ${workspace.name}`,
        category: 'Actions',
        icon: Users,
        action: () => {
          navigate('/settings', { state: { settingsTab: 'workspace', workspaceId: workspace.id, openInvite: true } });
          onClose();
        },
      });
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
      action: async () => {
        onClose();
        if (onLogout) {
          onLogout();
        } else {
          useNotificationStore.getState().clearAll();
          await authService.logout();
          navigate('/login');
        }
      },
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
  }, [workspacesList, availableRecentPages, searchResults, theme, navigate, onClose, setTheme]);

  // Fuzzy filter
  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    return commands.filter((cmd) => {
      const searchableText = `${cmd.label} ${cmd.category} ${cmd.suffix || ''}`.toLowerCase();
      return tokens.every((token) => searchableText.includes(token));
    });
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

  const searching = normalizedQuery.length > 1 && (debouncedQuery !== normalizedQuery || search.isFetching);

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
            className="flex-1 bg-transparent py-3.5 text-sm outline-none placeholder:text-slate-400 text-slate-900 dark:text-white"
          />
          <kbd className="hidden rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 sm:block dark:border-white/10 dark:bg-white/5">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto overscroll-contain p-1.5">
          {filtered.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-slate-400">
              {searching ? 'Searching…' : search.isError ? (
                <button type="button" onClick={() => search.refetch()} className="font-semibold text-rose-600 dark:text-rose-300">
                  Search is unavailable. Try again.
                </button>
              ) : `No results for “${query}”`}
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
