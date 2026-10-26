import { expect, test } from '@playwright/test';

let dashboardId;
let ownerPage;
let clientContexts = [];

test.setTimeout(120_000);

test.afterEach(async () => {
  try {
    if (dashboardId && ownerPage && !ownerPage.isClosed()) {
      const result = await ownerPage.evaluate(async (id) => {
        const response = await fetch(`/api/v1/dashboards/${id}`, { method: 'DELETE' });
        if (response.status === 404) return { ok: true };
        if (response.ok) return { ok: true };
        const payload = await response.json().catch(() => null);
        return { ok: false, status: response.status, message: payload?.error?.message };
      }, dashboardId);
      if (!result.ok) {
        throw new Error(`The realtime load-test dashboard could not be cleaned up (${result.status}): ${result.message || 'unknown error'}`);
      }
    }
  } finally {
    await Promise.all(clientContexts.map((context) => context.close().catch(() => {})));
    dashboardId = undefined;
    ownerPage = undefined;
    clientContexts = [];
  }
});

test('25 dashboard sessions stay present and receive a durable edit', async ({ browser }) => {
  for (let index = 0; index < 25; index += 1) {
    clientContexts.push(await browser.newContext({
      extraHTTPHeaders: { 'x-forwarded-for': `198.51.100.${index + 1}` },
    }));
  }
  const editors = await Promise.all(clientContexts.map((context) => context.newPage()));
  ownerPage = editors[0];

  const guestLoginButton = (editor) => editor.getByRole('button', { name: 'Log in as Guest User' });
  await editors[0].goto('/login');
  await expect(guestLoginButton(editors[0])).toBeVisible({ timeout: 15_000 });
  await guestLoginButton(editors[0]).click({ timeout: 15_000 });
  await expect(editors[0]).toHaveURL(/\/workspaces$/, { timeout: 15_000 });

  await Promise.all(editors.slice(1).map((editor) =>
    editor.goto('/login', { waitUntil: 'domcontentloaded', timeout: 30_000 }),
  ));
  await Promise.all(editors.slice(1).map((editor) =>
    expect(guestLoginButton(editor)).toBeVisible({ timeout: 15_000 }),
  ));
  await Promise.all(editors.slice(1).map((editor) => guestLoginButton(editor).click({ timeout: 15_000 })));
  await Promise.all(editors.slice(1).map((editor) => expect(editor).toHaveURL(/\/workspaces$/, { timeout: 15_000 })));

  const dashboard = await ownerPage.evaluate(async () => {
    const request = async (path, init) => {
      const response = await fetch(path, init);
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || 'The realtime load-test setup failed.');
      }
      return payload.data;
    };
    const [workspace] = await request('/api/v1/workspaces');
    if (!workspace) throw new Error('The test account has no workspace.');

    const existingDashboards = await request(`/api/v1/workspaces/${workspace.id}/dashboards`);
    for (const existing of existingDashboards.filter((item) => item.name === '25 Collaborator Load Check')) {
      await request(`/api/v1/dashboards/${existing.id}`, { method: 'DELETE' });
    }

    const dashboard = await request(`/api/v1/workspaces/${workspace.id}/dashboards`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '25 Collaborator Load Check' }),
    });
    return { id: dashboard.id, workspaceId: workspace.id };
  });
  dashboardId = dashboard.id;

  const editorPath = `/workspaces/${dashboard.workspaceId}/dashboards/${dashboard.id}`;
  const startedAt = Date.now();
  await Promise.all(editors.map((editor) => editor.goto(editorPath, { waitUntil: 'domcontentloaded' })));

  await expect(ownerPage.getByRole('group', { name: '25 collaborators online' })).toBeVisible({
    timeout: 30_000,
  });
  const connectedAtMs = Date.now() - startedAt;

  const propagationStartedAt = Date.now();
  await ownerPage.getByRole('button', { name: /Metric Node/ }).click();
  await expect(editors.at(-1).getByText('Monthly Goal', { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  const propagationMs = Date.now() - propagationStartedAt;

  await expect
    .poll(
      () => ownerPage.evaluate(async (id) => {
        const response = await fetch(`/api/v1/dashboards/${id}`);
        const payload = await response.json();
        return payload.success ? payload.data.scene.nodes.length : null;
      }, dashboard.id),
      { timeout: 15_000, intervals: [250, 500, 1000] },
    )
    .toBe(1);

  console.info(`[voxel-realtime-load-profile] ${JSON.stringify({
    collaborators: 25,
    connectDurationMs: connectedAtMs,
    editPropagationMs: propagationMs,
    environment: 'Local Playwright development server; 25 synthetic client IPs; not a production-like release measurement',
  })}`);
});
