import { expect, test } from '@playwright/test';

test.describe('Storefront browsing', () => {
  // `waitUntil: 'domcontentloaded'` rather than the default 'load' — same
  // reasoning and same fix as the PDP navigations below. The homepage has its
  // own `priority`-loaded hero image (app/page.tsx), so it is exposed to the
  // identical unresolved `/_next/image` optimizer hang documented in
  // milestone-12 (an outstanding request that intermittently never resolves
  // on the CI runner). Surfaced here for the first time not because the
  // homepage changed, but because which stock image gets hashed to `priority`
  // is randomized per fresh CI database — this run's draw happened to hang.
  test('homepage loads and shows the site header/footer', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('link', { name: 'ELYSIAN' }).first()).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
  });

  test('searching for a known seeded product surfaces it in results', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
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
    // Scoped: the demo-mode banner (NEXT_PUBLIC_DEMO_MODE=true) also carries
    // role="status", so a bare getByRole('status') is a strict-mode
    // violation against a demo deployment.
    await expect(page.getByRole('status').filter({ hasText: 'to your bag' })).toBeVisible();
    await expect(page.getByLabel(/Shopping bag, 1 item/)).toBeVisible();

    await page.goto('/cart');
    await expect(page.getByText('Diamond Halo Ring')).toBeVisible();
  });
});

/**
 * The product breadcrumb. Its category link used to be built from the
 * category's display name — "Bracelets & Bangles" became
 * /collections/bracelets & bangles — and the collection route rendered any
 * slug at all, so the link opened an empty grid titled with the encoded URL,
 * with a 200. Found on the live site, 2026-09-11.
 *
 * The category-link test uses a seeded product in a multi-word category (see
 * seed.ts); the others take whichever product the catalogue lists first.
 */
test.describe('Product breadcrumb', () => {
  async function openAProduct(page: import('@playwright/test').Page) {
    await page.goto('/collections/all', { waitUntil: 'domcontentloaded' });
    const href = await page.locator('main a[href^="/product/"]').first().getAttribute('href');
    expect(href, 'the catalogue needs at least one product').toBeTruthy();
    await page.goto(href!, { waitUntil: 'domcontentloaded' });
    return page.getByRole('navigation', { name: 'Breadcrumb' });
  }

  test('the category link opens that category, with products in it', async ({ page }) => {
    // A seeded product in a multi-word category on purpose: lower-casing
    // "Rings" happens to produce its slug, so a single-word category would
    // pass against the very bug this guards.
    await page.goto('/product/pearl-drop-pendant', { waitUntil: 'domcontentloaded' });
    const categoryLink = page.getByRole('navigation', { name: 'Breadcrumb' }).getByRole('link', {
      name: 'Necklaces & Pendants',
    });
    const href = await categoryLink.getAttribute('href');

    expect(href).toBe('/collections/necklaces-and-pendants');

    // The link is a client-side navigation (an RSC fetch, not a document
    // load), so the status is checked with a direct request.
    expect((await page.request.get(href!)).status()).toBe(200);

    await categoryLink.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Necklaces & Pendants');
    await expect(page.locator('main a[href="/product/pearl-drop-pendant"]').first()).toBeVisible();
  });

  test('the current page is marked as such, not dressed as a link', async ({ page }) => {
    const breadcrumb = await openAProduct(page);
    const current = breadcrumb.locator('[aria-current="page"]');

    await expect(current).toHaveCount(1);
    expect(await current.evaluate((el) => el.closest('a'))).toBeNull();
    expect(await current.evaluate((el) => getComputedStyle(el).textDecorationLine)).toBe('none');
  });

  test('an unknown collection address is a real 404, not an empty page', async ({ page }) => {
    const response = await page.goto('/collections/no-such-collection-anywhere', { waitUntil: 'domcontentloaded' });

    expect(response?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: /page not found/i })).toBeVisible();
  });
});
