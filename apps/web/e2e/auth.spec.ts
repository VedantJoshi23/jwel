import { expect, test } from '@playwright/test';

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@e2e.jwel.local`;
}

test.describe('Authentication', () => {
  test('a new visitor can register and lands on their profile', async ({ page }) => {
    const email = uniqueEmail('e2e-register');
    await page.goto('/register');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('a-strong-password');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/profile/);
  });

  test('registering with an already-used email shows an error, not a silent failure', async ({ page }) => {
    const email = uniqueEmail('e2e-dupe');
    await page.goto('/register');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('a-strong-password');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/profile/);

    await page.goto('/register');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('a-strong-password');
    await page.getByRole('button', { name: 'Create account' }).click();
    // Next.js's own route announcer also has role="alert" — scope to the
    // form's actual error message text, not just the ARIA role.
    await expect(page.getByText('An account with this email already exists')).toBeVisible();
    await expect(page).toHaveURL(/\/register/);
  });

  test('logging in with the wrong password shows an error and does not navigate away', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('nobody-real@e2e.jwel.local');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page.getByText('Invalid email or password')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('a registered user can log back in', async ({ page }) => {
    const email = uniqueEmail('e2e-login');
    await page.goto('/register');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('a-strong-password');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/profile/);

    // Logging back in proves the session was actually persisted server-side
    // (the account exists in Postgres), not just held in this page's memory.
    await page.evaluate(() => localStorage.clear());
    await page.goto('/login');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('a-strong-password');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/profile/);
  });
});
