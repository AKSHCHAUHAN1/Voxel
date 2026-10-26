import { expect, test } from '@playwright/test';

let dashboardId;

test.afterEach(async ({ page }) => {
  if (!dashboardId) return;
  await page.evaluate(async (id) => {
    const response = await fetch(`/api/v1/dashboards/${id}`, { method: 'DELETE' });
    if (response.status === 404) return;
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(`The large-dashboard test fixture could not be cleaned up (${response.status}): ${payload?.error?.message || 'unknown error'}`);
    }
  }, dashboardId);
  dashboardId = undefined;
});

test('a 500-widget dashboard stays virtualized and saves edits after reload', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Log in as Guest User' }).click();
  await expect(page).toHaveURL(/\/workspaces$/, { timeout: 10_000 });

  const dashboard = await page.evaluate(async () => {
    const request = async (path, init) => {
      const response = await fetch(path, init);
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error?.message || 'The large-dashboard setup failed.');
      }
      return payload.data;
    };
    const [workspace] = await request('/api/v1/workspaces');
    if (!workspace) throw new Error('The test account has no workspace.');

    const dashboard = await request(`/api/v1/workspaces/${workspace.id}/dashboards`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: '500 Widget Performance Profile' }),
    });
    const scene = {
      schemaVersion: 2,
      gridStyle: 'dots',
      nodes: Array.from({ length: 500 }, (_, index) => ({
        id: `profile-node-${index}`,
        type: 'metric',
        title: `Profile node ${index}`,
        content: String(index),
        unit: '',
        size: 'medium',
        color: 'cyan',
        x: 40 + (index % 20) * 340,
        y: 40 + Math.floor(index / 20) * 220,
      })),
      connections: [],
    };
    await request(`/api/v1/dashboards/${dashboard.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scene, version: dashboard.version }),
    });
    return { id: dashboard.id, workspaceId: workspace.id };
  });
  dashboardId = dashboard.id;

  const startedAt = Date.now();
  await page.goto(`/workspaces/${dashboard.workspaceId}/dashboards/${dashboard.id}`);
  const canvas = page.getByRole('group', { name: /Canvas widgets/ });
  await expect(canvas).toHaveAttribute('data-total-widget-count', '500', { timeout: 15_000 });
  await expect(canvas).toHaveAttribute('data-viewport-ready', 'true');
  const firstRenderedWidget = page.locator('[data-canvas-widget]').first();
  await expect(firstRenderedWidget).toBeVisible();

  const renderedWidgetCount = Number(await canvas.getAttribute('data-rendered-widget-count'));
  const loadDurationMs = Date.now() - startedAt;
  expect(renderedWidgetCount).toBeGreaterThan(0);
  expect(renderedWidgetCount).toBeLessThan(500);
  const viewportGeometry = await page.evaluate(() => {
    const scrollport = document.querySelector('.no-scrollbars');
    const pane = scrollport?.closest('main');
    const paneBounds = pane?.getBoundingClientRect();
    return {
      browser: { width: window.innerWidth, height: window.innerHeight },
      canvasScrollport: { width: scrollport?.clientWidth, height: scrollport?.clientHeight },
      editorPane: { width: paneBounds?.width, height: paneBounds?.height },
    };
  });
  expect(viewportGeometry.canvasScrollport.width).toBe(viewportGeometry.editorPane.width);
  expect(viewportGeometry.canvasScrollport.height).toBe(viewportGeometry.editorPane.height);
  const profile = {
    widgets: 500,
    renderedWidgetCount,
    loadDurationMs,
    viewport: page.viewportSize(),
    viewportGeometry,
    userAgent: await page.evaluate(() => navigator.userAgent),
    environment: 'Local Playwright development server; not a production-like release measurement',
  };
  console.info(`[voxel-large-dashboard-profile] ${JSON.stringify(profile)}`);
  await test.info().attach('large-dashboard-profile.json', {
    body: JSON.stringify(profile, null, 2),
    contentType: 'application/json',
  });

  const editedWidgetId = await firstRenderedWidget.getAttribute('data-canvas-widget');
  expect(editedWidgetId).toBeTruthy();
  await firstRenderedWidget.click();
  await page.getByLabel('Value').first().fill('saved-after-large-scene-load');
  await expect
    .poll(
      () => page.evaluate(async ({ id, widgetId }) => {
        const response = await fetch(`/api/v1/dashboards/${id}`);
        const payload = await response.json();
        return payload.success
          ? payload.data.scene.nodes.find((node) => node.id === widgetId)?.content
          : null;
      }, { id: dashboard.id, widgetId: editedWidgetId }),
      { timeout: 12_000, intervals: [250, 500, 1000] },
    )
    .toBe('saved-after-large-scene-load');

  await page.reload();
  await expect(canvas).toHaveAttribute('data-total-widget-count', '500', { timeout: 15_000 });
  await expect(page.locator('[data-canvas-widget]').first()).toBeVisible();
  await expect
    .poll(
      () => page.evaluate(async ({ id, widgetId }) => {
        const response = await fetch(`/api/v1/dashboards/${id}`);
        const payload = await response.json();
        return payload.success
          ? payload.data.scene.nodes.find((node) => node.id === widgetId)?.content
          : null;
      }, { id: dashboard.id, widgetId: editedWidgetId }),
    )
    .toBe('saved-after-large-scene-load');
});
