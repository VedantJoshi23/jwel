-- FEAT-SIZE-TAXONOMY — category-aware size vocabulary.
--
-- Hand-authored rather than generated. `prisma migrate dev` cannot diff this
-- schema: `products.search_vector` is a generated column created in
-- 20260623174854_constraints_and_search, and Prisma's diff engine tries to
-- ALTER ... SET DEFAULT on it and fails with 42601. That is the
-- Prisma-invisible-schema cost recorded in DISC-005 (KC-144), surfacing for
-- the first time. Written by hand per STD-DATABASE r7 (raw SQL permitted,
-- justified in place).

-- CreateEnum
-- 'NONE' is a real scheme value meaning "this category has no size", distinct
-- from a NULL column meaning "inherit from parent". Both are needed: without
-- NONE a child cannot override a sized parent.
CREATE TYPE "size_scheme" AS ENUM ('NONE', 'RING_INDIA', 'BANGLE_INDIA', 'CHAIN_LENGTH_MM', 'BRACELET_LENGTH_MM');

-- AlterTable
-- Nullable with no default: NULL means "this category has no size dimension",
-- which is a real answer (earrings), not a missing one.
ALTER TABLE "categories" ADD COLUMN "size_scheme" "size_scheme";

-- CreateTable
CREATE TABLE "size_options" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "scheme" "size_scheme" NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "diameter_mm" DECIMAL(5,2),
    "circumference_mm" DECIMAL(5,2) NOT NULL,
    "us_equivalent" TEXT,
    "uk_equivalent" TEXT,
    "sort_order" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "size_options_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "size_options_scheme_value_key" ON "size_options"("scheme", "value");

-- CreateIndex
-- Read path: every option for one scheme in display order. Both the storefront
-- filter and the PDP size guide issue exactly this query.
CREATE INDEX "size_options_scheme_sort_order_idx" ON "size_options"("scheme", "sort_order");

-- Physical sanity, enforced where Law 4 wants it rather than in the service.
-- A size with no circumference is not a size, and a diameter larger than the
-- circumference is a data-entry error that would silently corrupt the guide.
ALTER TABLE "size_options"
  ADD CONSTRAINT "positive_circumference" CHECK ("circumference_mm" > 0);
ALTER TABLE "size_options"
  ADD CONSTRAINT "diameter_below_circumference"
  CHECK ("diameter_mm" IS NULL OR "diameter_mm" < "circumference_mm");
