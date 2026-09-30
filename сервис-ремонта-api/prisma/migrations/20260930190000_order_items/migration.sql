CREATE TYPE "RepairOrderItemType" AS ENUM ('SERVICE', 'SPARE_PART');

CREATE TABLE "repair_order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "type" "RepairOrderItemType" NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price_rub" INTEGER NOT NULL,
    "added_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "repair_order_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "repair_order_items_quantity_check" CHECK ("quantity" >= 1 AND "quantity" <= 99),
    CONSTRAINT "repair_order_items_unit_price_rub_check" CHECK ("unit_price_rub" >= 0 AND "unit_price_rub" <= 10000000)
);

CREATE INDEX "repair_order_items_order_id_created_at_idx" ON "repair_order_items"("order_id", "created_at");

ALTER TABLE "repair_order_items" ADD CONSTRAINT "repair_order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "repair_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "repair_order_items" ADD CONSTRAINT "repair_order_items_added_by_id_fkey" FOREIGN KEY ("added_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
