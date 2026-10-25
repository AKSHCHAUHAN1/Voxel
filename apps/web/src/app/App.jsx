import { useEffect, useState, lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { Wifi, WifiOff } from 'lucide-react';
import { useEffectiveTheme } from '@/store/theme-store';
import { useSettingsStore } from '@/store/settings-store';
import { AppShell } from '@/components/layout/AppShell';
import { LoginPage } from '@/features/auth/LoginPage';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { PageLoader } from '@/components/feedback/PageLoader';
import { ErrorBoundary } from '@/components/feedback/ErrorBoundary';
import NotFoundPage from '@/components/feedback/NotFoundPage';

const WorkspacesPage = lazy(() => import('@/features/workspaces/WorkspacesPage'));
const WorkspaceDashboardsPage = lazy(() => import('@/features/workspaces/WorkspaceDashboardsPage'));
const EditorPage = lazy(() => import('@/features/editor/EditorPage'));
const LandingPage = lazy(() => import('@/features/landing/LandingPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const PublicInvitePage = lazy(() => import('@/features/workspaces/PublicInvitePage'));
const SharedDashboardPage = lazy(() => import('@/features/workspaces/SharedDashboardPage'));
const VerifyEmailPage = lazy(() => import('@/features/auth/VerifyEmailPage'));
const EmailChangePage = lazy(() => import('@/features/auth/EmailChangePage'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/ForgotPasswordPage'));
const PasswordResetPage = lazy(() => import('@/features/auth/PasswordResetPage'));

export default function App() {
  const theme = useEffectiveTheme();
  const accentColor = useSettingsStore((s) => s.accentColor);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);
  const [networkStatus, setNetworkStatus] = useState(() => (
    typeof navigator === 'undefined' || navigator.onLine ? 'online' : 'offline'
  ));

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    const supportedAccents = new Set(['violet', 'indigo', 'cyan', 'emerald', 'rose']);
    document.documentElement.dataset.voxelAccent = supportedAccents.has(accentColor) ? accentColor : 'violet';
  }, [accentColor]);

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reducedMotion);
  }, [reducedMotion]);

  useEffect(() => {
    let restoredTimer;
    const handleOffline = () => {
      window.clearTimeout(restoredTimer);
      setNetworkStatus('offline');
    };
    const handleOnline = () => {
      setNetworkStatus('restored');
      window.clearTimeout(restoredTimer);
      restoredTimer = window.setTimeout(() => setNetworkStatus('online'), 4_000);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      window.clearTimeout(restoredTimer);
    };
  }, []);

  return (
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'}>
    <ErrorBoundary>
      {networkStatus !== 'online' && (
        <div
          role={networkStatus === 'offline' ? 'alert' : 'status'}
          aria-live={networkStatus === 'offline' ? 'assertive' : 'polite'}
          className={`pointer-events-none fixed inset-x-0 bottom-4 z-[100] mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-2 rounded-full border px-4 py-2.5 text-xs font-semibold shadow-xl backdrop-blur-xl ${networkStatus === 'offline'
            ? 'border-rose-200 bg-rose-50/95 text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/95 dark:text-rose-100'
            : 'border-emerald-200 bg-emerald-50/95 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-950/95 dark:text-emerald-100'
          }`}
        >
          {networkStatus === 'offline' ? <WifiOff size={15} aria-hidden="true" /> : <Wifi size={15} aria-hidden="true" />}
          {networkStatus === 'offline'
            ? 'You are offline. Changes may not sync until your connection returns.'
            : 'Connection restored. Voxel is reconnecting to sync.'}
        </div>
      )}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          <Route path="/change-email" element={<EmailChangePage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<PasswordResetPage />} />
          <Route path="/invite/:token" element={<PublicInvitePage />} />
          <Route path="/share/:token" element={<SharedDashboardPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/workspaces" element={<WorkspacesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route
                path="/workspaces/:workspaceId/dashboards"
                element={<WorkspaceDashboardsPage />}
              />

              <Route
                path="/workspaces/:workspaceId/dashboards/:dashboardId"
                element={<EditorPage />}
              />
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
    </MotionConfig>
  );
}
