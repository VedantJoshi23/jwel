import { expect, test } from '@playwright/test';

test.describe('Admin Portal RBAC', () => {
  test('an unauthenticated visitor is redirected from /admin to /login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login\?next=\/admin/);
  });

  test('a logged-in CUSTOMER is redirected away from /admin (not shown a flash of admin content)', async ({ page }) => {
    const email = `e2e-customer-${Date.now()}@e2e.jwel.local`;
    await page.goto('/register');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('a-strong-password');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/profile/);

    await page.goto('/admin');
    // Relative, not absolute: an absolute origin breaks the moment the suite
    // runs against anything but the default port (E2E_BASE_URL exists
    // precisely so it can).
    await expect(page).toHaveURL('/');
  });

  test('unauthenticated direct access to an admin sub-route also redirects', async ({ page }) => {
    await page.goto('/admin/products');
    await expect(page).toHaveURL(/\/login\?next=\/admin/);
  });
});
