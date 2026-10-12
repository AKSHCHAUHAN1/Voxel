import { request } from '@/lib/http';
import { runtime } from '@/config/runtime';

const uploadFile = (workspaceId, file) => request(`/api/v1/workspaces/${workspaceId}/files`, {
  method: 'POST',
  headers: {
    'content-type': 'application/octet-stream',
    'x-file-name': encodeURIComponent(file.name),
    'x-file-content-type': file.type || 'application/octet-stream',
  },
  body: file,
});

const downloadFile = async (workspaceId, fileId) => {
  const response = await fetch(`${runtime.apiBaseUrl}/api/v1/workspaces/${workspaceId}/files/${fileId}/content`, { credentials: 'include' });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message || 'File could not be downloaded.');
  }
  return response.blob();
};

const uploadCoverImage = (workspaceId, file) => request(`/api/v1/workspaces/${workspaceId}/cover-image`, {
  method: 'POST',
  headers: {
    'content-type': 'application/octet-stream',
    'x-file-name': encodeURIComponent(file.name),
    'x-file-content-type': file.type || 'application/octet-stream',
  },
  body: file,
});

export const workspaceService = {
  pluginCatalog: () => request('/api/v1/marketplace/plugins'),
  plugins: (workspaceId) => request(`/api/v1/workspaces/${workspaceId}/plugins`),
  installPlugin: (workspaceId, pluginId) => request(`/api/v1/workspaces/${workspaceId}/plugins`, { method: 'POST', body: JSON.stringify({ pluginId }) }),
  uninstallPlugin: (workspaceId, pluginId) => request(`/api/v1/workspaces/${workspaceId}/plugins/${encodeURIComponent(pluginId)}`, { method: 'DELETE' }),
  files: (workspaceId) => request(`/api/v1/workspaces/${workspaceId}/files`),
  uploadFile,
  uploadCoverImage,
  downloadFile,
  deleteFile: (workspaceId, fileId) => request(`/api/v1/workspaces/${workspaceId}/files/${fileId}`, { method: 'DELETE' }),
  list: ({ includeArchived = false, includeDeleted = false } = {}) => {
    const params = new URLSearchParams();
    if (includeArchived) params.set('includeArchived', 'true');
    if (includeDeleted) params.set('includeDeleted', 'true');
    const query = params.toString();
    return request(`/api/v1/workspaces${query ? `?${query}` : ''}`);
  },
  create: (input) => request('/api/v1/workspaces', { method: 'POST', body: JSON.stringify(input) }),
  dashboards: (workspaceId, { includeDeleted = false } = {}) => request(`/api/v1/workspaces/${workspaceId}/dashboards${includeDeleted ? '?includeDeleted=true' : ''}`),
  templates: (workspaceId) => request(`/api/v1/workspaces/${workspaceId}/templates`),
  createTemplate: (workspaceId, input) => request(`/api/v1/workspaces/${workspaceId}/templates`, { method: 'POST', body: JSON.stringify(input) }),
  updateTemplate: (workspaceId, templateId, input) => request(`/api/v1/workspaces/${workspaceId}/templates/${templateId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  favoriteTemplate: (workspaceId, templateId, isFavorite) => request(`/api/v1/workspaces/${workspaceId}/templates/${templateId}/favorite`, { method: 'PATCH', body: JSON.stringify({ isFavorite }) }),
  useTemplate: (workspaceId, templateId, input) => request(`/api/v1/workspaces/${workspaceId}/templates/${templateId}/use`, { method: 'POST', body: JSON.stringify(input) }),
  createDashboard: (workspaceId, input) =>
    request(`/api/v1/workspaces/${workspaceId}/dashboards`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  importDashboard: (workspaceId, input) =>
    request(`/api/v1/workspaces/${workspaceId}/dashboards/import`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  dashboard: (dashboardId) => request(`/api/v1/dashboards/${dashboardId}`),
  updateDashboard: (dashboardId, input) =>
    request(`/api/v1/dashboards/${dashboardId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  updateDashboardStatus: (dashboardId, status) => request(`/api/v1/dashboards/${dashboardId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  duplicateDashboard: (dashboardId) => request(`/api/v1/dashboards/${dashboardId}/duplicate`, { method: 'POST', body: JSON.stringify({}) }),
  moveDashboard: (dashboardId, workspaceId) => request(`/api/v1/dashboards/${dashboardId}/move`, { method: 'POST', body: JSON.stringify({ workspaceId }) }),
  updateDashboardPreferences: (dashboardId, input) => request(`/api/v1/dashboards/${dashboardId}/preferences`, { method: 'PATCH', body: JSON.stringify(input) }),
  update: (workspaceId, input) =>
    request(`/api/v1/workspaces/${workspaceId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  archive: (workspaceId) => request(`/api/v1/workspaces/${workspaceId}/archive`, { method: 'POST', body: JSON.stringify({}) }),
  restore: (workspaceId) => request(`/api/v1/workspaces/${workspaceId}/restore`, { method: 'POST', body: JSON.stringify({}) }),
  recoverWorkspace: (workspaceId) => request(`/api/v1/workspaces/${workspaceId}/recover`, { method: 'POST', body: JSON.stringify({}) }),
  delete: (workspaceId) => request(`/api/v1/workspaces/${workspaceId}`, { method: 'DELETE' }),
  duplicate: (workspaceId) => request(`/api/v1/workspaces/${workspaceId}/duplicate`, { method: 'POST', body: JSON.stringify({}) }),
  leave: (workspaceId) => request(`/api/v1/workspaces/${workspaceId}/leave`, { method: 'POST', body: JSON.stringify({}) }),
  transferOwnership: (workspaceId, memberId) => request(`/api/v1/workspaces/${workspaceId}/transfer-ownership`, { method: 'POST', body: JSON.stringify({ memberId }) }),
  updatePreferences: (workspaceId, input) => request(`/api/v1/workspaces/${workspaceId}/preferences`, { method: 'PATCH', body: JSON.stringify(input) }),
  members: (workspaceId) => request(`/api/v1/workspaces/${workspaceId}/members`),
  updateMember: (workspaceId, memberId, input) => request(`/api/v1/workspaces/${workspaceId}/members/${memberId}`, { method: 'PATCH', body: JSON.stringify(input) }),
  removeMember: (workspaceId, memberId) => request(`/api/v1/workspaces/${workspaceId}/members/${memberId}`, { method: 'DELETE' }),
  createInvite: (workspaceId, input) => request(`/api/v1/workspaces/${workspaceId}/invites`, { method: 'POST', body: JSON.stringify(input) }),
  invites: (workspaceId) => request(`/api/v1/workspaces/${workspaceId}/invites`),
  revokeInvite: (workspaceId, inviteId) => request(`/api/v1/workspaces/${workspaceId}/invites/${inviteId}`, { method: 'DELETE' }),
  invite: (token) => request(`/api/v1/invites/${encodeURIComponent(token)}`),
  acceptInvite: (token) => request(`/api/v1/invites/${encodeURIComponent(token)}/accept`, { method: 'POST', body: JSON.stringify({}) }),
  deleteDashboard: (dashboardId) =>
    request(`/api/v1/dashboards/${dashboardId}`, { method: 'DELETE' }),
  recoverDashboard: (dashboardId) => request(`/api/v1/dashboards/${dashboardId}/recover`, { method: 'POST', body: JSON.stringify({}) }),
  versions: (dashboardId) => request(`/api/v1/dashboards/${dashboardId}/versions`),
  comments: (dashboardId) => request(`/api/v1/dashboards/${dashboardId}/comments`),
  createComment: (dashboardId, input) => request(`/api/v1/dashboards/${dashboardId}/comments`, { method: 'POST', body: JSON.stringify(typeof input === 'string' ? { body: input } : input) }),
  updateComment: (dashboardId, commentId, body) => request(`/api/v1/dashboards/${dashboardId}/comments/${commentId}`, { method: 'PATCH', body: JSON.stringify({ body }) }),
  resolveComment: (dashboardId, commentId, resolved) => request(`/api/v1/dashboards/${dashboardId}/comments/${commentId}/resolution`, { method: 'PATCH', body: JSON.stringify({ resolved }) }),
  deleteComment: (dashboardId, commentId) => request(`/api/v1/dashboards/${dashboardId}/comments/${commentId}`, { method: 'DELETE' }),
  workspaceComments: (workspaceId) => request(`/api/v1/workspaces/${workspaceId}/comments`),
  auditEvents: (workspaceId) => request(`/api/v1/workspaces/${workspaceId}/audit-events`),
  activity: (workspaceId) => request(`/api/v1/workspaces/${workspaceId}/activity`),
  createShare: (dashboardId, input) => request(`/api/v1/dashboards/${dashboardId}/shares`, { method: 'POST', body: JSON.stringify(input) }),
  shares: (dashboardId) => request(`/api/v1/dashboards/${dashboardId}/shares`),
  revokeShare: (dashboardId, shareId) => request(`/api/v1/dashboards/${dashboardId}/shares/${shareId}`, { method: 'DELETE' }),
  sharedDashboard: (token) => request(`/api/v1/shares/${encodeURIComponent(token)}`),
  updateSharedDashboard: (token, input) => request(`/api/v1/shares/${encodeURIComponent(token)}`, { method: 'PATCH', body: JSON.stringify(input) }),
};
