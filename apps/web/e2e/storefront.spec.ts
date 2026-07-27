import { expect, test } from '@playwright/test';

test.describe('Storefront browsing', () => {
  test('homepage loads and shows the site header/footer', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'ELYSIAN' }).first()).toBeVisible();
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

  // `waitUntil: 'domcontentloaded'` rather than the default 'load'. The PDP's
  // hero image is rendered with next/image `priority`, so it is preloaded and
  // the `load` event blocks on it. On the CI runner that optimizer request
  // (`/_next/image?url=…&w=640&q=75`) intermittently never completes — a trace
  // from a failing run shows it as the single outstanding request, status -1,
  // while every other resource is 200 and the page has fully rendered.
  //
  // Which image it is depends on the product's UUID (`getProductStockImage`
  // hashes it), and CI generates a fresh UUID each run, so this failed on 3 of
  // the first 4 runs and passed on the other — it is a lottery, not a
  // regression. It does not reproduce locally, including with a cold image
  // cache pinned to 2 cores; sharp resizes the largest of these images in
  // ~150ms, so plain CPU slowness does not explain a 30s hang.
  //
  // The assertions below are unchanged and still prove SSR served real product
  // data. What is dropped is a dependency on the image optimizer, which is not
  // what these tests are about. The optimizer hang itself is real and unexplained
  // — tracked in the Milestone 12 doc, since it would also stall a first-time
  // visitor's product page in production.
  test('browsing to a known product slug shows its detail page', async ({ page }) => {
    await page.goto('/product/diamond-halo-ring', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Diamond Halo Ring' })).toBeVisible();
  });

  test('a nonexistent product slug renders a 404', async ({ page }) => {
    const response = await page.goto('/product/this-product-does-not-exist-anywhere');
    expect(response?.status()).toBe(404);
  });

  // Same reason as above — this test is about the cart, not the image pipeline.
  test('adding a product to the bag updates the cart and the header badge', async ({ page }) => {
    await page.goto('/product/diamond-halo-ring', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Add to bag' }).click();
    await expect(page.getByRole('status')).toContainText('Added');
    await expect(page.getByLabel(/Shopping bag, 1 item/)).toBeVisible();

    await page.goto('/cart');
    await expect(page.getByText('Diamond Halo Ring')).toBeVisible();
  });
});
