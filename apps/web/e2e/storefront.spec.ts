import { expect, test } from '@playwright/test';

test.describe('Storefront browsing', () => {
  test('homepage loads and shows the site header/footer', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'GLINT' }).first()).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
  });

  test('searching for a known seeded product surfaces it in results', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Search products').fill('Diamond');
    // The header search box has no visible submit button — pressing Enter
    // in the input is the real user path that triggers the form's onSubmit.
    await page.getByLabel('Search products').press('Enter');
    await expect(page).toHaveURL(/\/search\?q=Diamond/);
    await expect(page.getByText(/Diamond/i).first()).toBeVisible();
  });

  test('browsing to a known product slug shows its detail page', async ({ page }) => {
    await page.goto('/product/diamond-halo-ring');
    await expect(page.getByRole('heading', { name: 'Diamond Halo Ring' })).toBeVisible();
  });

  test('a nonexistent product slug renders a 404', async ({ page }) => {
    const response = await page.goto('/product/this-product-does-not-exist-anywhere');
    expect(response?.status()).toBe(404);
  });

  test('adding a product to the bag updates the cart and the header badge', async ({ page }) => {
    await page.goto('/product/diamond-halo-ring');
    await page.getByRole('button', { name: 'Add to bag' }).click();
    await expect(page.getByRole('status')).toContainText('Added');
    await expect(page.getByLabel(/Shopping bag, 1 item/)).toBeVisible();

    await page.goto('/cart');
    await expect(page.getByText('Diamond Halo Ring')).toBeVisible();
  });
});
