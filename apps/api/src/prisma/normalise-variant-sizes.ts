import { PrismaClient, SizeScheme } from '@prisma/client';
import { resolveSchemeFromChain } from '../modules/products/size-validation';

/**
 * FEAT-SIZE-TAXONOMY criterion 8 — bring legacy free-text sizes into the
 * vocabulary without destroying information.
 *
 * Three outcomes per variant, and **rounding is not one of them**. A ring
 * genuinely made at 16.5 is not a 16; clubbing it with a neighbour would
 * silently change what the product physically is, which is worse than either
 * keeping the value or admitting it is unknown.
 *
 * | Case | Action |
 * | --- | --- |
 * | Value matches a curated size (after trivial cleanup) | Normalise to the canonical value |
 * | Value is non-empty but matches nothing | Preserve verbatim as a **custom** option |
 * | Category has no scheme but the variant has a size | Clear it — the size was never meaningful |
 *
 * Idempotent: a second run finds everything already canonical and changes
 * nothing. Reports counts so the client gets a review queue rather than a
 * silent migration.
 *
 * **This script writes to `product_variants` and inserts into `size_options`.**
 * Do not run it ad hoc. The procedure — take a fresh backup, verify it is
 * readable, run, read the report — plus its prerequisites and the absence of a
 * dry-run mode are documented in `deploy/RUNBOOK.md` §11a.
 *
 * Prerequisites, because getting them wrong is quiet rather than loud:
 * without the curated vocabulary seeded first, *every* existing size becomes a
 * custom option; without category schemes assigned, sizes are **cleared**.
 */

export interface NormalisationReport {
  normalised: number;
  custom: number;
  cleared: number;
  alreadyValid: number;
  /**
   * Standing review queue — every custom value in the catalogue and how many
   * variants carry it, not only those this run created. Re-running must not
   * make outstanding work appear to disappear.
   */
  customValues: Array<{ scheme: SizeScheme; value: string; variantCount: number }>;
}

/**
 * Trivial cleanup only — whitespace and the obvious "Size 16" / "16 (US 8)"
 * prefixes and suffixes people type. Deliberately conservative: anything this
 * does not confidently recognise becomes a custom option rather than being
 * guessed at.
 */
export function canonicalise(raw: string): string {
  return raw
    .trim()
    .replace(/^size\s*[:.-]?\s*/i, '')
    .replace(/\s*\(.*\)\s*$/, '')
    .trim();
}

export async function normaliseVariantSizes(prisma: PrismaClient): Promise<NormalisationReport> {
  const report: NormalisationReport = {
    normalised: 0,
    custom: 0,
    cleared: 0,
    alreadyValid: 0,
    customValues: [],
  };

  const categories = await prisma.category.findMany({
    select: { id: true, parentId: true, sizeScheme: true },
  });
  const byId = new Map(categories.map((category) => [category.id, category]));

  const schemeFor = (categoryId: string): SizeScheme | null => {
    const chain: Array<{ sizeScheme: SizeScheme | null }> = [];
    let current = byId.get(categoryId);
    for (let depth = 0; current && depth < 5; depth += 1) {
      chain.push({ sizeScheme: current.sizeScheme });
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    return resolveSchemeFromChain(chain);
  };

  // Curated and custom are tracked separately. A variant already carrying a
  // custom value needs no work — but the value still belongs in the review
  // queue, because the queue is a standing list of unresolved values, not a
  // diff of what this run changed.
  const allOptions = await prisma.sizeOption.findMany({
    select: { scheme: true, value: true, isCustom: true },
  });
  const knownByScheme = new Map<SizeScheme, Set<string>>();
  for (const option of allOptions) {
    if (!knownByScheme.has(option.scheme)) knownByScheme.set(option.scheme, new Set());
    knownByScheme.get(option.scheme)!.add(option.value);
  }

  const variants = await prisma.productVariant.findMany({
    where: { size: { not: null } },
    select: { id: true, size: true, product: { select: { categoryId: true } } },
  });

  // Group unmatched values so one custom option is created per distinct value,
  // not one per variant.
  const pendingCustom = new Map<string, { scheme: SizeScheme; value: string; variantIds: string[] }>();

  for (const variant of variants) {
    const raw = variant.size ?? '';
    const scheme = schemeFor(variant.product.categoryId);

    if (scheme === null) {
      // The category has no size dimension, so whatever is here was never
      // meaningful. Safe to clear — unlike an unmatched value under a real
      // scheme, there is no physical fact being discarded.
      if (raw !== '') {
        await prisma.productVariant.update({ where: { id: variant.id }, data: { size: null } });
        report.cleared += 1;
      }
      continue;
    }

    const valid = knownByScheme.get(scheme) ?? new Set<string>();

    if (valid.has(raw)) {
      report.alreadyValid += 1;
      continue;
    }

    const cleaned = canonicalise(raw);

    if (valid.has(cleaned)) {
      await prisma.productVariant.update({ where: { id: variant.id }, data: { size: cleaned } });
      report.normalised += 1;
      continue;
    }

    if (cleaned === '') {
      await prisma.productVariant.update({ where: { id: variant.id }, data: { size: null } });
      report.cleared += 1;
      continue;
    }

    const key = `${scheme}::${cleaned}`;
    const existing = pendingCustom.get(key);
    if (existing) {
      existing.variantIds.push(variant.id);
    } else {
      pendingCustom.set(key, { scheme, value: cleaned, variantIds: [variant.id] });
    }
  }

  // Custom options sort after every curated size, so the vocabulary reads in
  // order and the exceptions sit visibly at the end.
  for (const { scheme, value, variantIds } of pendingCustom.values()) {
    const maxSort = await prisma.sizeOption.aggregate({
      where: { scheme },
      _max: { sortOrder: true },
    });

    await prisma.sizeOption.upsert({
      where: { scheme_value: { scheme, value } },
      update: {},
      create: {
        scheme,
        value,
        label: value,
        // No circumference: this value came from free text and its physical
        // measurement is genuinely unknown. The CHECK constraint permits it
        // only because isCustom is true.
        circumferenceMm: null,
        diameterMm: null,
        usEquivalent: null,
        ukEquivalent: null,
        sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
        isCustom: true,
      },
    });

    for (const id of variantIds) {
      await prisma.productVariant.update({ where: { id }, data: { size: value } });
    }

    report.custom += variantIds.length;
  }

  // The standing review queue: every custom option and how many variants carry
  // it, whether or not this run created it. Re-running must not make the
  // client's outstanding work appear to vanish.
  const customOptions = await prisma.sizeOption.findMany({
    where: { isCustom: true },
    select: { scheme: true, value: true },
    orderBy: [{ scheme: 'asc' }, { sortOrder: 'asc' }],
  });
  for (const option of customOptions) {
    const variantCount = await prisma.productVariant.count({ where: { size: option.value } });
    report.customValues.push({ scheme: option.scheme, value: option.value, variantCount });
  }

  return report;
}

if (require.main === module) {
  const prisma = new PrismaClient();
  normaliseVariantSizes(prisma)
    .then((report) => {
      /* eslint-disable no-console -- migration scripts report to the operator */
      console.log(`Already valid : ${report.alreadyValid}`);
      console.log(`Normalised    : ${report.normalised}`);
      console.log(`Cleared       : ${report.cleared}  (category has no size dimension)`);
      console.log(`Custom (new)  : ${report.custom} variants assigned this run`);
      if (report.customValues.length > 0) {
        console.log(
          `\nReview queue — ${report.customValues.length} custom values, preserved verbatim rather than rounded:`,
        );
        for (const entry of report.customValues) {
          console.log(`  ${entry.scheme}  "${entry.value}"  (${entry.variantCount} variants)`);
        }
      }
      /* eslint-enable no-console */
    })
    .catch((error) => {
      // eslint-disable-next-line no-console -- migration scripts report to the operator
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
