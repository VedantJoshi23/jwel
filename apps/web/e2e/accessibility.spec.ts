import AxeBuilder from '@axe-core/playwright';
import { expect, test, type BrowserContext, type Page } from '@playwright/test';

/**
 * `STD-ACCESSIBILITY` rule 2 — automated accessibility checks run in CI over
 * key journeys, via `axe` in the existing Playwright suite.
 *
 * NFR-5 commits to WCAG 2.1 AA and, until now, **no automated verification of
 * any kind existed** (KC-171). The standard says so about itself: *"Rule 2: CI,
 * once axe lands. Currently nothing is enforced."* That is the same shape as
 * the storefront claims table — a document asserting a capability that did not
 * exist — and it is the commitment the standard calls the least verified in
 * the project and the only one carrying legal exposure.
 *
 * **What this does and does not establish.** Automated checks catch perhaps a
 * third of WCAG issues. The third they catch are the ones that regress
 * silently — a contrast ratio nudged by a palette tweak, an alt attribute lost
 * in a refactor. They do **not** certify AA compliance, and the standard is
 * explicit that claiming so would violate Law 1. Rules 3-7 remain human review.
 */

const WCAG_21_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(WCAG_21_AA).analyze();
}

/** Readable failure output: axe's raw result object is unreadable in CI logs. */
function describeViolations(results: Awaited<ReturnType<typeof scan>>): string {
  return results.violations
    .map((v) => {
      const where = v.nodes.map((n) => `        ${n.target.join(' ')}`).join('\n');
      return `  [${v.impact}] ${v.id} — ${v.help}\n    ${v.helpUrl}\n${where}`;
    })
    .join('\n\n');
}

async function expectNoViolations(page: Page) {
  const results = await scan(page);
  expect(results.violations.length, `\n${describeViolations(results)}\n`).toBe(0);
}

test.describe('Accessibility — WCAG 2.1 AA', () => {
  const publicPages: Array<[name: string, path: string]> = [
    ['the homepage', '/'],
    ['a collection listing', '/collections/all'],
    ['a product detail page', '/product/diamond-halo-ring'],
    ['search results', '/search?q=Diamond'],
    ['the empty cart', '/cart'],
    ['login', '/login'],
    ['register', '/register'],
    ['the FAQ', '/faq'],
    ['shipping and returns', '/shipping'],
  ];

  for (const [name, path] of publicPages) {
    test(`${name} has no automatically detectable AA violations`, async ({ page }) => {
      // `domcontentloaded` for the same reason the other specs use it — the
      // `/_next/image` optimizer stall must not fail a test about markup.
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expectNoViolations(page);
    });
  }

  test('the cart with an item in it', async ({ page }) => {
    // Empty and populated are different documents: the populated one carries
    // quantity steppers, remove buttons and a live total.
    await page.goto('/product/diamond-halo-ring', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => {});

    const bag = page.locator('a[href="/cart"]').first();
    await expect(async () => {
      if ((await bag.getAttribute('aria-label'))?.includes('0 items')) {
        await page.getByRole('button', { name: 'Add to bag' }).click();
      }
      await expect(bag).toHaveAttribute('aria-label', /Shopping bag, 1 item/, { timeout: 1_000 });
    }).toPass({ timeout: 20_000 });

    await page.goto('/cart', { waitUntil: 'domcontentloaded' });
    await expectNoViolations(page);
  });
});

/**
 * The signed-in surfaces, which rule 7 calls the highest-consequence forms:
 * *"checkout and login are the highest-consequence forms; an unlabelled field
 * is unusable with a screen reader."*
 *
 * Serial, with **one** registration for the whole describe. Auth endpoints
 * allow 5 requests per minute per IP outside `NODE_ENV=test`, and
 * `auth.spec.ts` already spends four of them — so one is the budget this file
 * has, and one is what it uses.
 */
test.describe.serial('Accessibility — signed-in surfaces', () => {
  let context: BrowserContext;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // An explicit context, not `browser.newPage()` — AxeBuilder rejects the
    // implicit one with "Please use browser.newContext()".
    context = await browser.newContext();
    page = await context.newPage();
    await page.goto('/register');
    await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => {});
    await page.getByLabel('Email').fill(`e2e-a11y-${Date.now()}@e2e.jwel.local`);
    await page.getByLabel('Password', { exact: true }).fill('a-strong-password');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/profile/);
  });

  test.afterAll(async () => {
    await context.close();
  });

  test('the profile page, including its tabs', async () => {
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await expectNoViolations(page);
  });

  test('the orders tab', async () => {
    // Tab panels are a common source of AA failures, and the panel's content
    // only exists in the DOM once the tab is selected.
    await page.goto('/profile', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => {});
    await page.getByRole('tab', { name: 'Orders' }).click();
    await expectNoViolations(page);
  });

  test('the checkout form', async () => {
    await page.goto('/product/diamond-halo-ring', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => {});

    const bag = page.locator('a[href="/cart"]').first();
    await expect(async () => {
      if ((await bag.getAttribute('aria-label'))?.includes('0 items')) {
        await page.getByRole('button', { name: 'Add to bag' }).click();
      }
      await expect(bag).toHaveAttribute('aria-label', /Shopping bag, 1 item/, { timeout: 1_000 });
    }).toPass({ timeout: 20_000 });

    await page.goto('/checkout', { waitUntil: 'domcontentloaded' });
    // The real form, not the "please log in" placeholder — that is the
    // document rule 7 is about.
    await expect(page.getByRole('button', { name: 'Place Order' })).toBeVisible();
    await expectNoViolations(page);
  });
});
