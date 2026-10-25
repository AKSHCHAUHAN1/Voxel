import { useState, useMemo, useEffect, useRef } from 'react';
import {
  User,
  Users,
  Palette,
  Shield,
  Bell,
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
  Lock,
  UserCheck,
  Upload,
  Loader2,
  Puzzle,
  Search,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeStore } from '@/store/theme-store';
import { useNotificationStore } from '@/store/notification-store';
import { useSettingsStore } from '@/store/settings-store';
import { useHistoryStore } from '@/store/history-store';
import { getDeviceOSString } from '@/utils/device-info';
import { authService } from '@/features/auth/auth-service';
import { workspaceService } from '@/features/workspaces/workspace-service';
import { TwoFactorSettingsCard } from './TwoFactorSettingsCard';

const LANGUAGES = [
  'English (US)',
  'English (UK)',
  'Spanish (Español)',
  'French (Français)',
  'German (Deutsch)',
  'Japanese (日本語)',
  'Chinese Simplified (简体中文)',
  'Chinese Traditional (繁體中文)',
  'Hindi (हिन्दी)',
  'Portuguese (Português - Brasil)',
  'Portuguese (Português - Portugal)',
  'Arabic (العربية)',
  'Korean (한국어)',
  'Italian (Italiano)',
  'Russian (Русский)',
  'Dutch (Nederlands)',
  'Turkish (Türkçe)',
  'Polish (Polski)',
  'Swedish (Svenska)',
  'Indonesian (Bahasa Indonesia)',
  'Vietnamese (Tiếng Việt)',
  'Hebrew (עברית)',
  'Thai (ไทย)',
];

const JOB_ROLES = [
  'Product Engineer',
  'Software Engineer / Developer',
  'Frontend Engineer',
  'Backend Engineer',
  'Full Stack Developer',
  'DevOps / SRE / Platform Engineer',
  'Data Scientist / AI / ML Engineer',
  'Product Designer / UI/UX',
  'Product Manager',
  'Engineering Manager / Tech Lead',
  'Founder / Executive / CTO',
  'Solutions Architect',
  'Business / Operations Analyst',
  'Student / Researcher',
  'Other',
];

const TIMEZONES = [
  { id: 'Pacific/Honolulu', offset: -600, label: 'Hawaii (Honolulu)' },
  { id: 'America/Anchorage', offset: -540, label: 'Alaska (Anchorage)' },
  { id: 'America/Los_Angeles', offset: -480, label: 'Pacific Time (US & Canada - Los Angeles, SF, Vancouver)' },
  { id: 'America/Denver', offset: -420, label: 'Mountain Time (Denver, Phoenix, Calgary, Salt Lake)' },
  { id: 'America/Chicago', offset: -360, label: 'Central Time (Chicago, Dallas, Mexico City, Austin)' },
  { id: 'America/New_York', offset: -300, label: 'Eastern Time (New York, Toronto, Miami, Boston)' },
  { id: 'America/Halifax', offset: -240, label: 'Atlantic Time (Halifax, Santiago, Caracas)' },
  { id: 'America/St_Johns', offset: -210, label: 'Newfoundland (St. John\'s)' },
  { id: 'America/Sao_Paulo', offset: -180, label: 'Brasília, São Paulo, Rio de Janeiro, Buenos Aires' },
  { id: 'Atlantic/Azores', offset: -60, label: 'Azores, Cape Verde' },
  { id: 'Europe/London', offset: 0, label: 'London, Dublin, Lisbon, Reykjavik (GMT/UTC)' },
  { id: 'Europe/Berlin', offset: 60, label: 'Central Europe (Berlin, Paris, Rome, Madrid, Amsterdam, Zurich)' },
  { id: 'Europe/Athens', offset: 120, label: 'Eastern Europe (Athens, Cairo, Helsinki, Jerusalem, Kyiv, Bucharest)' },
  { id: 'Asia/Riyadh', offset: 180, label: 'Arabia & East Africa (Riyadh, Moscow, Istanbul, Nairobi, Doha)' },
  { id: 'Asia/Tehran', offset: 210, label: 'Tehran (Iran Standard Time)' },
  { id: 'Asia/Dubai', offset: 240, label: 'Gulf Time (Dubai, Abu Dhabi, Baku, Muscat, Tbilisi)' },
  { id: 'Asia/Kabul', offset: 270, label: 'Kabul (Afghanistan)' },
  { id: 'Asia/Karachi', offset: 300, label: 'Pakistan & Central Asia (Karachi, Tashkent, Islamabad)' },
  { id: 'Asia/Kolkata', offset: 330, label: 'India Standard Time (IST - Mumbai, New Delhi, Bengaluru, Chennai)' },
  { id: 'Asia/Kathmandu', offset: 345, label: 'Nepal Time (Kathmandu)' },
  { id: 'Asia/Dhaka', offset: 360, label: 'Bangladesh & Almaty (Dhaka, Astana, Colombo)' },
  { id: 'Asia/Yangon', offset: 390, label: 'Myanmar Time (Yangon)' },
  { id: 'Asia/Bangkok', offset: 420, label: 'Indochina Time (Bangkok, Jakarta, Hanoi, Ho Chi Minh)' },
  { id: 'Asia/Singapore', offset: 480, label: 'Singapore, Hong Kong, Beijing, Shanghai, Perth, Taipei, Manila)' },
  { id: 'Asia/Tokyo', offset: 540, label: 'Japan & Korea (Tokyo, Osaka, Seoul, Kyoto)' },
  { id: 'Australia/Adelaide', offset: 570, label: 'Australian Central Time (Adelaide, Darwin)' },
  { id: 'Australia/Sydney', offset: 600, label: 'Australian Eastern Time (Sydney, Melbourne, Brisbane, Canberra)' },
  { id: 'Pacific/Guadalcanal', offset: 660, label: 'Solomon Islands, Vladivostok' },
  { id: 'Pacific/Auckland', offset: 720, label: 'New Zealand & Fiji (Auckland, Wellington, Suva)' },
];

function getTimezoneLabel(tz) {
  const userLocalOffsetMin = -new Date().getTimezoneOffset();
  const diff = tz.offset - userLocalOffsetMin;
  const sign = tz.offset >= 0 ? '+' : '-';
  const absH = String(Math.floor(Math.abs(tz.offset) / 60)).padStart(2, '0');
  const absM = String(Math.abs(tz.offset) % 60).padStart(2, '0');
  const utcStr = `UTC${sign}${absH}:${absM}`;

  let relativeStr = '';
  if (diff === 0) {
    relativeStr = 'Your Local Time';
  } else if (diff > 0) {
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    relativeStr = `${hours > 0 ? `${hours}h ` : ''}${mins > 0 ? `${mins}m ` : ''}ahead of you`.trim();
  } else {
    const absDiff = Math.abs(diff);
    const hours = Math.floor(absDiff / 60);
    const mins = absDiff % 60;
    relativeStr = `${hours > 0 ? `${hours}h ` : ''}${mins > 0 ? `${mins}m ` : ''}behind you`.trim();
  }

  return `(${utcStr}) ${tz.label} — [${relativeStr}]`;
}

function getSessionDevice(userAgent) {
  if (!userAgent) return 'Unknown device';
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'iOS device';
  if (/Android/i.test(userAgent)) return 'Android device';
  if (/Windows/i.test(userAgent)) return 'Windows device';
  if (/Macintosh|Mac OS X/i.test(userAgent)) return 'Mac';
  if (/Linux/i.test(userAgent)) return 'Linux device';
  return 'Web device';
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { theme, setTheme } = useThemeStore();
  const addToast = useNotificationStore((s) => s.add);
  const { avatarColor, setAvatarColor, autosaveEnabled, autosaveInterval, setAutosaveEnabled, setAutosaveInterval,
    accentColor, setAccentColor, defaultGridStyle, setDefaultGridStyle, snapToGrid, setSnapToGrid,
    reducedMotion, setReducedMotion } =
    useSettingsStore();

  // Active Tab State
  const [activeTab, setActiveTab] = useState('account');
  const [pluginSearch, setPluginSearch] = useState('');
  const [pluginView, setPluginView] = useState('catalog');
  const [pluginCategory, setPluginCategory] = useState('All categories');
  const [pluginActionId, setPluginActionId] = useState('');

  // Fetch Current User
  const { data: user } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authService.me,
    retry: false,
  });

  const isGuestUser = !user || user.email === 'guest@voxel.com' || user.googleSubject === 'guest-google-sub';

  // Fetch Workspaces
  const { data: workspacesData } = useQuery({
    queryKey: ['workspaces'],
    queryFn: workspaceService.list,
  });
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const activeWorkspace = workspacesData?.find((workspace) => workspace.id === selectedWorkspaceId) || workspacesData?.[0];
  const activeWorkspaceId = activeWorkspace?.id;
  const canManageMembers = ['OWNER', 'ADMIN'].includes(activeWorkspace?.role);
  const { data: memberData, isPending: membersPending } = useQuery({
    queryKey: ['workspaces', activeWorkspaceId, 'members'],
    queryFn: () => workspaceService.members(activeWorkspaceId),
    enabled: Boolean(activeWorkspaceId) && !isGuestUser,
  });
  const { data: inviteData, isPending: invitesPending } = useQuery({
    queryKey: ['workspaces', activeWorkspaceId, 'invites'],
    queryFn: () => workspaceService.invites(activeWorkspaceId),
    enabled: Boolean(activeWorkspaceId) && canManageMembers && !isGuestUser,
  });
  const { data: pluginCatalog = [], isPending: pluginCatalogPending, error: pluginCatalogError } = useQuery({
    queryKey: ['marketplace', 'plugins'],
    queryFn: workspaceService.pluginCatalog,
    enabled: activeTab === 'plugins' && !isGuestUser,
  });
  const { data: installedPlugins = [], isPending: installedPluginsPending, error: installedPluginsError } = useQuery({
    queryKey: ['workspaces', activeWorkspaceId, 'plugins'],
    queryFn: () => workspaceService.plugins(activeWorkspaceId),
    enabled: activeTab === 'plugins' && Boolean(activeWorkspaceId) && !isGuestUser,
  });
  const { data: sessionData, isPending: sessionsPending } = useQuery({
    queryKey: ['auth', 'sessions'],
    queryFn: authService.sessions,
    enabled: Boolean(user) && !isGuestUser,
  });

  // Account & Profile State
  const [displayName, setDisplayName] = useState(user?.displayName || 'User');
  const email = user?.email || '';
  const [emailChangeDraft, setEmailChangeDraft] = useState('');
  const [emailChangeUrl, setEmailChangeUrl] = useState('');
  const [emailChangePending, setEmailChangePending] = useState(false);
  const [jobTitle, setJobTitle] = useState('Product Engineer');
  const [isCustomRole, setIsCustomRole] = useState(false);
  const [customRoleInput, setCustomRoleInput] = useState('');
  const [timezone, setTimezone] = useState('America/Los_Angeles');
  const [language, setLanguage] = useState('English (US)');
  const [bio, setBio] = useState('Designing interactive canvas workspaces and visual telemetry systems.');
  const [website, setWebsite] = useState('');
  const [socialLinks, setSocialLinks] = useState({ github: '', linkedin: '', x: '' });
  const [isSavingPreferences, setIsSavingPreferences] = useState(false);
  const avatarInputRef = useRef(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || 'User');
      setJobTitle(user.jobTitle || '');
      setTimezone(user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
      setLanguage(user.locale === 'en' ? 'English (US)' : user.locale || 'English (US)');
      setBio(user.bio || '');
      setWebsite(user.website || '');
      setSocialLinks({
        github: user.socialLinks?.github || '',
        linkedin: user.socialLinks?.linkedin || '',
        x: user.socialLinks?.x || '',
      });
    }
  }, [user]);

  // Appearance & Canvas State
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
    const notifications = preferences.notifications || {};
    if (typeof notifications.mentions === 'boolean') setNotifMentions(notifications.mentions);
    if (typeof notifications.desktop === 'boolean') setNotifDesktop(notifications.desktop);
  }, [user, setTheme, setAutosaveEnabled, setAutosaveInterval, setAccentColor, setDefaultGridStyle, setSnapToGrid, setReducedMotion]);

  // Workspace & Team State
  const members = (memberData || []).map((member) => ({
    id: member.id,
    userId: member.userId,
    name: member.user.displayName,
    email: member.user.email,
    website: member.user.website,
    socialLinks: member.user.socialLinks || {},
    role: member.role,
    avatar: (member.user.displayName || member.user.email || 'VM').slice(0, 2).toUpperCase(),
    color: member.role === 'OWNER' ? 'bg-violet-600' : 'bg-indigo-600',
  }));

  const [memberSearch, setMemberSearch] = useState('');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('EDITOR');
  const [inviteCopied, setInviteCopied] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');

  useEffect(() => {
    const state = location.state;
    if (!state?.settingsTab && !state?.workspaceId && !state?.openInvite && !state?.memberSearch) return;
    if (state.settingsTab) setActiveTab(state.settingsTab);
    if (state.workspaceId) setSelectedWorkspaceId(state.workspaceId);
    if (state.memberSearch) setMemberSearch(state.memberSearch);
    if (state.openInvite) setInviteModalOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.key, location.pathname, location.state, navigate]);

  // Dynamic Browser & OS detection for active session
  const currentBrowser = useMemo(() => {
    const ua = navigator.userAgent;
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Safari')) return 'Safari';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Edg')) return 'Edge';
    return 'Web Browser';
  }, []);

  const currentOS = useMemo(() => {
    return getDeviceOSString();
  }, []);

  // Security & Active Sessions
  const sessions = (sessionData || []).map((session) => ({
    ...session,
    device: session.current ? currentOS : getSessionDevice(session.userAgent),
    browser: session.userAgent?.includes('Firefox') ? 'Firefox'
      : session.userAgent?.includes('Edg') ? 'Edge'
        : session.userAgent?.includes('Chrome') ? 'Chrome'
          : session.userAgent?.includes('Safari') ? 'Safari' : currentBrowser,
    location: session.ipAddress ? 'Recent sign-in' : 'Location unavailable',
    ip: session.ipAddress || 'IP unavailable',
    lastActive: new Date(session.lastSeenAt).toLocaleString(),
  }));

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordMfaCode, setPasswordMfaCode] = useState('');
  const [showPass, setShowPass] = useState(false);

  // Fetch workspace audit logs
  const { data: auditEventsData, isPending: auditPending } = useQuery({
    queryKey: ['audit-events', activeWorkspaceId],
    queryFn: () => workspaceService.auditEvents(activeWorkspaceId),
    enabled: Boolean(activeWorkspaceId),
  });

  const auditLogs = auditEventsData || [];

  // Notifications State
  const [notifMentions, setNotifMentions] = useState(true);
  const [notifDesktop, setNotifDesktop] = useState(false);
  const [desktopPermission, setDesktopPermission] = useState(() => (
    typeof window !== 'undefined' && 'Notification' in window ? window.Notification.permission : 'unsupported'
  ));

  // Danger Zone State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteMfaCode, setDeleteMfaCode] = useState('');
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [isResettingGuest, setIsResettingGuest] = useState(false);
  const [emailChangeMfaCode, setEmailChangeMfaCode] = useState('');
  const [logoutAllModalOpen, setLogoutAllModalOpen] = useState(false);
  const [logoutAllMfaCode, setLogoutAllMfaCode] = useState('');

  const handleResetGuest = async () => {
    setIsResettingGuest(true);
    try {
      await authService.logout();
      queryClient.clear();
      useHistoryStore.getState().clear();
      useNotificationStore.getState().clearAll();
      localStorage.removeItem('voxel_copied_nodes');
      localStorage.removeItem('voxel_copied_node');
      sessionStorage.removeItem('voxel_active_user');
      addToast('Guest workspace data was cleared. Sign in again to start a fresh guest session.', 'success');
      navigate('/login');
    } catch (error) {
      addToast(error.message || 'Guest workspace data could not be cleared.', 'error');
    } finally {
      setIsResettingGuest(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setIsDeletingAccount(true);
      await authService.deleteAccount({ confirmation: deleteConfirmation, ...(deleteMfaCode.trim() ? { mfaCode: deleteMfaCode.trim() } : {}) });
      queryClient.clear();
      setDeleteModalOpen(false);
      setDeleteMfaCode('');
      addToast('Your account and all associated workspace data have been permanently deleted.', 'info');
      navigate('/login');
    } catch (err) {
      addToast(err.message || 'Failed to delete account.', 'error');
    } finally {
      setIsDeletingAccount(false);
    }
  };

  // Handlers
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      const updated = await authService.updateProfile({
        displayName,
        jobTitle: jobTitle || null,
        timezone,
        locale: language,
        bio: bio || null,
        website: website.trim() || null,
        socialLinks: {
          github: socialLinks.github.trim() || null,
          linkedin: socialLinks.linkedin.trim() || null,
          x: socialLinks.x.trim() || null,
        },
      });
      queryClient.setQueryData(['auth', 'me'], (previous) => ({ ...previous, ...updated }));
      addToast('Profile saved to your account.', 'success');
    } catch (error) {
      addToast(error.message || 'Profile could not be saved.', 'error');
    }
  };

  const handleRequestEmailChange = async () => {
    const nextEmail = emailChangeDraft.trim();
    if (!user?.emailChangeAllowed || !nextEmail || emailChangePending) return;
    setEmailChangePending(true);
    setEmailChangeUrl('');
    try {
      const result = await authService.requestEmailChange({
        email: nextEmail,
        ...(emailChangeMfaCode.trim() ? { mfaCode: emailChangeMfaCode.trim() } : {}),
      });
      setEmailChangeUrl(result.verificationUrl || '');
      setEmailChangeDraft('');
      setEmailChangeMfaCode('');
      addToast('If this address can be used, a confirmation link has been sent. Your current address stays active until you confirm.', 'info');
    } catch (error) {
      addToast(error.message || 'Email change could not be requested.', 'error');
    } finally {
      setEmailChangePending(false);
    }
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setAvatarUploading(true);
    try {
      const result = await authService.uploadAvatar(file);
      queryClient.setQueryData(['auth', 'me'], (previous) => ({ ...previous, avatarUrl: result.avatarUrl }));
      addToast('Profile photo updated.', 'success');
    } catch (error) {
      addToast(error.message || 'Profile photo could not be uploaded.', 'error');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSavePreferences = async (e, includeNotifications = false) => {
    e?.preventDefault?.();
    const preferences = {
      theme,
      accentColor,
      defaultGridStyle,
      snapToGrid,
      reducedMotion,
      autosaveEnabled,
      autosaveInterval,
      ...(includeNotifications ? {
        notifications: {
          mentions: notifMentions,
          desktop: notifDesktop,
        },
      } : {}),
    };
    setIsSavingPreferences(true);
    try {
      const savedPreferences = await authService.updatePreferences(preferences);
      queryClient.setQueryData(['auth', 'me'], (previous) => ({ ...previous, preferences: savedPreferences }));
      addToast('Your preferences are saved to your account.', 'success');
    } catch (error) {
      addToast(error.message || 'Preferences could not be saved.', 'error');
    } finally {
      setIsSavingPreferences(false);
    }
  };

  const handleDesktopAlertsChange = async (enabled) => {
    if (!enabled) {
      setNotifDesktop(false);
      return;
    }
    if (desktopPermission === 'unsupported' || !window.isSecureContext) {
      addToast('Browser desktop alerts require a supported browser and a secure HTTPS connection.', 'warning');
      return;
    }
    let permission = desktopPermission;
    if (permission === 'default') {
      try {
        permission = await window.Notification.requestPermission();
        setDesktopPermission(permission);
      } catch (_error) {
        permission = 'denied';
        setDesktopPermission(permission);
      }
    }
    if (permission === 'granted') {
      setNotifDesktop(true);
      return;
    }
    setNotifDesktop(false);
    addToast('Allow notifications for Voxel in your browser settings to enable desktop alerts.', 'warning');
  };

  const handleSavePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 12) {
      addToast('Use at least 12 characters for your new password.', 'warning');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      addToast('New passwords do not match.', 'warning');
      return;
    }
    try {
      await authService.updatePassword({ currentPassword, newPassword, ...(passwordMfaCode.trim() ? { mfaCode: passwordMfaCode.trim() } : {}) });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setPasswordMfaCode('');
      await queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
      addToast('Password updated. Other active sessions were signed out.', 'success');
    } catch (error) {
      addToast(error.message || 'Password could not be updated.', 'error');
    }
  };

  const handleCopyInvite = () => {
    if (isGuestUser) {
      addToast('Sign in with an account to invite team members to workspace.', 'warning');
      return;
    }
    if (!inviteUrl) {
      addToast('Create an invitation first to generate a secure, recipient-specific link.', 'warning');
      return;
    }
    navigator.clipboard.writeText(inviteUrl);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
    addToast('Workspace invite link copied to clipboard.', 'info');
  };

  const handleRevokeSession = async (id) => {
    try {
      await authService.revokeSession(id);
      await queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] });
      addToast('Session revoked.', 'info');
    } catch (error) {
      addToast(error.message || 'Session could not be revoked.', 'error');
    }
  };

  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (!activeWorkspaceId || !canManageMembers) {
      addToast('You need workspace admin access to invite a member.', 'warning');
      return;
    }
    if (!inviteEmail.trim()) return;
    try {
      const result = await workspaceService.createInvite(activeWorkspaceId, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setInviteUrl(result.inviteUrl);
      await navigator.clipboard.writeText(result.inviteUrl).catch(() => {});
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2500);
      setInviteEmail('');
      setInviteModalOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['workspaces', activeWorkspaceId, 'invites'] });
      addToast(
        result.emailDelivered
          ? `Invitation emailed to ${result.email}; a copy of the link is on your clipboard.`
          : `Invitation link created for ${result.email} and copied to your clipboard. Email delivery is unavailable.`,
        'success',
      );
    } catch (error) {
      addToast(error.message || 'Invitation could not be created.', 'error');
    }
  };

  const handleRemoveMember = async (member) => {
    try {
      await workspaceService.removeMember(activeWorkspaceId, member.id);
      await queryClient.invalidateQueries({ queryKey: ['workspaces', activeWorkspaceId, 'members'] });
      addToast(`${member.name} was removed from the workspace.`, 'info');
    } catch (error) {
      addToast(error.message || 'Member could not be removed.', 'error');
    }
  };

  const handleChangeRole = async (member, role) => {
    try {
      await workspaceService.updateMember(activeWorkspaceId, member.id, { role });
      await queryClient.invalidateQueries({ queryKey: ['workspaces', activeWorkspaceId, 'members'] });
      addToast(`${member.name}'s role was updated.`, 'success');
    } catch (error) {
      addToast(error.message || 'Member role could not be updated.', 'error');
    }
  };

  const handleRevokeInvite = async (invite) => {
    try {
      await workspaceService.revokeInvite(activeWorkspaceId, invite.id);
      await queryClient.invalidateQueries({ queryKey: ['workspaces', activeWorkspaceId, 'invites'] });
      addToast(`Invitation for ${invite.email} was revoked.`, 'info');
    } catch (error) {
      addToast(error.message || 'Invitation could not be revoked.', 'error');
    }
  };

  const handleInstallPlugin = async (plugin) => {
    if (!activeWorkspaceId || !canManageMembers || pluginActionId) return;
    setPluginActionId(plugin.id);
    try {
      await workspaceService.installPlugin(activeWorkspaceId, plugin.id);
      await queryClient.invalidateQueries({ queryKey: ['workspaces', activeWorkspaceId, 'plugins'] });
      addToast(`${plugin.name} is ready in this workspace.`, 'success');
    } catch (error) {
      addToast(error.message || 'Extension could not be installed.', 'error');
    } finally {
      setPluginActionId('');
    }
  };

  const handleUninstallPlugin = async (plugin) => {
    if (!activeWorkspaceId || !canManageMembers || pluginActionId) return;
    setPluginActionId(plugin.id);
    try {
      await workspaceService.uninstallPlugin(activeWorkspaceId, plugin.id);
      await queryClient.invalidateQueries({ queryKey: ['workspaces', activeWorkspaceId, 'plugins'] });
      addToast(`${plugin.name} was removed from this workspace.`, 'info');
    } catch (error) {
      addToast(error.message || 'Extension could not be removed.', 'error');
    } finally {
      setPluginActionId('');
    }
  };

  const handleUpdatePlugin = async (plugin) => {
    if (!activeWorkspaceId || !canManageMembers || pluginActionId) return;
    setPluginActionId(plugin.id);
    try {
      await workspaceService.updatePlugin(activeWorkspaceId, plugin.id);
      await queryClient.invalidateQueries({ queryKey: ['workspaces', activeWorkspaceId, 'plugins'] });
      addToast(`${plugin.name} was updated to v${plugin.version}.`, 'success');
    } catch (error) {
      addToast(error.message || 'Extension could not be updated.', 'error');
    } finally {
      setPluginActionId('');
    }
  };

  const handleLogoutAll = async (event) => {
    event.preventDefault();
    try {
      await authService.logoutAll(logoutAllMfaCode.trim() ? { mfaCode: logoutAllMfaCode.trim() } : {});
      queryClient.clear();
      navigate('/login');
    } catch (error) {
      addToast(error.message || 'Sessions could not be revoked.', 'error');
    }
  };

  const filteredMembers = useMemo(() => {
    return members.filter(
        (m) =>
        (m.name || '').toLowerCase().includes(memberSearch.toLowerCase()) ||
        (m.email || '').toLowerCase().includes(memberSearch.toLowerCase())
    );
  }, [members, memberSearch]);

  const visiblePluginCatalog = useMemo(() => {
    const query = pluginSearch.trim().toLowerCase();
    const installedById = new Map(installedPlugins.map((plugin) => [plugin.id, plugin]));
    return pluginCatalog.filter((plugin) => {
      const installed = installedById.get(plugin.id);
      const viewMatches = pluginView === 'catalog'
        || (pluginView === 'installed' && Boolean(installed))
          || (pluginView === 'updates' && Boolean(installed?.updateAvailable));
      const categoryMatches = pluginCategory === 'All categories' || plugin.category === pluginCategory;
      const searchMatches = !query || [plugin.name, plugin.author, plugin.category, plugin.description]
        .some((value) => value?.toLowerCase().includes(query));
      return viewMatches && categoryMatches && searchMatches;
    });
  }, [pluginCatalog, installedPlugins, pluginSearch, pluginView, pluginCategory]);

  const pluginCategories = useMemo(
    () => ['All categories', ...new Set(pluginCatalog.map((plugin) => plugin.category))],
    [pluginCatalog],
  );

  const tabs = [
    { id: 'account', label: 'Account & Profile', icon: User },
    { id: 'appearance', label: 'Appearance & Canvas', icon: Palette },
    { id: 'workspace', label: 'Workspace & Team', icon: Users },
    { id: 'plugins', label: 'Widget Packs', icon: Puzzle },
    { id: 'security', label: 'Security & Sessions', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
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
            Manage your profile, visual defaults, account security, and workspace access.
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
            {activeTab === 'plugins' && (
              <motion.div
                key="plugins"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm dark:border-white/10 dark:bg-slate-900/60">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex items-center gap-3">
                        <div className="grid size-10 place-items-center rounded-2xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
                          <Puzzle size={19} />
                        </div>
                        <div>
                          <h2 className="text-lg font-extrabold tracking-tight">Widget Packs</h2>
                          <p className="mt-0.5 text-xs text-slate-500">Curated extensions for your workspace</p>
                        </div>
                      </div>
                      <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
                        Packs add schema-driven widgets using Voxel’s built-in renderers. They do not run remote code or request browser permissions.
                      </p>
                    </div>
                    {activeWorkspace && (
                      <span className="shrink-0 rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 dark:border-white/10 dark:text-slate-300">
                        {activeWorkspace.name}
                      </span>
                    )}
                  </div>

                  {isGuestUser ? (
                    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-100">
                      Sign in to browse and install widget packs in a workspace.
                    </div>
                  ) : !activeWorkspaceId ? (
                    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                      Create or join a workspace to use widget packs.
                    </div>
                  ) : (
                    <>
                      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <label className="relative block w-full max-w-xl">
                          <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                          <input type="search" value={pluginSearch} onChange={(event) => setPluginSearch(event.target.value)} placeholder="Search widget packs" className="w-full rounded-xl border border-slate-200 bg-transparent py-3 pl-10 pr-4 text-sm outline-none focus:border-violet-500 dark:border-white/10" />
                        </label>
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
                          <span className="sr-only">Filter by category</span>
                          <select value={pluginCategory} onChange={(event) => setPluginCategory(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-bold text-slate-700 outline-none focus:border-violet-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
                            {pluginCategories.map((category) => <option key={category}>{category}</option>)}
                          </select>
                        </label>
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Widget pack views">
                        {[
                          { id: 'catalog', label: 'Browse' },
                          { id: 'installed', label: `Installed (${installedPlugins.length})` },
                          { id: 'updates', label: `Updates (${installedPlugins.filter((plugin) => plugin.updateAvailable).length})` },
                        ].map((view) => (
                          <button key={view.id} type="button" aria-pressed={pluginView === view.id} onClick={() => setPluginView(view.id)} className={`rounded-full px-3.5 py-2 text-xs font-bold transition ${pluginView === view.id ? 'bg-violet-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5'}`}>
                            {view.label}
                          </button>
                        ))}
                      </div>

                      {!canManageMembers && (
                        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                          Workspace owners and admins manage installed packs. You can browse the catalog and view what is installed.
                        </p>
                      )}
                      {pluginCatalogError && (
                        <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                          {pluginCatalogError.message || 'The widget catalog could not be loaded.'}
                        </p>
                      )}
                      {installedPluginsError && (
                        <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
                          {installedPluginsError.message || 'Installed widget packs could not be loaded.'}
                        </p>
                      )}
                      {(pluginCatalogPending || installedPluginsPending) ? (
                        <div role="status" className="mt-6 flex items-center gap-2 text-sm text-slate-500">
                          <Loader2 size={16} className="animate-spin" /> Loading widget packs…
                        </div>
                      ) : visiblePluginCatalog.length === 0 ? (
                        <p className="mt-6 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500 dark:border-white/15">
                          No widget packs match that search.
                        </p>
                      ) : (
                        <div className="mt-6 grid gap-4 xl:grid-cols-2">
                          {visiblePluginCatalog.map((plugin) => {
                            const installed = installedPlugins.find((item) => item.id === plugin.id);
                            const isBusy = pluginActionId === plugin.id;
                            return (
                              <article key={plugin.id} className="rounded-2xl border border-slate-200 p-5 dark:border-white/10">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <h3 className="text-sm font-extrabold">{plugin.name}</h3>
                                      <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold text-violet-700 dark:text-violet-300">{plugin.category}</span>
                                      {plugin.featured && <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">Featured</span>}
                                      {installed && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">Installed</span>}
                                    </div>
                                    <p className="mt-1 text-[11px] text-slate-500">By {plugin.author} · v{plugin.version}{installed && ` · Installed v${installed.installedVersion}`}</p>
                                  </div>
                                  {canManageMembers && (installed?.updateAvailable ? (
                                    <button type="button" disabled={Boolean(pluginActionId)} onClick={() => handleUpdatePlugin(plugin)} className="shrink-0 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50">
                                      {isBusy ? <Loader2 size={14} className="animate-spin" /> : 'Update'}
                                    </button>
                                  ) : installed ? (
                                    <button type="button" disabled={Boolean(pluginActionId)} onClick={() => handleUninstallPlugin(plugin)} className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-white/10 dark:text-slate-300 dark:hover:bg-white/5">
                                      {isBusy ? <Loader2 size={14} className="animate-spin" /> : 'Uninstall'}
                                    </button>
                                  ) : (
                                    <button type="button" disabled={Boolean(pluginActionId) || Boolean(installedPluginsError)} onClick={() => handleInstallPlugin(plugin)} className="shrink-0 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-500 disabled:opacity-50">
                                      {isBusy ? <Loader2 size={14} className="animate-spin" /> : 'Install'}
                                    </button>
                                  ))}
                                </div>
                                <p className="mt-4 text-xs leading-5 text-slate-600 dark:text-slate-300">{plugin.description}</p>
                                <div className="mt-4 border-t border-slate-100 pt-3 dark:border-white/5">
                                  <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">Included widgets</p>
                                  <ul className="mt-2 space-y-1.5">
                                    {plugin.widgets.map((widget) => (
                                      <li key={widget.type} className="flex items-center justify-between gap-3 text-xs">
                                        <span className="font-semibold text-slate-700 dark:text-slate-200">{widget.title}</span>
                                        <span className="text-[10px] text-slate-400">{widget.category}</span>
                                      </li>
                                    ))}
                                  </ul>
                                  <p className="mt-3 text-[10px] text-slate-500 dark:text-slate-400">
                                    Permissions: {plugin.permissions.length ? plugin.permissions.join(', ') : 'none'}
                                  </p>
                                  {installed?.updateAvailable && (
                                    <p role="status" className="mt-2 text-[11px] font-semibold text-amber-700 dark:text-amber-300">An update is available. Existing widgets are checked before retired types are removed.</p>
                                  )}
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            )}

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

                  {isGuestUser && (
                    <div className="mb-6 rounded-2xl border border-amber-200/80 bg-amber-500/10 p-4 dark:border-amber-500/20 text-amber-900 dark:text-amber-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="grid size-9 place-items-center rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0 font-extrabold text-xs border border-amber-500/20">
                          GU
                        </span>
                        <div>
                          <div className="text-xs font-bold">You are operating in Guest Mode (Solo)</div>
                          <div className="text-[11px] opacity-80 leading-snug">Sign in to sync your profile across devices and unlock team workspace features.</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/login')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 text-white font-bold text-xs hover:bg-amber-500 shrink-0 cursor-pointer shadow-sm transition"
                      >
                        <UserCheck size={14} /> Sign In / Register
                      </button>
                    </div>
                  )}

                  <form onSubmit={handleSaveProfile} className="space-y-6">
                    {/* Avatar Customizer */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5">
                      <div className={`grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl ${avatarColor} text-2xl font-extrabold text-white shadow-md`}>
                        {user?.avatarUrl ? <img src={user.avatarUrl} alt={`${displayName} profile`} className="size-full object-cover" /> : displayName.slice(0, 2).toUpperCase() || 'GU'}
                      </div>
                      <div>
                        {!isGuestUser && <>
                          <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={handleAvatarUpload} className="hidden" />
                          <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={avatarUploading} className="mb-3 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-violet-500 disabled:opacity-60">
                            {avatarUploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}{avatarUploading ? 'Uploading…' : user?.avatarUrl ? 'Change profile photo' : 'Upload profile photo'}
                          </button>
                          <p className="mb-3 text-[10px] text-slate-500">PNG, JPEG, GIF, or WebP. Max 10 MB.</p>
                        </>}
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                          Avatar Badge Color (Applies Globally)
                        </p>
                        <div className="flex gap-2.5 flex-wrap">
                          {[
                            'bg-violet-600',
                            'bg-indigo-600',
                            'bg-blue-600',
                            'bg-cyan-600',
                            'bg-emerald-600',
                            'bg-rose-600',
                            'bg-amber-600',
                            'bg-fuchsia-600',
                            'bg-teal-600',
                            'bg-orange-600',
                          ].map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => {
                                setAvatarColor(color);
                                addToast('Avatar badge color updated across navigation and canvas.', 'info');
                              }}
                              className={`size-7 rounded-full border-2 border-white dark:border-slate-800 shadow-md transition-all hover:scale-115 cursor-pointer ${color} ${
                                avatarColor === color ? 'ring-2 ring-violet-500 ring-offset-2 dark:ring-offset-slate-900 scale-110' : ''
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

                      {/* Email Address ONLY shown when signed in with real account */}
                      {!isGuestUser && (
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                            Email Address
                          </label>
                          <input
                            type="email"
                            value={email}
                            readOnly
                            aria-describedby="account-email-note"
                            className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500 outline-none dark:border-white/10 dark:bg-white/5"
                          />
                          {user.emailChangeAllowed ? (
                            <>
                              <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                                <input
                                  type="email"
                                  autoComplete="email"
                                  maxLength={254}
                                  value={emailChangeDraft}
                                  onChange={(event) => setEmailChangeDraft(event.target.value)}
                                  placeholder="New email address"
                                  aria-label="New sign-in email address"
                                  className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-violet-500 dark:border-white/10 dark:bg-white/5"
                                />
                                <button
                                  type="button"
                                  disabled={emailChangePending || !emailChangeDraft.trim()}
                                  onClick={handleRequestEmailChange}
                                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-violet-600 px-3.5 py-2.5 text-xs font-bold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {emailChangePending && <Loader2 size={14} className="animate-spin" />}
                                  Send confirmation
                                </button>
                              </div>
                              <label htmlFor="email-change-mfa-code" className="mt-3 block text-[10px] font-semibold text-slate-600 dark:text-slate-300">Authenticator or recovery code (required when two factor authentication is enabled)</label>
                              <input
                                id="email-change-mfa-code"
                                autoComplete="one-time-code"
                                maxLength={32}
                                value={emailChangeMfaCode}
                                onChange={(event) => setEmailChangeMfaCode(event.target.value.replace(/[^a-z0-9-]/gi, '').slice(0, 32))}
                                placeholder="App code or recovery code"
                                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-violet-500 dark:border-white/10 dark:bg-white/5"
                              />
                              <p id="account-email-note" className="mt-1 text-[10px] leading-4 text-slate-500">Sign in again first if your session is more than 10 minutes old. The new address must be confirmed within 24 hours. You will sign in again after the change.</p>
                              {emailChangeUrl && (
                                <a href={emailChangeUrl} className="mt-2 inline-flex text-[10px] font-semibold text-violet-600 underline underline-offset-2 dark:text-violet-300">Open local verification link</a>
                              )}
                            </>
                          ) : (
                            <p id="account-email-note" className="mt-1 text-[10px] text-slate-500">This address is managed by your Google sign-in provider.</p>
                          )}
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                          Job Title / Role
                        </label>
                        <select
                          value={isCustomRole ? 'Other' : (JOB_ROLES.includes(jobTitle) ? jobTitle : 'Other')}
                          onChange={(e) => {
                            if (e.target.value === 'Other') {
                              setIsCustomRole(true);
                              setJobTitle(customRoleInput || '');
                            } else {
                              setIsCustomRole(false);
                              setJobTitle(e.target.value);
                            }
                          }}
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-white/10 dark:bg-slate-900"
                        >
                          {JOB_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {role}
                            </option>
                          ))}
                        </select>

                        {isCustomRole && (
                          <div className="mt-2">
                            <input
                              type="text"
                              value={customRoleInput}
                              placeholder="Enter your custom role or title..."
                              autoFocus
                              onChange={(e) => {
                                setCustomRoleInput(e.target.value);
                                setJobTitle(e.target.value);
                              }}
                              className="w-full rounded-xl border border-violet-400/80 bg-violet-50/40 dark:bg-violet-950/30 px-3.5 py-2 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-violet-500/30 dark:text-white"
                            />
                          </div>
                        )}
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
                          {LANGUAGES.map((lang) => (
                            <option key={lang} value={lang}>
                              {lang}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className={isGuestUser ? 'sm:col-span-2' : 'sm:col-span-2'}>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                          Timezone & Relative Offset
                        </label>
                        <select
                          value={timezone}
                          onChange={(e) => setTimezone(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-white/10 dark:bg-slate-900 font-mono text-xs"
                        >
                          {TIMEZONES.map((tz) => (
                            <option key={tz.id} value={tz.id}>
                              {getTimezoneLabel(tz)}
                            </option>
                          ))}
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

                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label htmlFor="profile-website" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">Website</label>
                        <input
                          id="profile-website"
                          type="url"
                          inputMode="url"
                          autoComplete="url"
                          maxLength={2048}
                          value={website}
                          onChange={(event) => setWebsite(event.target.value)}
                          placeholder="https://example.com"
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10"
                        />
                      </div>
                      <div>
                        <label htmlFor="profile-github" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">GitHub profile</label>
                        <input
                          id="profile-github"
                          type="url"
                          inputMode="url"
                          maxLength={2048}
                          value={socialLinks.github}
                          onChange={(event) => setSocialLinks((previous) => ({ ...previous, github: event.target.value }))}
                          placeholder="https://github.com/username"
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10"
                        />
                      </div>
                      <div>
                        <label htmlFor="profile-linkedin" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">LinkedIn profile</label>
                        <input
                          id="profile-linkedin"
                          type="url"
                          inputMode="url"
                          maxLength={2048}
                          value={socialLinks.linkedin}
                          onChange={(event) => setSocialLinks((previous) => ({ ...previous, linkedin: event.target.value }))}
                          placeholder="https://www.linkedin.com/in/username"
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10"
                        />
                      </div>
                      <div>
                        <label htmlFor="profile-x" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">X profile</label>
                        <input
                          id="profile-x"
                          type="url"
                          inputMode="url"
                          maxLength={2048}
                          value={socialLinks.x}
                          onChange={(event) => setSocialLinks((previous) => ({ ...previous, x: event.target.value }))}
                          placeholder="https://x.com/username"
                          className="w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 dark:border-white/10"
                        />
                      </div>
                      <p className="sm:col-span-2 text-xs text-slate-500">Profile links must use HTTPS. Only links you choose to share are visible to workspace teammates.</p>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex justify-end">
                      <button
                        type="submit"
                        className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/25 hover:bg-violet-500 transition cursor-pointer hover:scale-105 active:scale-95"
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
                    <div className="grid grid-cols-3 gap-2 sm:w-[30rem]">
                      <button
                        type="button"
                        onClick={() => setTheme('light')}
                        aria-pressed={theme === 'light'}
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
                        aria-pressed={theme === 'dark'}
                        className={`flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                          theme === 'dark'
                            ? 'border-violet-600 bg-violet-500/20 text-violet-200 shadow-sm'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5'
                        }`}
                      >
                        Dark Mode
                      </button>
                      <button
                        type="button"
                        onClick={() => setTheme('system')}
                        aria-pressed={theme === 'system'}
                        className={`flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                          theme === 'system'
                            ? 'border-violet-600 bg-violet-500/20 text-violet-700 dark:text-violet-200 shadow-sm'
                            : 'border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-white/10 dark:text-slate-400 dark:hover:bg-white/5'
                        }`}
                      >
                        System
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
                          aria-pressed={accentColor === item.id}
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
                        { id: 'radial', label: 'Radial Mesh' },
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

                  <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex justify-end">
                    <button
                      type="button"
                      onClick={(event) => handleSavePreferences(event)}
                      disabled={isSavingPreferences}
                      className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/25 hover:bg-violet-500 transition cursor-pointer hover:scale-105 active:scale-95"
                    >
                      <Check size={16} /> {isSavingPreferences ? 'Saving…' : 'Save Appearance Preferences'}
                    </button>
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
                      {!isGuestUser && (workspacesData?.length || 0) > 1 && (
                        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                          Workspace
                          <select value={activeWorkspaceId || ''} onChange={(event) => { setSelectedWorkspaceId(event.target.value); setInviteUrl(''); setInviteCopied(false); }} className="max-w-56 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200">
                            {workspacesData.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
                          </select>
                        </label>
                      )}
                    {!isGuestUser && canManageMembers && (
                      <div className="flex items-center gap-2">
                        {inviteUrl && (
                          <button
                            onClick={handleCopyInvite}
                            type="button"
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-3.5 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 cursor-pointer"
                          >
                            <Copy size={14} /> {inviteCopied ? 'Link Copied!' : 'Copy Latest Invite'}
                          </button>
                        )}
                        <button
                          onClick={() => setInviteModalOpen(true)}
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-violet-500 cursor-pointer"
                        >
                          <Plus size={15} /> Invite Member
                        </button>
                      </div>
                    )}
                  </div>

                  {isGuestUser ? (
                    <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/60 via-indigo-50/30 to-slate-50/80 p-8 text-center dark:border-violet-500/20 dark:from-violet-950/20 dark:via-indigo-950/10 dark:to-slate-900/40 space-y-5">
                      <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-violet-600/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400 border border-violet-500/20 shadow-xs">
                        <Lock size={28} />
                      </div>
                      <div className="max-w-md mx-auto space-y-2">
                        <span className="inline-block rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          Sign-In Required
                        </span>
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                          Team Collaboration is Reserved for Signed-In Accounts
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          Guest users operate in <strong>Solo Mode</strong> to create, edit, export, and share blueprints. Real-time multi-user team collaboration, workspace member management, and invitation controls require signing in with an account.
                        </p>
                      </div>
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => navigate('/login')}
                          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-violet-600/25 hover:bg-violet-500 transition-all cursor-pointer hover:scale-105"
                        >
                          <UserCheck size={16} /> Sign In to Unlock Team Access
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
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
                            {membersPending && (
                              <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">Loading workspace members…</td></tr>
                            )}
                            {!membersPending && filteredMembers.length === 0 && (
                              <tr><td colSpan={3} className="px-4 py-8 text-center text-slate-500">No members match this search.</td></tr>
                            )}
                            {!membersPending && filteredMembers.map((member) => (
                              <tr key={member.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <span className={`grid size-9 place-items-center rounded-xl ${member.color} text-xs font-extrabold text-white shrink-0`}>
                                      {member.avatar}
                                    </span>
                                    <div>
                                      <div className="font-bold text-slate-800 dark:text-slate-200">{member.name}</div>
                                      <div className="text-[10px] text-slate-400">{member.email}</div>
                                      {(member.website || member.socialLinks.github || member.socialLinks.linkedin || member.socialLinks.x) && (
                                        <div className="mt-1 flex flex-wrap gap-x-2 text-[10px] font-semibold">
                                          {member.website && <a href={member.website} target="_blank" rel="noopener noreferrer" className="text-violet-600 underline-offset-2 hover:underline dark:text-violet-300">Website</a>}
                                          {member.socialLinks.github && <a href={member.socialLinks.github} target="_blank" rel="noopener noreferrer" className="text-violet-600 underline-offset-2 hover:underline dark:text-violet-300">GitHub</a>}
                                          {member.socialLinks.linkedin && <a href={member.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-violet-600 underline-offset-2 hover:underline dark:text-violet-300">LinkedIn</a>}
                                          {member.socialLinks.x && <a href={member.socialLinks.x} target="_blank" rel="noopener noreferrer" className="text-violet-600 underline-offset-2 hover:underline dark:text-violet-300">X</a>}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3.5">
                                  {canManageMembers && member.role !== 'OWNER' && (activeWorkspace?.role === 'OWNER' || member.role !== 'ADMIN') ? (
                                    <select
                                      value={member.role}
                                      onChange={(event) => handleChangeRole(member, event.target.value)}
                                      className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-violet-500 dark:border-white/10 dark:bg-slate-900 dark:text-slate-200"
                                      aria-label={`Role for ${member.name || member.email}`}
                                    >
                                      {activeWorkspace?.role === 'OWNER' && <option value="ADMIN">Admin</option>}
                                      <option value="EDITOR">Editor</option>
                                      <option value="COMMENTER">Commenter</option>
                                      <option value="VIEWER">Viewer</option>
                                    </select>
                                  ) : (
                                    <span className="inline-block rounded-full bg-violet-100 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-violet-700 dark:bg-violet-500/20 dark:text-violet-200">{member.role}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3.5 text-right">
                                  {canManageMembers && member.role !== 'OWNER' && (activeWorkspace?.role === 'OWNER' || member.role !== 'ADMIN') && (
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveMember(member)}
                                      title={`Remove ${member.name || member.email} from workspace`}
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

                      {canManageMembers && (
                        <div className="space-y-3 border-t border-slate-100 pt-5 dark:border-white/5">
                          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-300">Pending invitations</h3>
                          {invitesPending ? <p className="text-xs text-slate-500">Loading invitations…</p> : (inviteData || []).length === 0 ? (
                            <p className="text-xs text-slate-500">No pending invitations.</p>
                          ) : (inviteData || []).map((invite) => (
                            <div key={invite.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3.5 py-3 dark:border-white/10">
                              <div className="min-w-0">
                                <div className="truncate text-xs font-bold text-slate-800 dark:text-slate-200">{invite.email}</div>
                                <div className="mt-0.5 text-[10px] text-slate-500">{invite.role} · Expires {new Date(invite.expiresAt).toLocaleDateString()}</div>
                              </div>
                              <button type="button" onClick={() => handleRevokeInvite(invite)} className="rounded-lg px-2.5 py-1.5 text-[10px] font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10">Revoke</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
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
                {isGuestUser ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-white/10 dark:bg-slate-900/60 shadow-sm">
                    <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/60 via-indigo-50/30 to-slate-50/80 p-8 text-center dark:border-violet-500/20 dark:from-violet-950/20 dark:via-indigo-950/10 dark:to-slate-900/40 space-y-5">
                      <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-violet-600/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400 border border-violet-500/20 shadow-xs">
                        <Shield size={28} />
                      </div>
                      <div className="max-w-md mx-auto space-y-2">
                        <span className="inline-block rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          Sign-In Required
                        </span>
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                          Security & Active Sessions Management
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          Password credentials, two-factor authentication (2FA), device session revocation, and security audit logs are managed on signed-in user accounts.
                        </p>
                      </div>
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => navigate('/login')}
                          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-violet-600/25 hover:bg-violet-500 transition-all cursor-pointer hover:scale-105"
                        >
                          <UserCheck size={16} /> Sign In / Register Account
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
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
                        <div>
                          <label htmlFor="password-mfa-code" className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-1.5">
                            Authenticator or Recovery Code (if enabled)
                          </label>
                          <input
                            id="password-mfa-code"
                            autoComplete="one-time-code"
                            maxLength={32}
                            value={passwordMfaCode}
                            onChange={(event) => setPasswordMfaCode(event.target.value.replace(/[^a-z0-9-]/gi, '').slice(0, 32))}
                            placeholder="App code or recovery code"
                            className="w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none ring-violet-500 focus:ring-2 dark:border-white/10"
                          />
                        </div>

                        <button
                          type="submit"
                          className="rounded-xl bg-violet-600 px-4.5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-violet-500 cursor-pointer"
                        >
                          Update Security Password
                        </button>
                      </form>
                    </div>

                    <TwoFactorSettingsCard addToast={addToast} />

                    {/* Active Sessions */}
                    <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-white/10 dark:bg-slate-900/60 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-1.5 h-6 bg-violet-600 rounded-full" />
                          <h2 className="text-lg font-extrabold tracking-tight">Active Browser & Device Sessions</h2>
                        </div>
                        {!isGuestUser && <button type="button" onClick={() => setLogoutAllModalOpen(true)} className="rounded-xl border border-rose-200 px-3 py-2 text-[10px] font-bold text-rose-600 hover:bg-rose-50 dark:border-rose-500/20 dark:text-rose-400 dark:hover:bg-rose-500/10">Sign out everywhere</button>}
                      </div>

                      <div className="space-y-3">
                        {sessionsPending && <p className="rounded-xl border border-slate-200 px-4 py-6 text-center text-xs text-slate-500 dark:border-white/10">Loading active sessions…</p>}
                        {!sessionsPending && sessions.length === 0 && <p className="rounded-xl border border-slate-200 px-4 py-6 text-center text-xs text-slate-500 dark:border-white/10">No active sessions found.</p>}
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
                            {auditLogs.map((log) => (
                              <tr key={log.id}>
                                <td className="px-4 py-3 font-mono text-[11px] text-violet-600 dark:text-violet-300">
                                  {log.action}
                                </td>
                                <td className="px-4 py-3 font-medium text-slate-700 dark:text-slate-300">
                                  {log.resourceType}: {log.resourceId}
                                </td>
                                <td className="px-4 py-3 text-slate-500">
                                  {log.actor?.displayName || log.actor?.email || 'System'}
                                </td>
                                <td className="px-4 py-3 text-right text-slate-400 text-[10px]">
                                  {new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </td>
                              </tr>
                            ))}
                            {auditLogs.length === 0 && !auditPending && (
                              <tr>
                                <td colSpan={4} className="px-4 py-6 text-center text-xs text-slate-400">
                                  No security audit logs recorded yet.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                    </div>
                  </>
                )}
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
                {isGuestUser ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-white/10 dark:bg-slate-900/60 shadow-sm">
                    <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-br from-violet-50/60 via-indigo-50/30 to-slate-50/80 p-8 text-center dark:border-violet-500/20 dark:from-violet-950/20 dark:via-indigo-950/10 dark:to-slate-900/40 space-y-5">
                      <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-violet-600/10 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400 border border-violet-500/20 shadow-xs">
                        <Bell size={28} />
                      </div>
                      <div className="max-w-md mx-auto space-y-2">
                        <span className="inline-block rounded-full bg-amber-500/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-widest text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          Sign-In Required
                        </span>
                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                          Notification Preferences Require an Account
                        </h3>
                        <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                          Sign in to save notification preferences to your account. Delivery channels are not active in this deployment.
                        </p>
                      </div>
                      <div className="pt-2">
                        <button
                          type="button"
                          onClick={() => navigate('/login')}
                          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-violet-600/25 hover:bg-violet-500 transition-all cursor-pointer hover:scale-105"
                        >
                          <UserCheck size={16} /> Sign In to Configure Notifications
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-white/10 dark:bg-slate-900/60 shadow-sm space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-1.5 h-6 bg-violet-600 rounded-full" />
                        <h2 className="text-lg font-extrabold tracking-tight">Notification Preferences</h2>
                    </div>
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                      Mention alerts appear in Voxel. Optional desktop alerts work while Voxel is open in a background tab. Email digests, alerts while the app is closed, and product announcements are not available yet.
                    </p>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5">
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Email digest</div>
                          <div className="text-[11px] text-slate-500">Weekly workspace summaries are not available yet.</div>
                        </div>
                        <span className="shrink-0 rounded-full border border-slate-200 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:border-white/10 dark:text-slate-400">Unavailable</span>
                      </div>

                      <label className="flex items-center justify-between p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5 cursor-pointer">
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Mention alerts</div>
                          <div className="text-[11px] text-slate-500">Show an in-app notification when a teammate mentions you in a dashboard discussion.</div>
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
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Desktop alerts</div>
                          <div className="text-[11px] text-slate-500">Show new Voxel notifications while the app is open in a background tab. {desktopPermission === 'denied' ? 'Browser permission is blocked; update it in site settings.' : 'Browser notification permission is required.'}</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={notifDesktop}
                          disabled={desktopPermission === 'unsupported'}
                          onChange={(e) => { void handleDesktopAlertsChange(e.target.checked); }}
                          className="size-4 accent-violet-600 enabled:cursor-pointer disabled:opacity-50"
                        />
                      </label>

                      <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/5">
                        <div>
                          <div className="text-xs font-bold text-slate-800 dark:text-slate-200">Product announcements</div>
                          <div className="text-[11px] text-slate-500">Product update announcements are not available yet.</div>
                        </div>
                        <span className="shrink-0 rounded-full border border-slate-200 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wide text-slate-500 dark:border-white/10 dark:text-slate-400">Unavailable</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex justify-end">
                      <button
                        type="button"
                        onClick={(event) => handleSavePreferences(event, true)}
                        disabled={isSavingPreferences}
                        className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-violet-600/25 hover:bg-violet-500 transition cursor-pointer hover:scale-105 active:scale-95"
                      >
                        <Check size={16} /> {isSavingPreferences ? 'Saving…' : 'Save Notification Preferences'}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* TAB 6: Danger Zone */}
            {activeTab === 'danger' && (
              <motion.div
                key="danger"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="space-y-6"
              >
                {isGuestUser ? (
                  <div className="rounded-3xl border border-rose-300/80 bg-rose-500/5 p-6 sm:p-8 dark:border-rose-500/30 dark:bg-rose-950/20 shadow-sm space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-6 bg-rose-600 rounded-full" />
                      <h2 className="text-lg font-extrabold tracking-tight text-rose-600 dark:text-rose-400">
                        Guest Session Reset
                      </h2>
                    </div>

                    <p className="text-xs text-rose-600/80 dark:text-rose-300/80 leading-relaxed">
                      You are using the development guest account. Clearing guest data deletes its workspaces and dashboards, then signs you out.
                    </p>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border border-rose-200 dark:border-rose-500/20 bg-white/80 dark:bg-slate-900/60">
                      <div>
                        <div className="text-xs font-bold text-slate-900 dark:text-white">Clear Guest Workspace Data</div>
                        <div className="text-[11px] text-slate-500">Deletes development guest workspaces and clears local editor history</div>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetGuest}
                        disabled={isResettingGuest}
                        className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-rose-500 cursor-pointer shrink-0 disabled:opacity-50"
                      >
                        {isResettingGuest ? 'Clearing…' : 'Clear guest data'}
                      </button>
                    </div>
                  </div>
                ) : (
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
                )}
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
                <p className="mt-1.5 text-[10px] leading-4 text-slate-500">Voxel emails the invitation when delivery is configured and always copies a secure, email-specific link for you to share.</p>
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
                  {activeWorkspace?.role === 'OWNER' && <option value="ADMIN">ADMIN — Full admin rights</option>}
                  <option value="EDITOR">EDITOR — Edit canvas nodes & layout</option>
                  <option value="COMMENTER">COMMENTER — Review and comment</option>
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
                Create invitation link
              </button>
            </div>
          </form>
        </div>
      )}

      {logoutAllModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm" onMouseDown={() => setLogoutAllModalOpen(false)}>
          <form
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-all-title"
            onSubmit={handleLogoutAll}
            onMouseDown={(event) => event.stopPropagation()}
            className="w-full max-w-md space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-slate-900"
          >
            <div>
              <h3 id="logout-all-title" className="text-base font-extrabold">Sign out all devices</h3>
              <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">For accounts with two factor authentication, enter your current app code or an unused recovery code. Sign in again first if your session is more than 10 minutes old.</p>
            </div>
            <label htmlFor="logout-all-mfa-code" className="block text-xs font-semibold">Authenticator or recovery code (if enabled)</label>
            <input
              id="logout-all-mfa-code"
              autoComplete="one-time-code"
              maxLength={32}
              value={logoutAllMfaCode}
              onChange={(event) => setLogoutAllMfaCode(event.target.value.replace(/[^a-z0-9-]/gi, '').slice(0, 32))}
              placeholder="App code or recovery code"
              className="w-full rounded-xl border border-slate-200 bg-transparent px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-violet-500 dark:border-white/10"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setLogoutAllModalOpen(false)} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5">Cancel</button>
              <button type="submit" className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-rose-500">Sign out everywhere</button>
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
              This permanently deletes your account and workspaces you own. Dashboards in other workspaces are reassigned to their owners. Transfer ownership or remove other members from your workspaces first. For security, you must have signed in within the last 10 minutes. If two factor authentication is enabled, enter an app code or unused recovery code. Type <b className="font-mono text-rose-600">DELETE MY ACCOUNT</b> to confirm.
            </p>
            <input
              type="text"
              aria-label="Type DELETE MY ACCOUNT to confirm account deletion"
              autoComplete="off"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
              className="w-full rounded-xl border border-rose-300 bg-transparent px-3.5 py-2.5 text-xs font-mono outline-none focus:ring-2 focus:ring-rose-500 dark:border-rose-500/40"
            />
            <label htmlFor="delete-account-mfa-code" className="block text-xs font-semibold">Authenticator or recovery code (if enabled)</label>
            <input
              id="delete-account-mfa-code"
              autoComplete="one-time-code"
              maxLength={32}
              value={deleteMfaCode}
              onChange={(event) => setDeleteMfaCode(event.target.value.replace(/[^a-z0-9-]/gi, '').slice(0, 32))}
              placeholder="App code or recovery code"
              className="w-full rounded-xl border border-rose-300 bg-transparent px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-rose-500 dark:border-rose-500/40"
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
                disabled={deleteConfirmation !== 'DELETE MY ACCOUNT' || isDeletingAccount}
                onClick={handleDeleteAccount}
                className="rounded-xl bg-rose-600 px-4.5 py-2.5 text-xs font-bold text-white hover:bg-rose-500 disabled:opacity-40 cursor-pointer flex items-center gap-2 transition-all"
              >
                {isDeletingAccount ? 'Deleting Account...' : 'Permanently Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
