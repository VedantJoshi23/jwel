-- FEAT-PRODUCT-VIDEO-MEDIA §5 — the thumbnail (the media item at
-- sort_order = 0) must always be an image, never a video. sort_order and
-- type are both columns on the same product_media row, so this is a plain
-- row-level CHECK constraint, per Constitution Law 4 / STD-DATABASE rule 4:
-- an invariant belongs at the lowest layer that can enforce it.
--
-- This only guarantees the literal sort_order = 0 row is an IMAGE. It is
-- made to mean "first in display order" by products.service.ts#removeMedia,
-- which resequences the remaining rows to a contiguous 0..n-1 in the same
-- transaction as a delete — see that method's comment for why a gap-tolerant
-- ordering would make this constraint trivially satisfiable without actually
-- protecting the invariant.

ALTER TABLE "product_media"
  ADD CONSTRAINT "product_media_thumbnail_is_image"
  CHECK ("sort_order" <> 0 OR "type" = 'IMAGE');
