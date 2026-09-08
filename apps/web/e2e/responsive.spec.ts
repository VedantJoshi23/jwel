import { expect, test } from '@playwright/test';

/**
 * No page may overflow horizontally at any supported viewport width.
 *
 * The failure this guards against is not a cosmetic scrollbar. When a page's
 * content is wider than the device, mobile browsers widen the *layout*
 * viewport to fit it and let the user pinch-zoom out — at which point the
 * real content sits in a narrow column with dead space beside it, which is
 * exactly what a client reported against the live site on 2026-09-08.
 *
 * The cause there is the one worth naming, because it is silent and recurs:
 * a flex/grid item defaults to `min-width: auto`, so it refuses to shrink
 * below its content's intrinsic width. The bestsellers carousel lays every
 * slide out side by side in one track (~1570px) and clips it with
 * `overflow-hidden` — which hides the track visually but does **not** stop it
 * contributing that intrinsic width to its ancestors. The single-column
 * mobile grid therefore sized itself to 1570px and blew the document out to a
 * ~1600px `scrollWidth` at a 320-390px viewport. `min-w-0` on the item (and
 * `minmax(0, …)` on the explicit track) is the fix; this test is what stops
 * it coming back, since nothing about it is visible on a desktop viewport
 * where the layout has room.
 *
 * 320px is the floor deliberately: it is the narrowest width still in real
 * use (iPhone SE 1st gen / Galaxy Fold cover screen), and anything that
 * survives 320 survives the rest.
 */

const WIDTHS = [320, 375, 390, 768, 1024] as const;

const PAGES: Array<[name: string, path: string]> = [
  ['the homepage', '/'],
  ['a collection listing', '/collections/all'],
  ['a product detail page', '/product/diamond-halo-ring'],
  ['search results', '/search?q=Diamond'],
  ['the cart', '/cart'],
  ['the FAQ', '/faq'],
  ['about', '/about'],
];

test.describe('Responsive — no horizontal overflow', () => {
  for (const [name, path] of PAGES) {
    for (const width of WIDTHS) {
      test(`${name} fits ${width}px without overflowing`, async ({ page }) => {
        await page.setViewportSize({ width, height: 844 });
        // `domcontentloaded` for the same reason the other specs use it — the
        // `/_next/image` optimizer stall must not fail a test about layout.
        await page.goto(path, { waitUntil: 'domcontentloaded' });
        // Entrance animations (ADR-0019) translate sections in from the side;
        // measuring mid-flight would read a transform that is not the settled
        // layout. Same wait, same reason, as the accessibility spec's.
        await page.waitForTimeout(500);

        const { clientWidth, scrollWidth, widest } = await page.evaluate(() => {
          const de = document.documentElement;
          // Name the widest offender that is not clipped by an ancestor —
          // a bare "1597 > 320" tells you nothing about which element to fix.
          const clipped = (el: Element) => {
            let n = el.parentElement;
            while (n && n !== document.documentElement) {
              const o = getComputedStyle(n).overflowX;
              if (o === 'hidden' || o === 'clip' || o === 'auto' || o === 'scroll') return true;
              n = n.parentElement;
            }
            return false;
          };
          let widest: string | null = null;
          let widestRight = de.clientWidth + 1;
          document.querySelectorAll('*').forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 && r.height === 0) return;
            if (r.right > widestRight && !clipped(el)) {
              widestRight = r.right;
              widest = `<${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 120)}"> right=${Math.round(r.right)}`;
            }
          });
          return { clientWidth: de.clientWidth, scrollWidth: de.scrollWidth, widest };
        });

        expect(
          scrollWidth,
          `Document is ${scrollWidth - clientWidth}px wider than the ${clientWidth}px viewport.` +
            (widest ? ` Widest unclipped element: ${widest}` : ''),
        ).toBeLessThanOrEqual(clientWidth + 1);
      });
    }
  }
});
