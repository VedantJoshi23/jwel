-- Cart line identity is variant + configuration — DOM-SHOPPING Invariant 1.
--
-- Hand-written; `prisma migrate dev` cannot diff this schema (KC-144).
--
-- `cart_items` carried `@@unique([cart_id, variant_id])`: one line per variant
-- per cart. DOM-SHOPPING consequence (a) records that this is **incompatible**
-- with two invariants that were settled after it was written:
--
--   * Invariant 4 — gift wrap is per line, so the same ring must be able to
--     appear wrapped and unwrapped.
--   * Invariant 15 — merging two carts keeps differing configurations as
--     separate lines.
--
-- The conflict predates the merge decision: Invariant 4 was settled 2026-08-06
-- and this constraint was never revisited. Line identity becomes the row id,
-- with "same variant, same configuration" matched in application logic on add.
--
-- `cart_share_items` was already created without this constraint
-- (FEAT-SHAREABLE-CART), so this brings the live cart in line with the
-- snapshot table rather than the other way around.

DROP INDEX "cart_items_cart_id_variant_id_key";

-- The index that constraint was also providing. Cart reads are always "all
-- lines for this cart", and that lookup should not become a sequential scan
-- just because the uniqueness went away.
CREATE INDEX "cart_items_cart_id_idx" ON "cart_items"("cart_id");
