import {
  CollectionType,
  MetalType,
  ModerationStatus,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  PrismaClient,
  ProductStatus,
  SizeScheme,
} from '@prisma/client';

/**
 * Volume seed for load testing (EV-LOAD-BASELINE work, STD-PERFORMANCE r5).
 *
 * Separate from `seed.ts`, which stays minimal because CI's e2e job depends on
 * its exact contents. Load-testing a four-record catalogue measures Postgres's
 * buffer cache rather than the application, so the harness needs a catalogue
 * large enough that index choice, pagination and the Elasticsearch/Postgres
 * fallback split (ADR-0016) actually diverge.
 *
 * **Deterministic by slug, not by id.** Primary keys stay database-generated;
 * what k6 and Playwright need to address is the HTTP surface, and that is keyed
 * by slug and SKU. Every generated record therefore has a stable, predictable
 * natural key — `load-product-0001`, `LOAD-SKU-000001`, `load+0001@seed.invalid`
 * — reproducible across runs without coordinating uuids.
 *
 * Everything it writes is namespaced `load-` / `LOAD-` so a load dataset can be
 * identified and removed without touching real or `seed.ts` data. Re-running
 * clears the previous load dataset first, so the script is idempotent in the
 * sense that matters: the row counts afterwards are the same every time.
 */

const CATALOGUE_SIZE = 500;
const USER_COUNT = 200;
const ORDER_COUNT = 1000;
const COLLECTION_COUNT = 50;
const BATCH = 500;

/**
 * Fixed-seed PRNG. `Math.random()` would make each run a different dataset,
 * and a load baseline compared against a different catalogue is not a
 * comparison. mulberry32 — small, fast, adequate for shaping test data.
 */
function makeRandom(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = makeRandom(20260909);
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];
const between = (min: number, max: number): number => min + Math.floor(random() * (max - min + 1));
const pad = (n: number, width: number): string => String(n).padStart(width, '0');

const METALS: readonly MetalType[] = ['GOLD', 'GOLD_PLATED', 'SILVER', 'PLATINUM', 'STAINLESS_STEEL'];
const PURITIES: Record<string, readonly string[]> = {
  GOLD: ['14K', '18K', '22K'],
  GOLD_PLATED: ['18K'],
  SILVER: ['925'],
  PLATINUM: ['950'],
  STAINLESS_STEEL: ['316L'],
};
const MATERIALS = ['Diamond', 'Emerald', 'Ruby', 'Sapphire', 'Pearl', 'Solitaire', 'Pavé', 'Kundan'];
const FORMS = ['Halo', 'Solitaire', 'Eternity', 'Cluster', 'Drop', 'Stud', 'Tennis', 'Charm'];
const CITIES: ReadonlyArray<readonly [string, string, string]> = [
  ['Ahmedabad', 'Gujarat', '380015'],
  ['Mumbai', 'Maharashtra', '400001'],
  ['Bengaluru', 'Karnataka', '560001'],
  ['Jaipur', 'Rajasthan', '302001'],
  ['Kolkata', 'West Bengal', '700001'],
  ['Chennai', 'Tamil Nadu', '600001'],
];

/**
 * Categories carry `NONE` rather than a real scheme unless the size vocabulary
 * has actually been seeded. Inventing sizes that no `SizeOption` row backs
 * would put values in `product_variants.size` that FEAT-SIZE-TAXONOMY forbids,
 * and the load dataset would then be testing against illegal state.
 */
const CATEGORY_SPECS = [
  { name: 'Load Rings', slug: 'load-rings', sized: true },
  { name: 'Load Necklaces', slug: 'load-necklaces', sized: false },
  { name: 'Load Earrings', slug: 'load-earrings', sized: false },
  { name: 'Load Bracelets', slug: 'load-bracelets', sized: false },
  { name: 'Load Pendants', slug: 'load-pendants', sized: false },
] as const;

function assertSafeTarget(): void {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is unset — refusing to seed.');

  if (process.env.NODE_ENV === 'production') {
    throw new Error('NODE_ENV=production — refusing to write a load dataset.');
  }

  const name = new URL(url).pathname.replace(/^\//, '');
  const expected = /^jwel(_dev|_test|_load)?$/;
  if (!expected.test(name) && process.env.SEED_LOAD_I_UNDERSTAND !== '1') {
    throw new Error(
      `This writes ~15,000 rows and deletes any existing load dataset. The target database ` +
        `is "${name}", which is not one of jwel / jwel_dev / jwel_test / jwel_load. ` +
        `If that is genuinely intended, re-run with SEED_LOAD_I_UNDERSTAND=1.`,
    );
  }
}

/** Removes a previous load dataset. Cascades handle variants, items and media. */
async function clearPreviousRun(prisma: PrismaClient): Promise<void> {
  // Orders reference variants without cascade, so they go before products.
  const users = await prisma.user.findMany({
    where: { email: { startsWith: 'load+' } },
    select: { id: true },
  });
  const userIds = users.map((u) => u.id);
  if (userIds.length > 0) {
    await prisma.payment.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await prisma.orderStatusHistory.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await prisma.orderItem.deleteMany({ where: { order: { userId: { in: userIds } } } });
    await prisma.order.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.review.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.address.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
  await prisma.collection.deleteMany({ where: { slug: { startsWith: 'load-collection-' } } });
  await prisma.product.deleteMany({ where: { slug: { startsWith: 'load-product-' } } });
  await prisma.category.deleteMany({ where: { slug: { startsWith: 'load-' } } });
}

async function seedCategories(prisma: PrismaClient): Promise<Array<{ id: string; sized: boolean }>> {
  const ringSizes = await prisma.sizeOption.findMany({
    where: { scheme: SizeScheme.RING_INDIA },
    select: { value: true },
    orderBy: { sortOrder: 'asc' },
  });
  const sizesAvailable = ringSizes.length > 0;

  const created: Array<{ id: string; sized: boolean }> = [];
  for (const spec of CATEGORY_SPECS) {
    const sized = spec.sized && sizesAvailable;
    const category = await prisma.category.create({
      data: {
        name: spec.name,
        slug: spec.slug,
        sizeScheme: sized ? SizeScheme.RING_INDIA : SizeScheme.NONE,
      },
    });
    created.push({ id: category.id, sized });
  }
  return created;
}

async function main(): Promise<void> {
  assertSafeTarget();
  const started = Date.now();
  const prisma = new PrismaClient();

  try {
    console.log('Clearing any previous load dataset...');
    await clearPreviousRun(prisma);

    const categories = await seedCategories(prisma);
    const ringSizes = (
      await prisma.sizeOption.findMany({
        where: { scheme: SizeScheme.RING_INDIA },
        select: { value: true },
        orderBy: { sortOrder: 'asc' },
      })
    ).map((s) => s.value);

    // ── Products ──────────────────────────────────────────────────────────
    console.log(`Creating ${CATALOGUE_SIZE} products...`);
    const productRows = Array.from({ length: CATALOGUE_SIZE }, (_, i) => {
      const n = i + 1;
      const category = categories[i % categories.length];
      // A tenth stay DRAFT so listing queries filter a realistic proportion
      // rather than returning everything they scan.
      const status = n % 10 === 0 ? ProductStatus.DRAFT : ProductStatus.PUBLISHED;
      return {
        name: `${pick(MATERIALS)} ${pick(FORMS)} ${pad(n, 4)}`,
        slug: `load-product-${pad(n, 4)}`,
        categoryId: category.id,
        description:
          `Load-test fixture ${pad(n, 4)}. Generated by seed-load.ts with a fixed PRNG seed; ` +
          `not real merchandise. Text is padded so full-text search has something to match ` +
          `against and response payloads are representative in size.`,
        status,
      };
    });
    for (let i = 0; i < productRows.length; i += BATCH) {
      await prisma.product.createMany({ data: productRows.slice(i, i + BATCH) });
    }

    const products = await prisma.product.findMany({
      where: { slug: { startsWith: 'load-product-' } },
      select: { id: true, slug: true, categoryId: true },
      orderBy: { slug: 'asc' },
    });
    const sizedCategoryIds = new Set(categories.filter((c) => c.sized).map((c) => c.id));

    // ── Variants ──────────────────────────────────────────────────────────
    console.log('Creating variants...');
    let sku = 0;
    const variantRows = products.flatMap((product) => {
      const count = between(2, 6);
      return Array.from({ length: count }, () => {
        sku += 1;
        const metal = pick(METALS);
        const sized = sizedCategoryIds.has(product.categoryId) && ringSizes.length > 0;
        // Exactly one draw, always — even when there is no vocabulary to draw
        // from. Consuming the PRNG conditionally would make the sequence, and
        // therefore the entire dataset, depend on whether the size vocabulary
        // happens to be seeded; two baselines taken either side of
        // `prisma:seed:sizes` would then not be comparable. Measured: it
        // shifted the variant count by 54.
        const sizeIndex = Math.floor(random() * Math.max(ringSizes.length, 1));
        const sizeDraw = ringSizes[sizeIndex] ?? null;
        return {
          productId: product.id,
          sku: `LOAD-SKU-${pad(sku, 6)}`,
          metal,
          purity: pick(PURITIES[metal]),
          size: sized ? sizeDraw : null,
          weightGrams: (between(150, 2500) / 100).toFixed(2),
          basePriceMinorUnits: between(500000, 25000000),
        };
      });
    });
    for (let i = 0; i < variantRows.length; i += BATCH) {
      await prisma.productVariant.createMany({ data: variantRows.slice(i, i + BATCH) });
    }

    const variants = await prisma.productVariant.findMany({
      where: { sku: { startsWith: 'LOAD-SKU-' } },
      select: { id: true, productId: true, basePriceMinorUnits: true },
      orderBy: { sku: 'asc' },
    });

    // ── Inventory ─────────────────────────────────────────────────────────
    console.log('Creating inventory...');
    const inventoryRows = variants.map((variant, i) => ({
      variantId: variant.id,
      // One in twenty is out of stock, so the load scenarios traverse the
      // sold-out path rather than always finding availability.
      quantityOnHand: i % 20 === 0 ? 0 : between(1, 60),
      quantityReserved: 0,
    }));
    for (let i = 0; i < inventoryRows.length; i += BATCH) {
      await prisma.inventory.createMany({ data: inventoryRows.slice(i, i + BATCH) });
    }

    // ── Media ─────────────────────────────────────────────────────────────
    console.log('Creating media...');
    const mediaRows = products.flatMap((product) =>
      Array.from({ length: between(1, 4) }, (_, index) => ({
        productId: product.id,
        storageRef: `load/${product.slug}-${index}.jpg`,
        sortOrder: index,
      })),
    );
    for (let i = 0; i < mediaRows.length; i += BATCH) {
      await prisma.productMedia.createMany({ data: mediaRows.slice(i, i + BATCH) });
    }

    // ── Collections ───────────────────────────────────────────────────────
    console.log(`Creating ${COLLECTION_COUNT} collections...`);
    const collectionTypes: readonly CollectionType[] = ['GOLD', 'DIAMOND', 'SEASONAL', 'EDITORIAL'];
    await prisma.collection.createMany({
      data: Array.from({ length: COLLECTION_COUNT }, (_, i) => ({
        name: `Load Collection ${pad(i + 1, 3)}`,
        slug: `load-collection-${pad(i + 1, 3)}`,
        type: collectionTypes[i % collectionTypes.length],
        description: `Load-test collection ${pad(i + 1, 3)}.`,
        isFeatured: i % 10 === 0,
      })),
    });
    const collections = await prisma.collection.findMany({
      where: { slug: { startsWith: 'load-collection-' } },
      select: { id: true },
      orderBy: { slug: 'asc' },
    });
    const collectionProductRows = collections.flatMap((collection) => {
      const memberCount = between(10, 40);
      const seen = new Set<string>();
      const rows: Array<{ collectionId: string; productId: string; sortOrder: number }> = [];
      for (let i = 0; i < memberCount; i += 1) {
        const product = pick(products);
        if (seen.has(product.id)) continue;
        seen.add(product.id);
        rows.push({ collectionId: collection.id, productId: product.id, sortOrder: i });
      }
      return rows;
    });
    for (let i = 0; i < collectionProductRows.length; i += BATCH) {
      await prisma.collectionProduct.createMany({ data: collectionProductRows.slice(i, i + BATCH) });
    }

    // ── Users and addresses ───────────────────────────────────────────────
    console.log(`Creating ${USER_COUNT} users...`);
    await prisma.user.createMany({
      data: Array.from({ length: USER_COUNT }, (_, i) => ({
        // `.invalid` is reserved by RFC 2606 and can never route, so a stray
        // notification job in a test environment cannot reach a real inbox.
        email: `load+${pad(i + 1, 4)}@seed.invalid`,
        name: `Load Customer ${pad(i + 1, 4)}`,
        // No passwordHash: these accounts exist to own orders and reviews, not
        // to authenticate. A hash here would be a credential-shaped value in
        // seed data for no benefit.
        phone: `9${pad(between(100000000, 999999999), 9)}`,
      })),
    });
    const users = await prisma.user.findMany({
      where: { email: { startsWith: 'load+' } },
      select: { id: true },
      orderBy: { email: 'asc' },
    });
    await prisma.address.createMany({
      data: users.map((user) => {
        const [city, state, pincode] = pick(CITIES);
        return {
          userId: user.id,
          label: 'Home',
          line1: `${between(1, 400)} Load Test Street`,
          city,
          state,
          pincode,
          isDefault: true,
        };
      }),
    });

    // ── Orders ────────────────────────────────────────────────────────────
    console.log(`Creating ${ORDER_COUNT} orders...`);
    const statuses: readonly OrderStatus[] = [
      'PLACED',
      'CONFIRMED',
      'PROCESSING',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
    ];
    for (let start = 0; start < ORDER_COUNT; start += 100) {
      const size = Math.min(100, ORDER_COUNT - start);
      await Promise.all(
        Array.from({ length: size }, async (_, offset) => {
          const index = start + offset;
          const user = users[index % users.length];
          const lines = Array.from({ length: between(1, 3) }, () => {
            const variant = pick(variants);
            return {
              variantId: variant.id,
              quantity: between(1, 2),
              unitPriceMinorUnits: variant.basePriceMinorUnits,
            };
          });
          const subtotal = lines.reduce((sum, l) => sum + l.unitPriceMinorUnits * l.quantity, 0);
          const shipping = subtotal > 5000000 ? 0 : 15000;
          const status = pick(statuses);
          const [city, state, pincode] = pick(CITIES);

          await prisma.order.create({
            data: {
              userId: user.id,
              status,
              subtotalMinorUnits: subtotal,
              shippingMinorUnits: shipping,
              totalMinorUnits: subtotal + shipping,
              shippingAddress: {
                line1: `${between(1, 400)} Load Test Street`,
                city,
                state,
                pincode,
                country: 'IN',
              },
              items: {
                create: lines.map((line) => ({
                  variantId: line.variantId,
                  productNameSnapshot: `Load fixture item`,
                  variantSnapshot: { sku: 'LOAD', metal: 'GOLD' },
                  quantity: line.quantity,
                  unitPriceMinorUnits: line.unitPriceMinorUnits,
                })),
              },
              statusHistory: { create: { status } },
              payment: {
                create: {
                  provider: PaymentProvider.RAZORPAY,
                  // Cancelled orders keep a FAILED payment so reconciliation
                  // and revenue queries see both outcomes, not just the happy
                  // one. No real provider reference exists for seeded rows.
                  status: status === 'CANCELLED' ? PaymentStatus.FAILED : PaymentStatus.SUCCEEDED,
                  amountMinorUnits: subtotal + shipping,
                  providerRef: `load_pay_${pad(index + 1, 6)}`,
                },
              },
            },
          });
        }),
      );
    }

    // ── Reviews ───────────────────────────────────────────────────────────
    console.log('Creating reviews...');
    const reviewRows: Array<{
      productId: string;
      userId: string;
      rating: number;
      body: string;
      verifiedPurchase: boolean;
      moderationStatus: ModerationStatus;
    }> = [];
    const ratingTotals = new Map<string, { sum: number; count: number }>();
    for (const product of products) {
      const count = between(0, 6);
      const reviewers = new Set<number>();
      for (let i = 0; i < count; i += 1) {
        const userIndex = between(0, users.length - 1);
        if (reviewers.has(userIndex)) continue;
        reviewers.add(userIndex);
        const rating = between(3, 5);
        // Only APPROVED reviews feed the denormalised aggregate, matching how
        // the application maintains it — seeding a total that includes pending
        // rows would manufacture the desync KC-142 warns about.
        const moderationStatus: ModerationStatus = i % 8 === 0 ? 'PENDING' : 'APPROVED';
        if (moderationStatus === 'APPROVED') {
          const totals = ratingTotals.get(product.id) ?? { sum: 0, count: 0 };
          totals.sum += rating;
          totals.count += 1;
          ratingTotals.set(product.id, totals);
        }
        reviewRows.push({
          productId: product.id,
          userId: users[userIndex].id,
          rating,
          body: `Load-test review ${i + 1} for ${product.slug}. Generated fixture text.`,
          verifiedPurchase: random() > 0.4,
          moderationStatus,
        });
      }
    }
    for (let i = 0; i < reviewRows.length; i += BATCH) {
      await prisma.review.createMany({ data: reviewRows.slice(i, i + BATCH) });
    }

    console.log('Updating rating aggregates...');
    for (const [productId, totals] of ratingTotals) {
      await prisma.product.update({
        where: { id: productId },
        data: {
          avgRating: (totals.sum / totals.count).toFixed(2),
          ratingCount: totals.count,
        },
      });
    }

    const elapsed = ((Date.now() - started) / 1000).toFixed(1);
    console.log(
      [
        '',
        `Load dataset ready in ${elapsed}s:`,
        `  products     ${products.length}`,
        `  variants     ${variants.length}`,
        `  inventory    ${inventoryRows.length}`,
        `  media        ${mediaRows.length}`,
        `  collections  ${collections.length} (${collectionProductRows.length} memberships)`,
        `  users        ${users.length}`,
        `  orders       ${ORDER_COUNT}`,
        `  reviews      ${reviewRows.length}`,
        '',
        'Addressable by slug: load-product-0001 … load-product-0500',
        'Collections:         load-collection-001 … load-collection-050',
      ].join('\n'),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
