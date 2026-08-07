import { PrismaClient, SizeScheme } from '@prisma/client';
import { SIZE_OPTION_SEED } from './size-options.data';

/**
 * FEAT-SIZE-TAXONOMY — seeds the size vocabulary and assigns schemes to the
 * client's real top-level categories.
 *
 * Idempotent by construction (upsert on the `(scheme, value)` unique key), so
 * it is safe to re-run after adding sizes to a scheme — which is the expected
 * way to extend a range, since the 6–26 ring bound is a seed decision rather
 * than a physical one.
 *
 * Deliberately separate from `seed.ts`: that file exists only to give the E2E
 * suite a product to browse, and is explicitly minimal. This is reference data
 * every environment needs, including production.
 */

/**
 * Which categories carry a sizing scheme, by slug.
 *
 * Earrings are absent on purpose, and that absence is the feature: a stud or a
 * jhumka has no size dimension, so showing an empty size selector on it would
 * be worse than showing nothing (FEAT-SIZE-TAXONOMY §6).
 *
 * `adjustable` is mapped to `SizeScheme.NONE`, not null. Null means "inherit",
 * and Adjustable sits under Rings — so null would give it RING_INDIA, which is
 * wrong: an adjustable ring fits any finger. NONE is the override.
 */
export const CATEGORY_SIZE_SCHEMES: Record<string, SizeScheme> = {
  rings: SizeScheme.RING_INDIA,
  'necklaces-and-pendants': SizeScheme.CHAIN_LENGTH_MM,
  'bracelets-and-anklets': SizeScheme.BRACELET_LENGTH_MM,
  // NONE, not null: null means "inherit", and Adjustable sits under Rings.
  adjustable: SizeScheme.NONE,
};

export async function seedSizeOptions(prisma: PrismaClient): Promise<void> {
  for (const option of SIZE_OPTION_SEED) {
    const { scheme, value, ...rest } = option;
    await prisma.sizeOption.upsert({
      where: { scheme_value: { scheme, value } },
      update: rest,
      create: { scheme, value, ...rest },
    });
  }
}

export async function assignCategorySchemes(prisma: PrismaClient): Promise<void> {
  for (const [slug, scheme] of Object.entries(CATEGORY_SIZE_SCHEMES)) {
    // updateMany, not update: a slug that does not exist in this environment
    // is not an error. The client's taxonomy is still being built, and a seed
    // that throws on a missing category would block every other environment.
    await prisma.category.updateMany({ where: { slug }, data: { sizeScheme: scheme } });
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedSizeOptions(prisma)
    .then(() => assignCategorySchemes(prisma))
    .then(async () => {
      const count = await prisma.sizeOption.count();
      // eslint-disable-next-line no-console -- seed scripts report to the operator
      console.log(`Seeded ${count} size options across ${new Set(SIZE_OPTION_SEED.map((o) => o.scheme)).size} schemes.`);
    })
    .catch((error) => {
      // eslint-disable-next-line no-console -- seed scripts report to the operator
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
