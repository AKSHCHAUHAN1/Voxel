import { expect, test } from '@playwright/test';

test('signup fields have accessible names and mismatched passwords are announced', async ({ page }) => {
  let signupRequests = 0;
  await page.route('**/api/v1/auth/signup', async (route) => {
    signupRequests += 1;
    await route.fulfill({
      status: 201,
      json: {
        success: true,
        data: {
          email: 'alex@example.com',
          verificationRequired: true,
          verificationUrl: 'http://127.0.0.1:4173/verify-email?token=development-token',
        },
      },
    });
  });

  await page.goto('/login?mode=signup');

  const name = page.getByRole('textbox', { name: 'Full Name' });
  const email = page.getByRole('textbox', { name: 'Email Address' });
  const password = page.getByRole('textbox', { name: 'Password', exact: true });
  const confirmPassword = page.getByRole('textbox', { name: 'Confirm Password', exact: true });

  await expect(name).toBeVisible();
  await expect(email).toBeVisible();
  await expect(password).toBeVisible();
  await expect(confirmPassword).toBeVisible();

  await name.fill('Alex Rivers');
  await email.fill('alex@example.com');
  await password.fill('StrongPassword123');
  await confirmPassword.fill('DifferentPassword123');
  await page.getByRole('button', { name: 'Create Free Account' }).click();

  await expect(page.getByRole('alert')).toContainText('Passwords do not match.');
  expect(signupRequests).toBe(0);
});

test('successful signup explains the email verification step', async ({ page }) => {
  await page.route('**/api/v1/auth/signup', async (route) => {
    const request = route.request().postDataJSON();
    expect(request).toEqual({
      email: 'alex@example.com',
      password: 'StrongPassword123',
      displayName: 'Alex Rivers',
    });
    await route.fulfill({
      status: 201,
      json: {
        success: true,
        data: {
          email: request.email,
          verificationRequired: true,
          verificationUrl: 'http://127.0.0.1:4173/verify-email?token=development-token',
        },
      },
    });
  });

  await page.goto('/login?mode=signup');
  await page.getByLabel('Full Name').fill('Alex Rivers');
  await page.getByLabel('Email Address').fill('alex@example.com');
  await page.getByRole('textbox', { name: 'Password', exact: true }).fill('StrongPassword123');
  await page.getByRole('textbox', { name: 'Confirm Password', exact: true }).fill('StrongPassword123');
  await page.getByRole('button', { name: 'Create Free Account' }).click();

  await expect(page.getByRole('status')).toContainText(
    'You need to verify your address before signing in.',
  );
  await expect(
    page.getByRole('link', { name: 'Open the development verification link' }),
  ).toHaveAttribute(
    'href',
    'http://127.0.0.1:4173/verify-email?token=development-token',
  );
});
