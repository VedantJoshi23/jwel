-- Shareable carts — DOM-SHOPPING Invariant 11.
--
-- Hand-written, as every migration in this project must be: `prisma migrate
-- dev` cannot diff this schema, because it fails 42601 on the generated
-- `products.search_vector` column (KC-144).
--
-- A snapshot table rather than a share token on `carts`. Invariant 11 fixes
-- *which* variants, quantities and gift options were shared at share time,
-- while price and availability are resolved at open time — a token on the live
-- cart would give the wrong half, letting the sender's later edits silently
-- rewrite what the recipient sees.
--
-- No price column, deliberately: prices come from the variant when the link is
-- opened, which makes the live half of Invariant 11 true by construction.
-- No owner column, also deliberately: Invariant 9 never exposes the owner, and
-- the surest way to honour that is not to record them.

CREATE TABLE "cart_shares" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cart_shares_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "cart_shares_token_key" ON "cart_shares"("token");

CREATE TABLE "cart_share_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "share_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "gift_wrap" BOOLEAN NOT NULL DEFAULT false,
    "gift_note" TEXT,

    CONSTRAINT "cart_share_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "cart_share_items_share_id_idx" ON "cart_share_items"("share_id");
CREATE INDEX "cart_share_items_variant_id_idx" ON "cart_share_items"("variant_id");

-- Mirrors `cart_items.positive_quantity`. A shared line of zero would be an
-- item the sender did not mean to send.
ALTER TABLE "cart_share_items"
    ADD CONSTRAINT "cart_share_items_positive_quantity" CHECK ("quantity" > 0);

ALTER TABLE "cart_share_items"
    ADD CONSTRAINT "cart_share_items_share_id_fkey" FOREIGN KEY ("share_id")
    REFERENCES "cart_shares"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cart_share_items"
    ADD CONSTRAINT "cart_share_items_variant_id_fkey" FOREIGN KEY ("variant_id")
    REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Deliberately NO unique on (share_id, variant_id). Invariant 1 makes a line's
-- identity variant *plus configuration*, so the same ring wrapped and
-- unwrapped is two lines. `cart_items` still carries the old unique constraint
-- that contradicts this; dropping it is DOM-SHOPPING consequence (a) and
-- belongs with the server-side cart, not here.
