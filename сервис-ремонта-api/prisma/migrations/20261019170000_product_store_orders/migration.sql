CREATE TYPE "ShopOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

CREATE TABLE "shop_orders" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "status" "ShopOrderStatus" NOT NULL DEFAULT 'PENDING',
    "customer_note" VARCHAR(1000),
    "total_rub" INTEGER NOT NULL,
    "confirmed_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "shop_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shop_order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "catalog_item_id" UUID,
    "name" VARCHAR(160) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_rub" INTEGER NOT NULL,
    "stock_deducted" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "shop_order_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "shop_orders_customer_id_created_at_idx" ON "shop_orders"("customer_id", "created_at");
CREATE INDEX "shop_orders_status_created_at_idx" ON "shop_orders"("status", "created_at");
CREATE INDEX "shop_order_items_order_id_idx" ON "shop_order_items"("order_id");
CREATE INDEX "shop_order_items_catalog_item_id_idx" ON "shop_order_items"("catalog_item_id");

ALTER TABLE "shop_orders"
  ADD CONSTRAINT "shop_orders_customer_id_fkey"
  FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "shop_order_items"
  ADD CONSTRAINT "shop_order_items_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "shop_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "shop_order_items_catalog_item_id_fkey"
  FOREIGN KEY ("catalog_item_id") REFERENCES "repair_catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
