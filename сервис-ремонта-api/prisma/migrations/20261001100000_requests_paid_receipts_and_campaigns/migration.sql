CREATE TYPE "ReceiptPaymentStatus" AS ENUM ('PENDING', 'PAID');
CREATE TYPE "ReceiptPaymentMethod" AS ENUM ('CASH', 'CARD_TERMINAL', 'BANK_TRANSFER', 'OTHER');

ALTER TABLE "repair_orders"
  ADD COLUMN "contact_phone" VARCHAR(32),
  ADD COLUMN "city" VARCHAR(120),
  ADD COLUMN "street" VARCHAR(180),
  ADD COLUMN "house" VARCHAR(30),
  ADD COLUMN "apartment" VARCHAR(30),
  ADD COLUMN "entrance" VARCHAR(30),
  ADD COLUMN "has_barrier" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "floor" VARCHAR(20),
  ADD COLUMN "additional_phone" VARCHAR(32),
  ADD COLUMN "additional_info" VARCHAR(500);

ALTER TABLE "repair_receipts"
  ADD COLUMN "service_number" VARCHAR(32),
  ADD COLUMN "customer_name" VARCHAR(120),
  ADD COLUMN "customer_phone" VARCHAR(32),
  ADD COLUMN "payment_status" "ReceiptPaymentStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "payment_method" "ReceiptPaymentMethod",
  ADD COLUMN "paid_at" TIMESTAMPTZ(3),
  ADD CONSTRAINT "repair_receipts_payment_state_check" CHECK (
    ("payment_status" = 'PENDING' AND "paid_at" IS NULL) OR
    ("payment_status" = 'PAID' AND "paid_at" IS NOT NULL AND "payment_method" IS NOT NULL)
  );

UPDATE "repair_receipts" AS receipt
SET "service_number" = orders."service_number",
    "customer_name" = customers."display_name",
    "customer_phone" = COALESCE(orders."contact_phone", customers."phone_number")
FROM "repair_orders" AS orders
JOIN "users" AS customers ON customers."id" = orders."customer_id"
WHERE receipt."order_id" = orders."id";

ALTER TABLE "repair_receipts"
  ALTER COLUMN "service_number" SET NOT NULL,
  ALTER COLUMN "customer_name" SET NOT NULL;

CREATE UNIQUE INDEX "loyalty_transactions_order_redeem_unique"
  ON "loyalty_transactions" ("order_id")
  WHERE "order_id" IS NOT NULL AND "type" = 'REDEEM';

ALTER TABLE "reviews"
  ADD COLUMN "image_object_id" VARCHAR(255);
ALTER TABLE "reviews" ALTER COLUMN "is_published" SET DEFAULT false;

ALTER TABLE "site_banners"
  ADD COLUMN "placements" TEXT[] NOT NULL DEFAULT ARRAY['HOME']::TEXT[],
  ADD CONSTRAINT "site_banners_placements_nonempty" CHECK (cardinality("placements") > 0);
