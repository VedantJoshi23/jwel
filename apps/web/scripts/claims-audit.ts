/**
 * Prints every storefront claim the system does not back, and — with
 * `--strict` — fails if any remain.
 *
 * This is `deploy/RUNBOOK.md` step 0 made runnable. That step gates going
 * live on "every customer-facing claim is true", and until now the only way
 * to check was to read a prose table that had already gone stale.
 *
 *   pnpm claims:audit            # report
 *   pnpm claims:audit --strict   # gate: exit 1 while anything is outstanding
 *
 * The demo banner is what makes outstanding claims tolerable — it tells
 * customers nothing here is real. Run this with `--strict` before the change
 * that removes it, not after.
 */
import { STOREFRONT_CLAIMS, outstandingClaims } from '../lib/storefront-claims';

const strict = process.argv.includes('--strict');
const outstanding = outstandingClaims();
const resolved = STOREFRONT_CLAIMS.length - outstanding.length;

console.log(`\nStorefront claims — Law 1: a surface may not assert a capability the system does not have.\n`);
console.log(`  ${STOREFRONT_CLAIMS.length} tracked · ${resolved} resolved · ${outstanding.length} outstanding\n`);

for (const claim of outstanding) {
  console.log(`  ✗ ${claim.claim}`);
  console.log(`      where     ${claim.where.join(', ')}`);
  console.log(`      reality   ${claim.reality}`);
  console.log(`      to fix    ${claim.resolution}\n`);
}

if (outstanding.length === 0) {
  console.log('  Every tracked claim is backed. The demo banner can come down.\n');
  process.exit(0);
}

if (strict) {
  console.error(
    `  BLOCKED: ${outstanding.length} claim(s) the system cannot back.\n` +
      `  Going live with these visible means charging customers for promises that are not true.\n`,
  );
  process.exit(1);
}

console.log(`  Reporting only. Re-run with --strict to use this as the go-live gate.\n`);
