import { expect, test, type Page } from '@playwright/test';

/**
 * `STD-TESTING` rule 4 — the payment path has automated end-to-end coverage:
 * checkout → payment → confirmation.
 *
 * `DISC-009` ranked this the highest-value gap in the codebase (KC-121): CI
 * already ran a real stack, and the one journey the business cannot afford to
 * break silently was the only one nobody drove. Every other spec here browses;
 * none of them ever placed an order.
 *
 * **What is real and what is not.** CI resolves `MockPaymentProvider`, so no
 * money moves and no Razorpay modal opens. Everything else is the production
 * path: the order and its items are written in one transaction, stock is
 * reserved, a `Payment` row is created, `payment.succeeded` is emitted, and
 * `OrdersService` reacts by confirming the order and emitting
 * `order.confirmed`. That reaction chain is what `FEAT-ORDER-RECONCILIATION`
 * exists to repair when it breaks, and nothing exercised it above unit level.
 *
 * The mock is not a shortcut around the interesting part — the client branches
 * on `checkout.simulated`, which the **server** decides, so this drives the
 * same submit handler a real shopper uses right up to the gateway boundary.
 *
 * **Two constraints this file is deliberately shaped around.**
 *
 * 1. *Auth is rate-limited to 5 requests per minute per IP* outside
 *    `NODE_ENV=test`, and CI runs the API as `development`
 *    (`auth.controller.ts`). `auth.spec.ts` already spends most of that
 *    budget, so this file registers **twice in total** — once for the shared
 *    shopper, once for the stranger the isolation test needs — rather than
 *    once per test. A serial describe with one shared page is what makes that
 *    possible.
 * 2. *It spends seeded stock.* Each placed order reserves a unit of the ten
 *    `prisma:seed` creates. Two orders here leaves ample headroom, but a
 *    future test that places more should check that budget rather than
 *    discover it as a confusing "could not place order" failure.
 */

const PRODUCT_SLUG = 'diamond-halo-ring';
const PASSWORD = 'a-strong-password';

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@e2e.jwel.local`;
}

/**
 * Waits for the page's JavaScript to be in place before interacting with it.
 *
 * Every form here is a client handler on a server-rendered element, so a click
 * that lands before hydration is **silently swallowed** — no error, no state
 * change, and the failure surfaces somewhere less obvious three steps later.
 * Measured while writing these tests: against a dev server the first "Add to
 * bag" click did nothing at all.
 */
async function waitForHydration(page: Page): Promise<void> {
  // Short timeout on purpose. `networkidle` never settles on a page whose
  // `/_next/image` request hangs — the intermittent optimizer stall
  // storefront.spec.ts documents — and the default 30s turned two of these
  // tests into 35-second tests waiting for something that was never coming.
  // Hydration completes long before this; the bound is a fallback, not the
  // mechanism, and every caller asserts afterwards regardless.
  await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => {
    // Expected on pages with a stalled image request.
  });
}

async function register(page: Page, email: string): Promise<void> {
  await page.goto('/register');
  await waitForHydration(page);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/profile/);
}

async function addProductToBag(page: Page): Promise<void> {
  // `domcontentloaded` for the same reason storefront.spec.ts documents: the
  // PDP's `priority` hero image can leave the optimizer request hanging on a
  // CI runner, and this test is about checkout, not the image pipeline.
  await page.goto(`/product/${PRODUCT_SLUG}`, { waitUntil: 'domcontentloaded' });
  await waitForHydration(page);

  const bag = page.locator('a[href="/cart"]').first();
  const addButton = page.getByRole('button', { name: 'Add to bag' });

  // Retried rather than slept on, and guarded by the bag's own count so a
  // retry cannot add a second line: it clicks again only while the bag is
  // still empty.
  await expect(async () => {
    if ((await bag.getAttribute('aria-label'))?.includes('0 items')) {
      await addButton.click();
    }
    await expect(bag).toHaveAttribute('aria-label', /Shopping bag, 1 item/, { timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
}

async function emptyTheBag(page: Page): Promise<void> {
  // The cart is a zustand store persisted under this key (lib/cart-store.ts).
  // Tests share one session to stay inside the auth rate limit, so they must
  // not inherit each other's bags.
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('jwel-cart'));
}

async function placeOrder(page: Page): Promise<string> {
  await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
  await waitForHydration(page);
  // Name and email are shown read-only from the account (no re-entry) — an
  // account with no saved addresses on file falls back to this blank form.
  await page.getByLabel('Address', { exact: true }).fill('12 Test Lane');
  await page.getByLabel('City').fill('Ahmedabad');
  await page.getByLabel('State').fill('Gujarat');
  await page.getByLabel('Zip Code').fill('380001');
  await page.getByRole('button', { name: 'Place Order' }).click();

  await expect(page).toHaveURL(/\/checkout\/confirmation\?orderId=/);
  const orderId = new URL(page.url()).searchParams.get('orderId');
  expect(orderId, 'the confirmation URL must carry the real order id').toBeTruthy();
  return orderId!;
}

async function openOrdersTab(page: Page): Promise<void> {
  await page.goto('/profile', { waitUntil: 'domcontentloaded' });
  await waitForHydration(page);
  await page.getByRole('tab', { name: 'Orders' }).click();
}

test.describe.serial('Checkout → payment → confirmation', () => {
  let page: Page;
  let shopper: string;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    shopper = uniqueEmail('e2e-checkout');
    await register(page, shopper);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('a shopper can place an order and it is confirmed server-side', async () => {
    await emptyTheBag(page);
    await addProductToBag(page);
    const orderId = await placeOrder(page);

    await expect(page.getByRole('heading', { name: 'Order placed' })).toBeVisible();

    // The assertion that matters. The confirmation page renders happily from
    // URL parameters alone, so it proves nothing on its own. Reading the order
    // back from the server proves it was written — and that it reached
    // CONFIRMED, which happens only if `payment.succeeded` was emitted and
    // Ordering reacted to it. PLACED here would mean the order exists but the
    // reaction never landed: exactly what the reconciliation sweep repairs.
    await openOrdersTab(page);
    const order = page.locator('li', { hasText: orderId });
    await expect(order).toBeVisible();
    await expect(order).toContainText('CONFIRMED');
  });

  test('the bag is emptied once the order is placed', async () => {
    await emptyTheBag(page);
    await addProductToBag(page);
    await placeOrder(page);

    // A bag that survives checkout is how a shopper accidentally buys the same
    // piece twice — and on single-unit jewellery the second order cannot be
    // fulfilled.
    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Diamond Halo Ring')).toHaveCount(0);
  });

  test('an order is visible only to the shopper who placed it', async ({ browser }) => {
    await openOrdersTab(page);
    const placedOrder = page.locator('li').filter({ hasText: 'CONFIRMED' }).first();
    await expect(placedOrder).toBeVisible();
    const orderId = (await placedOrder.locator('p').first().textContent())!.trim();

    // A separate context: no shared token, no shared cart.
    const strangerPage = await browser.newPage();
    try {
      await register(strangerPage, uniqueEmail('e2e-stranger'));
      await openOrdersTab(strangerPage);
      await expect(strangerPage.getByText('You have no orders yet.')).toBeVisible();
      await expect(strangerPage.getByText(orderId)).toHaveCount(0);
    } finally {
      await strangerPage.close();
    }
  });

  test('checkout with an empty bag offers nothing to place', async () => {
    await emptyTheBag(page);
    await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
    await waitForHydration(page);
    await expect(page.getByRole('button', { name: 'Place Order' })).toHaveCount(0);
  });

  test('checkout asks an anonymous visitor to log in rather than failing at submit', async ({
    page: anonymousPage,
  }) => {
    // A fresh fixture page, so genuinely logged out. Costs no auth request.
    await anonymousPage.goto('/checkout', { waitUntil: 'domcontentloaded' });
    await expect(anonymousPage.getByText('Please log in to continue to checkout.')).toBeVisible();
    await expect(anonymousPage.getByRole('button', { name: 'Place Order' })).toHaveCount(0);
  });
});
