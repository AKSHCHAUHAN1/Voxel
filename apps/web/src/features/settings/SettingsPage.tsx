import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Sun,
  Moon,
  Eye,
  Edit3,
  Info,
  Mail,
  Shield,
  Check,
  Globe,
  DollarSign,
} from 'lucide-react';
import { useThemeStore } from '@/store/theme-store';
import { authService } from '@/features/auth/auth-service';

const emailSchema = z.object({
  email: z.string().trim().email('Please enter a valid email address.'),
});
type EmailForm = z.infer<typeof emailSchema>;

export default function SettingsPage() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);

  // Fetch current user details
  const { data: user } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authService.me,
    retry: false,
  });

  const isGoogleLogin = user && user.email !== 'guest@voxel.com';
  const initialRole = isGoogleLogin ? 'ADMIN' : 'EDITOR';

  const [simulatedRole, setSimulatedRole] = useState<'ADMIN' | 'VIEWER'>(
    initialRole === 'ADMIN' ? 'ADMIN' : 'ADMIN' // default mock access
  );
  
  const [weeklySummaries, setWeeklySummaries] = useState(true);
  const [productUpdates, setProductUpdates] = useState(false);
  const [currency, setCurrency] = useState('USD');
  const [timezone, setTimezone] = useState('GMT-5 (EST)');
  const [toast, setToast] = useState<string | null>(null);

  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [emailValue, setEmailValue] = useState(user?.email || 'guest@voxel.com');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EmailForm>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: emailValue },
  });

  const handleSaveEmail = (data: EmailForm) => {
    setEmailValue(data.email);
    setIsEditingEmail(false);
    showToast('Email address successfully updated.');
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleApplyChanges = () => {
    showToast('Platform settings successfully saved.');
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto relative">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-xs font-semibold text-white shadow-2xl animate-scale-in">
          <Check size={14} /> {toast}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Platform Settings</h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400 max-w-2xl leading-relaxed text-sm">
          Manage your workspace identity, visual themes, and access levels. These settings demonstrate Role-Based Access Control (RBAC) behavior.
        </p>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Role Management Card */}
        <div className="col-span-12 lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900 relative overflow-hidden group shadow-sm">
          <div className="absolute top-0 right-0 p-8 opacity-[0.02] dark:opacity-[0.04] pointer-events-none">
            <Shield size={160} />
          </div>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-1 h-6 bg-violet-600 rounded-full" />
            <h2 className="text-lg font-bold tracking-tight">Identity & Role Management</h2>
          </div>

          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5 dark:border-white/5 dark:bg-white/5 mb-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-bold text-sm">Current Permission Level</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Active role determines available features and data mutability.</p>
              </div>
              <span className="px-3 py-1 bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-200 text-[10px] font-black rounded-full uppercase tracking-wider">
                Live: {simulatedRole}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Viewer Mode */}
              <button
                onClick={() => setSimulatedRole('VIEWER')}
                className={`p-4 rounded-xl border-2 transition text-left ${
                  simulatedRole === 'VIEWER'
                    ? 'border-violet-600 bg-violet-50/10'
                    : 'border-transparent bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-2 rounded-lg ${simulatedRole === 'VIEWER' ? 'bg-violet-600 text-white' : 'bg-slate-100 dark:bg-white/5'}`}>
                    <Eye size={18} />
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    simulatedRole === 'VIEWER' ? 'border-violet-600' : 'border-slate-300 dark:border-white/10'
                  }`}>
                    {simulatedRole === 'VIEWER' && <div className="w-2 h-2 rounded-full bg-violet-600" />}
                  </div>
                </div>
                <p className="font-bold text-sm">Viewer Mode</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Read-only access. View visual dashboard structures but cannot commit updates.</p>
              </button>

              {/* Admin Mode */}
              <button
                onClick={() => setSimulatedRole('ADMIN')}
                className={`p-4 rounded-xl border-2 transition text-left ${
                  simulatedRole === 'ADMIN'
                    ? 'border-violet-600 bg-violet-50/10'
                    : 'border-transparent bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-2 rounded-lg ${simulatedRole === 'ADMIN' ? 'bg-violet-600 text-white' : 'bg-slate-100 dark:bg-white/5'}`}>
                    <Edit3 size={18} />
                  </div>
                  <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    simulatedRole === 'ADMIN' ? 'border-violet-600' : 'border-slate-300 dark:border-white/10'
                  }`}>
                    {simulatedRole === 'ADMIN' && <div className="w-2 h-2 rounded-full bg-violet-600" />}
                  </div>
                </div>
                <p className="font-bold text-sm">Admin Mode</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Full read/write permissions. Configure nodes, modify workspaces, and update schemas.</p>
              </button>
            </div>
          </div>

          <div className="bg-violet-50/50 dark:bg-violet-500/5 p-4 rounded-lg flex gap-3 items-center border border-violet-100/50 dark:border-violet-500/10">
            <Info size={16} className="text-violet-500 shrink-0" />
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <strong>RBAC Notice:</strong> Toggling modes demonstrates simulated client state mutations. Roles persist across visual nodes.
            </p>
          </div>
        </div>

        {/* Right side Visual / Notification panels */}
        <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
          {/* Visual Atelier Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900 shadow-sm">
            <h2 className="text-base font-bold mb-5">Visual Atelier</h2>
            <div className="space-y-2">
              <button
                onClick={() => setTheme('light')}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl transition ${
                  theme === 'light' ? 'bg-slate-50 dark:bg-white/5' : 'opacity-60 hover:opacity-90'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Sun size={18} className="text-slate-700 dark:text-slate-300" />
                  <div className="text-left">
                    <p className="font-semibold text-xs">Light Mode</p>
                    {theme === 'light' && <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold mt-0.5">Active</p>}
                  </div>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${theme === 'light' ? 'border-violet-600' : 'border-slate-300'}`}>
                  {theme === 'light' && <div className="w-2.5 h-2.5 rounded-full bg-violet-600" />}
                </div>
              </button>
              <button
                onClick={() => setTheme('dark')}
                className={`w-full flex items-center justify-between p-3.5 rounded-xl transition ${
                  theme === 'dark' ? 'bg-slate-50 dark:bg-white/5' : 'opacity-60 hover:opacity-90'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Moon size={18} className="text-slate-700 dark:text-slate-300" />
                  <div className="text-left">
                    <p className="font-semibold text-xs">Dark Mode</p>
                    {theme === 'dark' && <p className="text-[9px] text-slate-400 uppercase tracking-wider font-bold mt-0.5">Active</p>}
                  </div>
                </div>
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${theme === 'dark' ? 'border-violet-600' : 'border-slate-300'}`}>
                  {theme === 'dark' && <div className="w-2.5 h-2.5 rounded-full bg-violet-600" />}
                </div>
              </button>
            </div>
          </div>

          {/* Notification settings */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900 shadow-sm flex-1 flex flex-col justify-center">
            <h2 className="text-base font-bold mb-5">Notification Settings</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-white/5">
                <p className="text-xs font-semibold">Weekly Summaries</p>
                <button
                  onClick={() => setWeeklySummaries(!weeklySummaries)}
                  className={`w-10 h-5.5 rounded-full relative transition ${weeklySummaries ? 'bg-violet-600' : 'bg-slate-200 dark:bg-white/10'}`}
                >
                  <div className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full transition-all duration-300 ${weeklySummaries ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-white/5">
                <p className="text-xs font-semibold">Product Updates</p>
                <button
                  onClick={() => setProductUpdates(!productUpdates)}
                  className={`w-10 h-5.5 rounded-full relative transition ${productUpdates ? 'bg-violet-600' : 'bg-slate-200 dark:bg-white/10'}`}
                >
                  <div className={`absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full transition-all duration-300 ${productUpdates ? 'right-0.5' : 'left-0.5'}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Global Preferences Panel */}
        <div className="col-span-12 rounded-2xl border border-slate-200 bg-white p-6 dark:border-white/10 dark:bg-slate-900 shadow-sm">
          <h2 className="text-base font-bold mb-1">Global Preferences</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">Configure regional defaults and communication channels.</p>
          
          <div className="grid gap-6 md:grid-cols-3">
            {/* Email Edit Block */}
            <div className="p-4 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                <Mail size={14} /> Email Address
              </div>
              {isEditingEmail ? (
                <form onSubmit={handleSubmit(handleSaveEmail)} className="space-y-2">
                  <input
                    {...register('email')}
                    autoFocus
                    className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg p-2 outline-none"
                  />
                  {errors.email && (
                    <p className="text-[10px] text-rose-500">{errors.email.message}</p>
                  )}
                  <div className="flex gap-1.5 justify-end">
                    <button
                      type="button"
                      onClick={() => setIsEditingEmail(false)}
                      className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="p-1.5 rounded-lg bg-violet-600 text-white text-xs px-2.5"
                    >
                      Save
                    </button>
                  </div>
                </form>
              ) : (
                <div className="flex justify-between items-center">
                  <span className="text-xs font-semibold truncate max-w-[200px]">{emailValue}</span>
                  <button
                    onClick={() => setIsEditingEmail(true)}
                    className="text-xs text-violet-600 dark:text-violet-400 font-bold hover:underline"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            {/* Currency Choice */}
            <div className="p-4 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                <DollarSign size={14} /> Preferred Currency
              </div>
              <select
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value);
                  showToast(`Default currency changed to ${e.target.value}`);
                }}
                className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg p-2 outline-none text-slate-800 dark:text-slate-100"
              >
                <option value="USD">USD - US Dollar</option>
                <option value="INR">INR - Indian Rupee</option>
                <option value="EUR">EUR - Euro</option>
                <option value="GBP">GBP - British Pound</option>
              </select>
            </div>

            {/* Timezone Choice */}
            <div className="p-4 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                <Globe size={14} /> Regional Timezone
              </div>
              <select
                value={timezone}
                onChange={(e) => {
                  setTimezone(e.target.value);
                  showToast(`Timezone offset changed to ${e.target.value}`);
                }}
                className="w-full text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-lg p-2 outline-none text-slate-800 dark:text-slate-100"
              >
                <option value="GMT-5 (EST)">GMT-5 (EST) - Eastern Time</option>
                <option value="GMT+5:30 (IST)">GMT+5:30 (IST) - India Time</option>
                <option value="GMT+0 (UTC)">GMT+0 (UTC) - Coordinated Time</option>
                <option value="GMT+9 (JST)">GMT+9 (JST) - Japan Time</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Apply Changes Button */}
      <div className="flex justify-end pt-4">
        <button
          onClick={handleApplyChanges}
          className="rounded-xl bg-violet-600 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 hover:bg-violet-500 transition-all hover:scale-[1.02]"
        >
          Save Platform Changes
        </button>
      </div>
    </div>
  );
}
