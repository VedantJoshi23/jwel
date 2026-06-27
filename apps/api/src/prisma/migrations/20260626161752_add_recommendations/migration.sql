-- `products.search_vector` is a hand-authored generated tsvector column
-- (DATABASE.md §8.3) that Prisma's introspection-based diff doesn't model
-- correctly — it spuriously tried to drop/recreate it here on a schema
-- change unrelated to that column. That statement has been stripped; this
-- migration touches only the new recommendation-engine tables below.

-- CreateTable
CREATE TABLE "product_views" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "anonymous_id" TEXT,
    "product_id" UUID NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_views_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_co_occurrences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_a_id" UUID NOT NULL,
    "product_b_id" UUID NOT NULL,
    "co_occurrence_count" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_co_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_views_user_id_viewed_at_idx" ON "product_views"("user_id", "viewed_at" DESC);

-- CreateIndex
CREATE INDEX "product_views_anonymous_id_viewed_at_idx" ON "product_views"("anonymous_id", "viewed_at" DESC);

-- CreateIndex
CREATE INDEX "product_co_occurrences_product_b_id_idx" ON "product_co_occurrences"("product_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_co_occurrences_product_a_id_product_b_id_key" ON "product_co_occurrences"("product_a_id", "product_b_id");

-- AddForeignKey
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_views" ADD CONSTRAINT "product_views_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_co_occurrences" ADD CONSTRAINT "product_co_occurrences_product_a_id_fkey" FOREIGN KEY ("product_a_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_co_occurrences" ADD CONSTRAINT "product_co_occurrences_product_b_id_fkey" FOREIGN KEY ("product_b_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
