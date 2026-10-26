import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('two editor sessions share presence and persist each other’s scene changes', async ({
  page,
  context,
}) => {
  const displayName = 'Voxel Collaboration Test';
  const email = `voxel-collab-${randomUUID()}@example.test`;

  await page.goto('/login?mode=signup');
  await page.getByLabel('Full Name').fill(displayName);
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('StrongPassword123');
  await page
    .getByRole('textbox', { name: 'Confirm Password', exact: true })
    .fill('StrongPassword123');
  await page.getByRole('button', { name: 'Create Free Account' }).click();
  await page
    .getByRole('link', { name: 'Open the development verification link' })
    .click();
  await page.getByRole('button', { name: 'Verify email and open Voxel' }).click();
  await expect(page).toHaveURL(/\/workspaces$/);

  const { workspaceId, dashboardId } = await page.evaluate(async () => {
    const workspacesResponse = await fetch('/api/v1/workspaces');
    const workspacesPayload = await workspacesResponse.json();
    if (!workspacesResponse.ok || !workspacesPayload.success) {
      throw new Error('The test account workspace could not be loaded.');
    }
    const workspaceId = workspacesPayload.data[0]?.id;
    if (!workspaceId) throw new Error('The test account has no workspace.');

    const dashboardResponse = await fetch(`/api/v1/workspaces/${workspaceId}/dashboards`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Realtime collaboration check' }),
    });
    const dashboardPayload = await dashboardResponse.json();
    if (!dashboardResponse.ok || !dashboardPayload.success) {
      throw new Error('The realtime test dashboard could not be created.');
    }
    return { workspaceId, dashboardId: dashboardPayload.data.id };
  });

  const secondEditor = await context.newPage();
  const editorPath = `/workspaces/${workspaceId}/dashboards/${dashboardId}`;
  await Promise.all([page.goto(editorPath), secondEditor.goto(editorPath)]);

  await expect(page.getByRole('group', { name: '2 collaborators online' })).toBeVisible({
    timeout: 15_000,
  });
  await expect(secondEditor.getByRole('group', { name: '2 collaborators online' })).toBeVisible({
    timeout: 15_000,
  });

  await page.getByRole('button', { name: /Metric Node/ }).click();
  await expect(secondEditor.getByText('Monthly Goal', { exact: true })).toBeVisible();
  await secondEditor.getByRole('button', { name: /Annotation Note/ }).click();
  await expect(page.getByRole('heading', { name: 'Untitled Note' })).toBeVisible();

  await expect
    .poll(
      async () =>
        page.evaluate(async (id) => {
          const response = await fetch(`/api/v1/dashboards/${id}`);
          if (!response.ok) return null;
          const payload = await response.json();
          return payload.success ? payload.data.scene.nodes.length : null;
        }, dashboardId),
      { timeout: 15_000, intervals: [250, 500, 1000] },
    )
    .toBe(2);
});
