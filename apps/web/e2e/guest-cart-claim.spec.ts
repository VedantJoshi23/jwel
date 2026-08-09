import { expect, test, type Page } from '@playwright/test';

/**
 * `DOM-SHOPPING` Invariants 6, 12 and 17 — a guest bag meeting an account bag
 * at sign-in.
 *
 * This is the journey the invariants were written for and the one nothing
 * could exercise while the cart lived in `localStorage`: there was no account
 * bag for a guest bag to meet.
 */
const PASSWORD = 'a-strong-password';
const PRODUCT = 'diamond-halo-ring';

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@e2e.jwel.local`;
}

async function settle(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => {});
}

async function addToBag(page: Page): Promise<void> {
  await page.goto(`/product/${PRODUCT}`, { waitUntil: 'domcontentloaded' });
  await settle(page);
  const bag = page.locator('a[href="/cart"]').first();
  await expect(async () => {
    if ((await bag.getAttribute('aria-label'))?.includes('0 items')) {
      await page.getByRole('button', { name: 'Add to bag' }).click();
    }
    await expect(bag).toHaveAttribute('aria-label', /Shopping bag, 1 item/, { timeout: 2_000 });
  }).toPass({ timeout: 20_000 });
}

test.describe('A guest bag meeting an account bag', () => {
  test('is asked about, not silently resolved', async ({ page }) => {
    const email = uniqueEmail('e2e-claim');

    // An account with a bag of its own.
    await page.goto('/register');
    await settle(page);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/profile/);
    await addToBag(page);

    // Sign out and build a different bag as a guest, in the same browser.
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page.getByLabel('Log in')).toBeVisible();
    // A fresh guest identity, so this is a genuinely new bag rather than the
    // one this browser may already have had.
    await page.evaluate(() => localStorage.removeItem('jwel-guest-cart'));
    await addToBag(page);

    // Sign back in — two bags now exist for the same person.
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await settle(page);
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/profile/);

    // Invariant 12 — asked, not decided for.
    await expect(page.getByText('You have two bags')).toBeVisible();

    // Invariant 17 — the label has to say which bag survives, because both
    // belong to this person.
    await expect(
      page.getByRole('button', { name: /Keep the bag I was just building/ }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Keep both' }).click();
    await expect(page.getByText('You have two bags')).toHaveCount(0);

    // Both pieces survived the merge.
    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    await settle(page);
    await expect(page.getByLabel(/Shopping bag, 2 items/)).toBeVisible();
  });
});
