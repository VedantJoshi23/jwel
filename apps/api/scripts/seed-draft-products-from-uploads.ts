// Draft-product bootstrap from orphan uploads.
//
// Turns every image already sitting in UPLOADS_DIR/products/ into exactly one
// DRAFT product with placeholder fields, one variant, and the image attached
// as its sole ProductMedia row. The admin then edits real name/price/etc. in
// /admin/products and flips each to PUBLISHED.
//
// Deliberately NOT part of prisma/seed.ts (which resetCatalog()s and would
// wipe uploaded media). Mirrors ProductsService.adminCreate's write shape
// exactly — DRAFT status, a variant with a zeroed inventory row — so these
// rows are indistinguishable from ones created through the admin UI.
//
// Idempotent: any image whose `local:products/<file>` ref already has a
// product_media row is skipped, so re-running only fills in what's missing.
//
//   pnpm ts-node --transpile-only scripts/seed-draft-products-from-uploads.ts
//
// Env knobs (all optional):
//   UPLOADS_DIR       (default ./uploads)      — matches the API's own default
//   DRAFT_CATEGORY_SLUG (default "rings")      — category the drafts land in
//   LIMIT             (default: all)           — cap for a smaller test batch
import { PrismaClient, MetalType, ProductStatus } from '@prisma/client';
import { readdir } from 'fs/promises';
import { join, extname } from 'path';

const prisma = new PrismaClient();

// Only image types the app serves; ignore stray non-images in the folder.
const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

async function main(): Promise<void> {
  const uploadsDir = process.env.UPLOADS_DIR ?? join(process.cwd(), 'uploads');
  const productsDir = join(uploadsDir, 'products');
  const categorySlug = process.env.DRAFT_CATEGORY_SLUG ?? 'rings';
  const limit = process.env.LIMIT ? Number(process.env.LIMIT) : Infinity;

  const category = await prisma.category.findUnique({ where: { slug: categorySlug }, select: { id: true } });
  if (!category) {
    throw new Error(`Category with slug "${categorySlug}" not found — set DRAFT_CATEGORY_SLUG.`);
  }

  const entries = await readdir(productsDir).catch(() => {
    throw new Error(`Could not read ${productsDir} — is UPLOADS_DIR correct?`);
  });
  const files = entries.filter((f) => IMAGE_EXTS.has(extname(f).toLowerCase())).sort();
  if (files.length === 0) {
    console.log(`No image files in ${productsDir}; nothing to do.`);
    return;
  }

  // storageRef mirrors FilesystemStorageProvider.upload(): `local:<folder>/<file>`.
  const refFor = (file: string): string => `local:products/${file}`;

  // Pull existing media refs once so re-runs skip already-imported images
  // instead of colliding on the unique slug/SKU.
  const existing = await prisma.productMedia.findMany({ select: { storageRef: true } });
  const existingRefs = new Set(existing.map((m) => m.storageRef));

  const pending = files.filter((f) => !existingRefs.has(refFor(f))).slice(0, limit);
  console.log(
    `${files.length} image(s) found; ${files.length - pending.length} already imported or over LIMIT; ` +
      `creating ${pending.length} draft product(s) in category "${categorySlug}".`,
  );

  let created = 0;
  for (const file of pending) {
    const id = file.slice(0, file.length - extname(file).length); // the UUID the app assigned at upload
    created++;
    // Slug and SKU are derived from the upload UUID → globally unique, so no
    // cross-run counter to keep in sync and no collision with existing rows.
    await prisma.product.create({
      data: {
        name: `Untitled Draft ${created}`,
        slug: `draft-${id}`,
        categoryId: category.id,
        description: 'Pending — placeholder draft created from an uploaded image. Edit before publishing.',
        status: ProductStatus.DRAFT,
        variants: {
          create: {
            sku: `DRAFT-${id}`,
            metal: MetalType.GOLD,
            weightGrams: 0,
            basePriceMinorUnits: 0,
            inventory: { create: { quantityOnHand: 0, quantityReserved: 0 } },
          },
        },
        media: { create: { storageRef: refFor(file), sortOrder: 0 } },
      },
      select: { id: true },
    });
    if (created % 100 === 0) console.log(`  …${created}/${pending.length}`);
  }

  console.log(`Done. Created ${created} draft product(s). They are visible in /admin/products with status DRAFT.`);
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
