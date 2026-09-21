-- CreateEnum
CREATE TYPE "shipment_status" AS ENUM ('CREATED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'NDR', 'DELIVERED', 'RTO_INITIATED', 'RTO_DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "shipping_provider" AS ENUM ('SHIPROCKET');

-- CreateTable
CREATE TABLE "shipments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "provider" "shipping_provider" NOT NULL DEFAULT 'SHIPROCKET',
    "provider_order_id" TEXT,
    "provider_shipment_id" TEXT,
    "awb_code" TEXT,
    "courier_name" TEXT,
    "status" "shipment_status" NOT NULL DEFAULT 'CREATED',
    "tracking_url" TEXT,
    "estimated_delivery" TIMESTAMP(3),
    "last_event_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipment_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "shipment_id" UUID NOT NULL,
    "status" "shipment_status" NOT NULL,
    "note" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shipments_order_id_key" ON "shipments"("order_id");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_awb_code_key" ON "shipments"("awb_code");

-- CreateIndex
CREATE INDEX "shipments_status_idx" ON "shipments"("status");

-- CreateIndex
CREATE INDEX "shipment_status_history_shipment_id_occurred_at_idx" ON "shipment_status_history"("shipment_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipment_status_history" ADD CONSTRAINT "shipment_status_history_shipment_id_fkey" FOREIGN KEY ("shipment_id") REFERENCES "shipments"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CHECK per STD-DATABASE r4 / Law 4. Every status after CREATED is reported
-- by the carrier against an AWB, so a shipment that has moved past CREATED
-- without one is corrupt, not merely incomplete. CANCELLED is exempt: an order
-- can be cancelled after the Shiprocket order exists but before an AWB does.
ALTER TABLE "shipments"
  ADD CONSTRAINT "tracked_status_has_awb" CHECK (
    "status" IN ('CREATED', 'CANCELLED') OR "awb_code" IS NOT NULL
  );
