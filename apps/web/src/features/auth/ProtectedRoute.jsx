import { Navigate, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { authService } from './auth-service';
import { PageLoader } from '@/components/feedback/PageLoader';

export function ProtectedRoute() {
  const query = useQuery({ queryKey: ['auth', 'me'], queryFn: authService.me, retry: false });
  if (query.isPending) return <PageLoader />;
  if (query.isError) return <Navigate to="/login" replace />;
  return <Outlet context={{ user: query.data }} />;
}
