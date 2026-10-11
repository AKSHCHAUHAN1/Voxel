import { useEffect, lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { useThemeStore } from '@/store/theme-store';
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

export default function App() {
  const theme = useThemeStore((s) => s.theme);
  const reducedMotion = useSettingsStore((s) => s.reducedMotion);

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const applyTheme = () => document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && media.matches));
    applyTheme();
    if (theme !== 'system') return undefined;
    media.addEventListener('change', applyTheme);
    return () => media.removeEventListener('change', applyTheme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reducedMotion);
  }, [reducedMotion]);

  return (
    <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'}>
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
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
