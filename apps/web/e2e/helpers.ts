import { expect, type Page } from '@playwright/test';

/**
 * Put the product on the currently-open PDP into the bag, and leave the page
 * ready for whatever the test does next.
 *
 * The closing step is the point of this existing at all. Adding a line opens
 * the bag drawer (`ADR-0028`) — a real modal, which covers the page and takes
 * the rest of the document out of the accessibility tree while it is up.
 * Every spec that added a line and then carried on (navigating to /checkout,
 * asserting the header badge, running axe over the page) was written before
 * that drawer existed, and each one hung for its full timeout against it:
 * the retry loops they used re-query "Add to bag" by role, and a role query
 * cannot see a button inside an `aria-hidden` subtree.
 *
 * The drawer opening is also a better signal than the one those loops polled.
 * They watched the header badge and clicked again while it still said zero,
 * which is indirect — the badge is a consequence of the cart query
 * invalidating, two steps removed from the line landing. The drawer appears
 * when the add resolves, so it is the add's own confirmation.
 *
 * Idempotent: returns immediately if the bag already holds something, which
 * is what the callers' original guard was protecting against — a retry that
 * silently adds a second line.
 */
export async function addToBag(page: Page): Promise<void> {
  const bag = page.locator('a[href="/cart"]').first();
  const label = (await bag.getAttribute('aria-label')) ?? '';
  if (!label.includes('0 items')) return;

  // `.first()`: a PDP can also render product cards, and a single-variant
  // card's quick-add carries the same "Add to bag" label.
  await page.getByRole('button', { name: 'Add to bag' }).first().click();

  const drawer = page.getByRole('dialog');
  await expect(drawer).toBeVisible({ timeout: 15_000 });
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden({ timeout: 5_000 });

  await expect(bag).toHaveAttribute('aria-label', /Shopping bag, 1 item/, { timeout: 5_000 });
}
