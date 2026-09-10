import { expect, test } from '@playwright/test';

/**
 * The only honest test of an error boundary is to break the page and look.
 *
 * Unit tests can assert the fallback component renders given props, but they
 * cannot prove Next actually mounts it when a route throws — that depends on
 * where the `error.tsx` sits in the segment tree, whether it is a client
 * component, and whether the throw happens somewhere a boundary can catch.
 * Every one of those was wrong at some point while writing these.
 *
 * Faults are injected by failing the API the page depends on, rather than by
 * evaluating a throw in the page: that is how these routes fail in production,
 * and a boundary that only catches synthetic throws is not worth having.
 */
test.describe('Error boundaries', () => {
  test('a failing product API renders the boundary, not a blank page', async ({ page }) => {
    await page.route('**/api/v1/products/**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }),
    );

    await page.goto('/product/diamond-halo-ring', { waitUntil: 'domcontentloaded' });

    // Whatever the copy, the page must not be empty and must offer a way out.
    const body = await page.locator('body').innerText();
    expect(body.trim().length).toBeGreaterThan(0);
    await expect(page.getByRole('link', { name: /browse all pieces|continue shopping/i })).toBeVisible();
  });

  test('the boundary offers a working way back into the catalogue', async ({ page }) => {
    await page.route('**/api/v1/products/**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }),
    );
    await page.goto('/product/diamond-halo-ring', { waitUntil: 'domcontentloaded' });

    const escape = page.getByRole('link', { name: /browse all pieces|continue shopping/i }).first();
    await expect(escape).toBeVisible();

    // The route stub is scoped to product endpoints, so the listing recovers.
    await escape.click();
    await expect(page).toHaveURL(/\/collections\/all/);
  });

  test('the storefront chrome survives a route-level failure', async ({ page }) => {
    // The point of a segment boundary rather than a global one: the header,
    // footer and bag stay usable, so a customer is not stranded.
    await page.route('**/api/v1/products/**', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{"message":"boom"}' }),
    );

    await page.goto('/product/diamond-halo-ring', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('link', { name: 'ELYSIAN' }).first()).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
  });

  test('a 404 still renders the custom not-found page with its chrome', async ({ page }) => {
    await page.goto('/product/no-such-product-anywhere', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /page not found/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'ELYSIAN' }).first()).toBeVisible();
  });
});
