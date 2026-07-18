import { request } from '@/lib/http';

export const workspaceService = {
  list: () => request('/api/v1/workspaces'),
  create: (input) => request('/api/v1/workspaces', { method: 'POST', body: JSON.stringify(input) }),
  dashboards: (workspaceId) => request(`/api/v1/workspaces/${workspaceId}/dashboards`),
  createDashboard: (workspaceId, input) =>
    request(`/api/v1/workspaces/${workspaceId}/dashboards`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  dashboard: (dashboardId) => request(`/api/v1/dashboards/${dashboardId}`),
  updateDashboard: (dashboardId, input) =>
    request(`/api/v1/dashboards/${dashboardId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  update: (workspaceId, input) =>
    request(`/api/v1/workspaces/${workspaceId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  delete: (workspaceId) => request(`/api/v1/workspaces/${workspaceId}`, { method: 'DELETE' }),
  deleteDashboard: (dashboardId) =>
    request(`/api/v1/dashboards/${dashboardId}`, { method: 'DELETE' }),
  versions: (dashboardId) => request(`/api/v1/dashboards/${dashboardId}/versions`),
};
