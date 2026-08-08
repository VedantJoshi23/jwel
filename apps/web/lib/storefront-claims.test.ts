import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import { STOREFRONT_CLAIMS, outstandingClaims } from './storefront-claims';

/**
 * Constitution Law 1, enforced against the actual copy.
 *
 * `deploy/RUNBOOK.md` step 0 carried this list as prose and it went stale
 * without anyone noticing — it still described the return window as unenforced
 * after it had been built, and listed one claim twice. These tests make that
 * impossible: the registry and the shipped copy have to agree, in both
 * directions.
 */
const WEB_ROOT = join(__dirname, '..');

function sourceOf(relativePath: string): string {
  return readFileSync(join(WEB_ROOT, relativePath), 'utf8');
}

describe('storefront claims registry', () => {
  it('lists claims', () => {
    // A registry that quietly emptied itself would pass every test below.
    expect(STOREFRONT_CLAIMS.length).toBeGreaterThan(5);
  });

  it('has no duplicate ids', () => {
    // The prose table it replaces listed "Customisation available" twice.
    const ids = STOREFRONT_CLAIMS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('names a real file for every claim', () => {
    for (const claim of STOREFRONT_CLAIMS) {
      expect(claim.where.length).toBeGreaterThan(0);
      for (const file of claim.where) {
        expect(() => sourceOf(file), `${claim.id} → ${file}`).not.toThrow();
      }
    }
  });

  it('says what has to happen for every outstanding claim', () => {
    // "Known to be wrong" without "and here is what fixes it" is how a list
    // like this becomes something people scroll past.
    for (const claim of outstandingClaims()) {
      expect(claim.resolution.length, claim.id).toBeGreaterThan(20);
      expect(claim.reality.length, claim.id).toBeGreaterThan(20);
    }
  });

  describe('the copy still says what the registry claims it says', () => {
    it.each(STOREFRONT_CLAIMS.filter((c) => c.status === 'outstanding'))(
      'outstanding: $id is still present in the copy',
      (claim) => {
        // Failing here is good news badly recorded: someone fixed the copy and
        // did not mark the claim resolved. Update the registry entry.
        const found = claim.where.some((file) => claim.pattern.test(sourceOf(file)));
        expect(
          found,
          `"${claim.claim}" is marked outstanding but no longer appears in ${claim.where.join(', ')}. ` +
            `If it was fixed, set status: 'resolved'.`,
        ).toBe(true);
      },
    );

    it.each(STOREFRONT_CLAIMS.filter((c) => c.status === 'resolved'))(
      'resolved: $id has not come back',
      (claim) => {
        // For a resolved claim the pattern describes the *corrected* copy, so
        // it must be present and the old wording gone.
        const found = claim.where.some((file) => claim.pattern.test(sourceOf(file)));
        expect(found, `"${claim.claim}" is marked resolved but is missing from the copy.`).toBe(true);
      },
    );
  });

  describe('the specific regressions worth naming', () => {
    it('does not promise a 7-day return window anywhere', () => {
      // The rule is 10 days and enforced. The FAQ was wrong twice: wrong
      // number, and no window enforced at all.
      for (const file of ['app/(storefront)/faq/page.tsx', 'app/(storefront)/shipping/page.tsx']) {
        expect(sourceOf(file), file).not.toMatch(/within 7 days of delivery/);
      }
    });

    it('keeps the placeholder markers on unreviewed copy', () => {
      // These markers are what stop the FAQ being mistaken for reviewed
      // content. They may only be removed together with the claims.
      expect(sourceOf('app/(storefront)/faq/page.tsx')).toMatch(/MUST NOT GO LIVE AS-IS/);
    });
  });
});
