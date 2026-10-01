CREATE SEQUENCE "repair_service_number_seq";

ALTER TABLE "repair_orders"
  ADD COLUMN "service_number" VARCHAR(32),
  ADD COLUMN "expected_completion_at" TIMESTAMPTZ(3),
  ADD COLUMN "redeem_bonuses" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "bonus_discount_rub" INTEGER NOT NULL DEFAULT 0;

WITH ranked_orders AS (
  SELECT "id", EXTRACT(YEAR FROM "created_at")::INTEGER AS "year",
         ROW_NUMBER() OVER (PARTITION BY EXTRACT(YEAR FROM "created_at") ORDER BY "created_at", "id") AS "sequence"
  FROM "repair_orders"
)
UPDATE "repair_orders" AS orders
SET "service_number" = 'UTP-' || ranked_orders."year"::TEXT || '-' || LPAD(ranked_orders."sequence"::TEXT, 6, '0')
FROM ranked_orders
WHERE orders."id" = ranked_orders."id";

ALTER TABLE "repair_orders" ALTER COLUMN "service_number" SET NOT NULL;
ALTER TABLE "repair_orders" ADD CONSTRAINT "repair_orders_bonus_discount_nonnegative" CHECK ("bonus_discount_rub" >= 0);

CREATE TABLE "repair_receipts" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "receipt_number" VARCHAR(48) NOT NULL,
  "issued_by_id" UUID NOT NULL,
  "items_snapshot" JSONB NOT NULL,
  "total_rub" INTEGER NOT NULL,
  "bonus_discount_rub" INTEGER NOT NULL DEFAULT 0,
  "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "repair_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "repair_receipts_total_nonnegative" CHECK ("total_rub" >= 0),
  CONSTRAINT "repair_receipts_discount_nonnegative" CHECK ("bonus_discount_rub" >= 0)
);
CREATE UNIQUE INDEX "repair_receipts_order_id_key" ON "repair_receipts"("order_id");
CREATE UNIQUE INDEX "repair_receipts_receipt_number_key" ON "repair_receipts"("receipt_number");
ALTER TABLE "repair_receipts" ADD CONSTRAINT "repair_receipts_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "repair_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "repair_receipts" ADD CONSTRAINT "repair_receipts_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "repair_orders_service_number_key" ON "repair_orders"("service_number");
SELECT setval('repair_service_number_seq', GREATEST((SELECT COUNT(*) FROM "repair_orders"), 1), (SELECT COUNT(*) > 0 FROM "repair_orders"));

ALTER TABLE "reviews" ADD COLUMN "is_published" BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX "reviews_is_published_created_at_idx" ON "reviews"("is_published", "created_at");

CREATE TYPE "CraftOrderStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "BonusTransactionType" AS ENUM ('EARN', 'REDEEM', 'MANUAL_ADJUSTMENT');

CREATE TABLE "craft_items" (
  "id" UUID NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "description" VARCHAR(4000) NOT NULL,
  "price_rub" INTEGER NOT NULL,
  "image_object_id" VARCHAR(255),
  "is_published" BOOLEAN NOT NULL DEFAULT false,
  "custom_order_available" BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "craft_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "craft_items_price_rub_nonnegative" CHECK ("price_rub" >= 0)
);
CREATE INDEX "craft_items_is_published_created_at_idx" ON "craft_items"("is_published", "created_at");
ALTER TABLE "craft_items" ADD CONSTRAINT "craft_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "craft_orders" (
  "id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "item_id" UUID,
  "item_title_snapshot" VARCHAR(160) NOT NULL,
  "unit_price_rub_snapshot" INTEGER NOT NULL,
  "quoted_price_rub" INTEGER,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "note" VARCHAR(2000) NOT NULL,
  "is_custom_order" BOOLEAN NOT NULL DEFAULT false,
  "status" "CraftOrderStatus" NOT NULL DEFAULT 'REQUESTED',
  "handled_by_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "craft_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "craft_orders_quantity_check" CHECK ("quantity" BETWEEN 1 AND 99),
  CONSTRAINT "craft_orders_unit_price_check" CHECK ("unit_price_rub_snapshot" >= 0),
  CONSTRAINT "craft_orders_quoted_price_check" CHECK ("quoted_price_rub" IS NULL OR "quoted_price_rub" >= 0)
);
CREATE INDEX "craft_orders_customer_id_created_at_idx" ON "craft_orders"("customer_id", "created_at");
CREATE INDEX "craft_orders_status_created_at_idx" ON "craft_orders"("status", "created_at");
ALTER TABLE "craft_orders" ADD CONSTRAINT "craft_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "craft_orders" ADD CONSTRAINT "craft_orders_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "craft_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "craft_orders" ADD CONSTRAINT "craft_orders_handled_by_id_fkey" FOREIGN KEY ("handled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "loyalty_transactions" (
  "id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "order_id" UUID,
  "actor_id" UUID,
  "type" "BonusTransactionType" NOT NULL,
  "points" INTEGER NOT NULL,
  "reason" VARCHAR(255) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "loyalty_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "loyalty_transactions_points_nonzero" CHECK ("points" <> 0)
);
CREATE INDEX "loyalty_transactions_customer_id_created_at_idx" ON "loyalty_transactions"("customer_id", "created_at");
CREATE INDEX "loyalty_transactions_order_id_idx" ON "loyalty_transactions"("order_id");
CREATE UNIQUE INDEX "loyalty_transactions_order_earn_key" ON "loyalty_transactions"("order_id") WHERE "order_id" IS NOT NULL AND "type" = 'EARN';
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "repair_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "site_banners" (
  "id" UUID NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "content" VARCHAR(1000) NOT NULL,
  "image_object_id" VARCHAR(255),
  "target_url" VARCHAR(1000),
  "starts_at" TIMESTAMPTZ(3),
  "ends_at" TIMESTAMPTZ(3),
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "created_by_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "site_banners_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "site_banners_schedule_check" CHECK ("starts_at" IS NULL OR "ends_at" IS NULL OR "starts_at" < "ends_at")
);
CREATE INDEX "site_banners_is_active_starts_at_ends_at_idx" ON "site_banners"("is_active", "starts_at", "ends_at");
ALTER TABLE "site_banners" ADD CONSTRAINT "site_banners_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
