import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';

test('a new member verifies email and reaches their protected workspace', async ({ page }) => {
  const displayName = 'Voxel Browser Test';
  const email = `voxel-e2e-${randomUUID()}@example.test`;

  await page.goto('/login?mode=signup');
  await page.getByLabel('Full Name').fill(displayName);
  await page.getByLabel('Email Address').fill(email);
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('StrongPassword123');
  await page
    .getByRole('textbox', { name: 'Confirm Password', exact: true })
    .fill('StrongPassword123');
  await page.getByRole('button', { name: 'Create Free Account' }).click();

  await expect(page.getByRole('status')).toContainText(
    'You need to verify your address before signing in.',
  );
  await page.getByRole('link', { name: 'Open the development verification link' }).click();
  await expect(page.getByRole('heading', { name: 'Verify your email' })).toBeVisible();
  await page.getByRole('button', { name: 'Verify email and open Voxel' }).click();

  await expect(page).toHaveURL(/\/workspaces$/);
  await expect(page.getByRole('heading', { name: 'Workspaces' })).toBeVisible();
  await expect(page.getByRole('heading', { name: `${displayName}'s Workspace` })).toBeVisible();
});
