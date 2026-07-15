import { request } from '@/lib/http';

export interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly icon: string;
  readonly accentColor: string;
  readonly role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'COMMENTER' | 'VIEWER';
  readonly updatedAt: string;
}

export interface Dashboard {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  readonly scene: unknown;
  readonly version: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export const workspaceService = {
  list: (): Promise<readonly Workspace[]> => request('/api/v1/workspaces'),
  create: (input: { name: string; description?: string | undefined }): Promise<Workspace> =>
    request('/api/v1/workspaces', { method: 'POST', body: JSON.stringify(input) }),
  dashboards: (workspaceId: string): Promise<readonly Dashboard[]> =>
    request(`/api/v1/workspaces/${workspaceId}/dashboards`),
  createDashboard: (
    workspaceId: string,
    input: { name: string; description?: string | undefined },
  ): Promise<Dashboard> =>
    request(`/api/v1/workspaces/${workspaceId}/dashboards`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  dashboard: (dashboardId: string): Promise<Dashboard> =>
    request(`/api/v1/dashboards/${dashboardId}`),
  updateDashboard: (
    dashboardId: string,
    input: { name?: string; description?: string | null; scene?: unknown; version: number },
  ): Promise<Dashboard> =>
    request(`/api/v1/dashboards/${dashboardId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  update: (
    workspaceId: string,
    input: { name?: string; description?: string | null },
  ): Promise<Workspace> =>
    request(`/api/v1/workspaces/${workspaceId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  delete: (workspaceId: string): Promise<{ id: string; deleted: boolean }> =>
    request(`/api/v1/workspaces/${workspaceId}`, { method: 'DELETE' }),
};
