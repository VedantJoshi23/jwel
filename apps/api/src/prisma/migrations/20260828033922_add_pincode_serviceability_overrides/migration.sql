-- CreateTable
CREATE TABLE "pincode_serviceability_overrides" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "pincode" TEXT NOT NULL,
    "deliverable" BOOLEAN NOT NULL DEFAULT true,
    "estimated_min_days" INTEGER,
    "estimated_max_days" INTEGER,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pincode_serviceability_overrides_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "pincode_serviceability_overrides_pincode_key" ON "pincode_serviceability_overrides"("pincode");

-- CHECK constraints per STD-DATABASE r4/Law 4 — format and range invariants
-- enforced at the lowest layer that can express them, not application-only.
-- Indian PINs are exactly 6 digits and never start with 0.
ALTER TABLE "pincode_serviceability_overrides"
  ADD CONSTRAINT "pincode_format" CHECK ("pincode" ~ '^[1-9][0-9]{5}$');

ALTER TABLE "pincode_serviceability_overrides"
  ADD CONSTRAINT "estimate_range_ordered" CHECK (
    "estimated_min_days" IS NULL OR "estimated_max_days" IS NULL
    OR "estimated_min_days" <= "estimated_max_days"
  );

-- A non-deliverable pincode carries no delivery window — there is nothing to
-- estimate for a place the estimator says it cannot reach.
ALTER TABLE "pincode_serviceability_overrides"
  ADD CONSTRAINT "non_deliverable_has_no_window" CHECK (
    "deliverable" = true OR ("estimated_min_days" IS NULL AND "estimated_max_days" IS NULL)
  );
