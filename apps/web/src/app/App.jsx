import { useEffect, lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useThemeStore } from '@/store/theme-store';
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

export default function App() {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
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
  );
}
