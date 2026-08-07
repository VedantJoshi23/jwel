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

-- Custom sizes (FEAT-SIZE-TAXONOMY v0.2.0, criteria 8/10/11).
--
-- Legacy free-text values that match no curated size are preserved verbatim
-- rather than rounded to a neighbour — a ring genuinely made at 16.5 is not a
-- 16, and clubbing it would silently change what the product physically is.
ALTER TABLE "size_options" ADD COLUMN "is_custom" BOOLEAN NOT NULL DEFAULT false;

-- The column becomes nullable so a custom row can admit it has no measurement.
-- The guarantee is not lost, only narrowed: the CHECK below re-imposes it for
-- every curated row, which is where it actually matters.
ALTER TABLE "size_options" ALTER COLUMN "circumference_mm" DROP NOT NULL;

-- Curated rows must carry the authoritative measurement; custom rows need not,
-- because a value like "Free size" has none and inventing one would be worse
-- than admitting it is unknown. Keeps the guarantee exactly where it matters.
ALTER TABLE "size_options"
  ADD CONSTRAINT "curated_has_circumference"
  CHECK ("is_custom" = true OR "circumference_mm" IS NOT NULL);

CREATE INDEX "size_options_scheme_is_custom_idx" ON "size_options"("scheme", "is_custom");
