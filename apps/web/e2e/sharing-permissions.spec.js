import { expect, test } from '@playwright/test';

let createdDashboardId;

test.afterEach(async ({ page }) => {
  if (!createdDashboardId) return;
  await page.evaluate(async (id) => {
    const response = await fetch(`/api/v1/dashboards/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('The sharing test dashboard could not be cleaned up.');
  }, createdDashboardId);
  createdDashboardId = undefined;
});

test('view shares redact source details, edit shares save, and revocation takes effect', async ({
  page,
  context,
}) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in as Guest User' }).click();
  await expect(page).toHaveURL(/\/workspaces$/, { timeout: 10_000 });

  const { dashboardId: testDashboardId, viewShare, editShare } = await page.evaluate(async () => {
    const request = async (path, init) => {
      const response = await fetch(path, init);
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || 'A share journey request failed.');
      }
      return payload.data;
    };
    const workspaces = await request('/api/v1/workspaces');
    const workspaceId = workspaces[0]?.id;
    if (!workspaceId) throw new Error('The test account has no workspace.');
    const dashboard = await request(`/api/v1/workspaces/${workspaceId}/dashboards`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Sharing permissions check' }),
    });
    const scene = {
      schemaVersion: 2,
      nodes: [
        {
          id: 'public-metric',
          type: 'metric',
          title: 'Shared revenue',
          content: '42',
          unit: '$',
          size: 'medium',
          color: 'emerald',
          x: 40,
          y: 40,
        },
        {
          id: 'private-source',
          type: 'metric',
          title: 'Private source',
          content: '99',
          unit: '$',
          size: 'medium',
          color: 'violet',
          valueSource: 'rest-api',
          dataSourceUrl: 'https://private.example.test/metrics',
          dataSourceQuery: 'secret-query-field',
          dataRefreshInterval: 30000,
          x: 360,
          y: 40,
        },
      ],
      connections: [],
    };
    await request(`/api/v1/dashboards/${dashboard.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scene, version: dashboard.version }),
    });
    const viewShare = await request(`/api/v1/dashboards/${dashboard.id}/shares`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ permission: 'VIEW', expiresInDays: 1 }),
    });
    const editShare = await request(`/api/v1/dashboards/${dashboard.id}/shares`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ permission: 'EDIT', expiresInDays: 1 }),
    });
    return { dashboardId: dashboard.id, viewShare, editShare };
  });
  createdDashboardId = testDashboardId;

  const viewer = await context.newPage();
  await viewer.goto(viewShare.shareUrl);
  const sharedRevenue = viewer.locator('article').filter({
    has: viewer.getByRole('heading', { name: 'Shared revenue' }),
  });
  await expect(sharedRevenue).toContainText('$42');
  await expect(viewer.getByText(/external REST source/)).toBeVisible();
  const publicScene = await viewer.evaluate(async (token) => {
    const response = await fetch(`/api/v1/shares/${encodeURIComponent(token)}`);
    const payload = await response.json();
    if (!response.ok || !payload.success) throw new Error('The public view share could not be loaded.');
    return payload.data.scene;
  }, new URL(viewShare.shareUrl).pathname.split('/').pop());
  expect(publicScene.nodes[1]).not.toHaveProperty('dataSourceUrl');
  expect(publicScene.nodes[1]).not.toHaveProperty('dataSourceQuery');
  expect(publicScene.nodes[1]).not.toHaveProperty('dataRefreshInterval');

  await viewer.goto(editShare.shareUrl);
  await viewer.getByRole('button', { name: 'Edit dashboard' }).click();
  await viewer.getByLabel('Widget title').first().fill('Revenue edited by a guest');
  await viewer.getByLabel('Value').first().fill('73');
  await viewer.getByRole('button', { name: 'Save changes' }).click();
  await expect(viewer.getByText('Changes saved', { exact: true })).toBeVisible();
  await expect
    .poll(
      () =>
        page.evaluate(async (id) => {
          const response = await fetch(`/api/v1/dashboards/${id}`);
          const payload = await response.json();
          return payload.success ? payload.data.scene.nodes[0] : null;
        }, testDashboardId),
      { timeout: 8_000, intervals: [250, 500, 1000] },
    )
    .toMatchObject({ title: 'Revenue edited by a guest', content: '73' });

  const token = new URL(viewShare.shareUrl).pathname.split('/').pop();
  await page.evaluate(async ({ dashboardId, shareId }) => {
    const response = await fetch(`/api/v1/dashboards/${dashboardId}/shares/${shareId}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('The view share could not be revoked.');
  }, { dashboardId: testDashboardId, shareId: viewShare.id });
  await viewer.goto(`/share/${token}`);
  await expect(viewer.getByRole('heading', { name: 'This share link is unavailable' })).toBeVisible();
});
