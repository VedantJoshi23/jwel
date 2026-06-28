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
    await expect(page).toHaveURL('http://localhost:3000/');
  });

  test('unauthenticated direct access to an admin sub-route also redirects', async ({ page }) => {
    await page.goto('/admin/products');
    await expect(page).toHaveURL(/\/login\?next=\/admin/);
  });
});
