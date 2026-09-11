import { PrismaClient, ProductStatus } from '@prisma/client';

/**
 * Minimal, idempotent seed — exists to satisfy e2e/storefront.spec.ts's
 * assumption that a "Diamond Halo Ring" product already exists (it never
 * did; nothing seeded it, in CI or locally, which is why those specs only
 * ever passed if someone happened to have leftover local data). Deliberately
 * small: enough for the current E2E suite to have real data to browse/
 * search/add-to-bag against, not a full demo catalog.
 */
const prisma = new PrismaClient();

async function main() {
  const category = await prisma.category.upsert({
    where: { slug: 'rings' },
    update: {},
    create: { name: 'Rings', slug: 'rings' },
  });

  const product = await prisma.product.upsert({
    where: { slug: 'diamond-halo-ring' },
    update: { status: ProductStatus.PUBLISHED },
    create: {
      name: 'Diamond Halo Ring',
      slug: 'diamond-halo-ring',
      categoryId: category.id,
      description: 'A halo of pavé diamonds around a central solitaire, in 18K gold.',
      status: ProductStatus.PUBLISHED,
    },
  });

  const variant = await prisma.productVariant.upsert({
    where: { sku: 'DHR-GOLD-001' },
    update: {},
    create: {
      productId: product.id,
      sku: 'DHR-GOLD-001',
      metal: 'GOLD',
      purity: '18K',
      weightGrams: 3.2,
      basePriceMinorUnits: 8500000, // ₹85,000
    },
  });

  await prisma.inventory.upsert({
    where: { variantId: variant.id },
    update: { quantityOnHand: 10 },
    create: { variantId: variant.id, quantityOnHand: 10, quantityReserved: 0 },
  });

  // A second product, in a category whose name is more than one word. The
  // product breadcrumb once built its category link by lower-casing the
  // display name, which only breaks for names like "Necklaces & Pendants" —
  // with "Rings" alone the e2e breadcrumb test passed against the bug.
  const pendants = await prisma.category.upsert({
    where: { slug: 'necklaces-and-pendants' },
    update: {},
    create: { name: 'Necklaces & Pendants', slug: 'necklaces-and-pendants' },
  });

  const pendant = await prisma.product.upsert({
    where: { slug: 'pearl-drop-pendant' },
    update: { status: ProductStatus.PUBLISHED },
    create: {
      name: 'Pearl Drop Pendant',
      slug: 'pearl-drop-pendant',
      categoryId: pendants.id,
      description: 'A single freshwater pearl on a fine sterling silver chain.',
      status: ProductStatus.PUBLISHED,
    },
  });

  const pendantVariant = await prisma.productVariant.upsert({
    where: { sku: 'PDP-SILVER-001' },
    update: {},
    create: {
      productId: pendant.id,
      sku: 'PDP-SILVER-001',
      metal: 'SILVER',
      purity: '925',
      weightGrams: 2.1,
      basePriceMinorUnits: 450000, // ₹4,500
    },
  });

  await prisma.inventory.upsert({
    where: { variantId: pendantVariant.id },
    update: { quantityOnHand: 10 },
    create: { variantId: pendantVariant.id, quantityOnHand: 10, quantityReserved: 0 },
  });

  console.log(`Seeded: ${product.name} (${product.slug}), ${pendant.name} (${pendant.slug})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
