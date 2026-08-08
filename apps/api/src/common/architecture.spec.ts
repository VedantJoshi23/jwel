import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

/**
 * ADR-0008's Validation section, enforced rather than asserted.
 *
 * `DISC-006` found exactly one boundary violation in the system — Reviews
 * writing `Product.avgRating` and emitting `product.upserted` (KC-152) —
 * and `FEAT-RATING-OWNERSHIP` closed it. These tests are what stop it
 * coming back.
 *
 * A structural test rather than a behavioural one on purpose: the next
 * violation will not be a regression in Reviews, it will be a new module
 * doing the convenient thing. Only reading the source catches that.
 */

const SRC = join(__dirname, '..');
const CATALOG = join('modules', 'products');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    // Specs are excluded: a test may legitimately construct any call shape,
    // including the one being forbidden.
    return entry.endsWith('.ts') && !entry.endsWith('.spec.ts') ? [path] : [];
  });
}

const modules = sourceFiles(join(SRC, 'modules'));

describe('bounded-context boundaries (ADR-0008)', () => {
  it('finds source files to check — a silent empty sweep would pass forever', () => {
    expect(modules.length).toBeGreaterThan(20);
  });

  it('confines writes to the product row to Catalog', () => {
    const offenders = modules.filter(
      (file) =>
        !file.includes(CATALOG) && /\b(?:prisma|tx|client)\.product\.update\b/.test(readFileSync(file, 'utf8')),
    );

    // The aggregate must have a single owner, or nothing can guarantee it is
    // correct (KC-142). Command Catalog instead: `withRatingRecompute`.
    expect(offenders).toEqual([]);
  });

  it('confines product event emission to Catalog', () => {
    const offenders = modules.filter(
      (file) =>
        !file.includes(CATALOG) &&
        /emit\(\s*['"]product\.(?:upserted|deleted)['"]/.test(readFileSync(file, 'utf8')),
    );

    // A module publishing another context's event is half of KC-152. The name
    // `product.upserted` is only honest when Catalog is the one saying it.
    expect(offenders).toEqual([]);
  });

  it('keeps the rating derivation in one place', () => {
    // Three copies of an AVG/COUNT over reviews is how a seeded rating starts
    // disagreeing with a recomputed one (FEAT-RATING-OWNERSHIP §7.8).
    const offenders = sourceFiles(SRC).filter(
      (file) =>
        !file.endsWith('rating-aggregate.ts') &&
        /_avg:\s*\{\s*rating:\s*true/.test(readFileSync(file, 'utf8')),
    );

    expect(offenders).toEqual([]);
  });
});
