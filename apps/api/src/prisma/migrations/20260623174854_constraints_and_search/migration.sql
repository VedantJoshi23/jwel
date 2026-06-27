-- Hand-authored migration per DATABASE.md §7.4/§8.3: CHECK constraints and the
-- generated full-text search column that Prisma's schema DSL cannot express.

ALTER TABLE reviews
  ADD CONSTRAINT rating_range CHECK (rating BETWEEN 1 AND 5);

ALTER TABLE inventory_items
  ADD CONSTRAINT reserved_not_exceeding_on_hand
  CHECK (quantity_reserved <= quantity_on_hand);

ALTER TABLE inventory_items
  ADD CONSTRAINT non_negative_stock
  CHECK (quantity_on_hand >= 0 AND quantity_reserved >= 0);

ALTER TABLE order_items
  ADD CONSTRAINT positive_quantity CHECK (quantity > 0);

ALTER TABLE coupons
  ADD CONSTRAINT valid_date_range CHECK (valid_to > valid_from);

ALTER TABLE products ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
  ) STORED;

CREATE INDEX products_search_vector_idx ON products USING GIN (search_vector);