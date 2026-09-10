import { expect, test } from '@playwright/test';

/**
 * The only honest test of an error boundary is to break the page and look —
 * and doing that is harder than it first appears, in a way worth recording.
 *
 * The storefront's risky routes are **server components**. Their data fetch
 * happens inside the Next server process, so `page.route` cannot intercept
 * it: Playwright sees only the browser's requests. An earlier version of this
 * file stubbed `**\/api/v1/products/**` and proved nothing, because that
 * request is never made by the browser on a full page load.
 *
 * What actually triggers these boundaries is the API being unreachable from
 * the *server*, which is an environment condition rather than something a
 * test can stub. So the API-down checks below are opt-in: they need a web
 * server started against a dead API, and they skip rather than pretend.
 *
 *   NEXT_PUBLIC_API_URL=http://127.0.0.1:9/api/v1 npx next dev -p 3250
 *   E2E_API_UNREACHABLE=1 E2E_BASE_URL=http://localhost:3250 npx playwright test e2e/error-boundary.spec.ts
 *
 * Verified manually this way on 2026-09-10: the product boundary rendered
 * "We could not reach the shop", kept the header and footer, and surfaced a
 * digest — see the commit that added this file.
 */

const apiIsUnreachable = process.env.E2E_API_UNREACHABLE === '1';

test.describe('Error boundaries (requires a stack with an unreachable API)', () => {
  test.skip(
    !apiIsUnreachable,
    'Set E2E_API_UNREACHABLE=1 against a web server pointed at a dead API — see the note at the top of this file.',
  );

  test('renders the boundary rather than a blank page', async ({ page }) => {
    await page.goto('/product/diamond-halo-ring', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /could not reach the shop/i })).toBeVisible();
  });

  test('keeps the storefront chrome usable, which is the point of a segment boundary', async ({
    page,
  }) => {
    await page.goto('/product/diamond-halo-ring', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('link', { name: 'ELYSIAN' }).first()).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
  });

  test('offers a way out and a reference the customer can quote', async ({ page }) => {
    await page.goto('/product/diamond-halo-ring', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /browse all pieces/i })).toBeVisible();
    // Next withholds the message from the client in production; without the
    // digest a customer reporting a fault has nothing to quote.
    await expect(page.getByTestId('error-digest')).toBeVisible();
  });
});

test.describe('Not found', () => {
  // The mirror image of the block above, and it needs the opposite
  // environment: a 404 requires an API that is up to answer with one. Against
  // a dead API this route fails with a connection error and renders the
  // boundary instead — correct behaviour, but not what this test is asserting.
  test.skip(apiIsUnreachable, 'A 404 needs a reachable API to produce one.');

  test('an unknown product renders the custom not-found page with its chrome', async ({ page }) => {
    await page.goto('/product/no-such-product-anywhere', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: /page not found/i })).toBeVisible();
    await expect(page.getByRole('link', { name: 'ELYSIAN' }).first()).toBeVisible();
    await expect(page.locator('footer')).toBeVisible();
  });
});
