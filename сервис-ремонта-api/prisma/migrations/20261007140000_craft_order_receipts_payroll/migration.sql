ALTER TABLE "craft_orders"
  ADD COLUMN "assigned_technician_id" UUID,
  ADD COLUMN "service_number" VARCHAR(32),
  ADD COLUMN "redeem_bonuses" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "bonus_discount_rub" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "craft_orders_service_number_key"
  ON "craft_orders"("service_number");
CREATE INDEX "craft_orders_assigned_technician_id_status_updated_at_idx"
  ON "craft_orders"("assigned_technician_id", "status", "updated_at");
ALTER TABLE "craft_orders"
  ADD CONSTRAINT "craft_orders_assigned_technician_id_fkey"
  FOREIGN KEY ("assigned_technician_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "craft_order_receipts" (
  "id" UUID NOT NULL,
  "craft_order_id" UUID NOT NULL,
  "receipt_number" VARCHAR(48) NOT NULL,
  "service_number" VARCHAR(32) NOT NULL,
  "customer_name" VARCHAR(120) NOT NULL,
  "customer_phone" VARCHAR(32),
  "issued_by_id" UUID,
  "items_snapshot" JSONB NOT NULL,
  "total_rub" INTEGER NOT NULL,
  "bonus_discount_rub" INTEGER NOT NULL DEFAULT 0,
  "payment_status" "ReceiptPaymentStatus" NOT NULL DEFAULT 'PENDING',
  "payment_method" "ReceiptPaymentMethod",
  "paid_at" TIMESTAMPTZ(3),
  "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "craft_order_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "craft_order_receipts_craft_order_id_fkey"
    FOREIGN KEY ("craft_order_id") REFERENCES "craft_orders"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "craft_order_receipts_issued_by_id_fkey"
    FOREIGN KEY ("issued_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "craft_order_receipts_craft_order_id_key"
  ON "craft_order_receipts"("craft_order_id");
CREATE UNIQUE INDEX "craft_order_receipts_receipt_number_key"
  ON "craft_order_receipts"("receipt_number");

CREATE TABLE "craft_order_salary_entries" (
  "id" UUID NOT NULL,
  "craft_order_id" UUID NOT NULL,
  "technician_id" UUID,
  "service_total_rub" INTEGER NOT NULL,
  "salary_rub" INTEGER NOT NULL,
  "rate_percent" SMALLINT NOT NULL DEFAULT 75,
  "earned_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "craft_order_salary_entries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "craft_order_salary_entries_craft_order_id_fkey"
    FOREIGN KEY ("craft_order_id") REFERENCES "craft_orders"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "craft_order_salary_entries_technician_id_fkey"
    FOREIGN KEY ("technician_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "craft_order_salary_entries_craft_order_id_key"
  ON "craft_order_salary_entries"("craft_order_id");
CREATE INDEX "craft_order_salary_entries_technician_id_earned_at_idx"
  ON "craft_order_salary_entries"("technician_id", "earned_at");
CREATE INDEX "craft_order_salary_entries_earned_at_idx"
  ON "craft_order_salary_entries"("earned_at");

ALTER TABLE "loyalty_transactions"
  ADD COLUMN "craft_order_id" UUID;
CREATE INDEX "loyalty_transactions_craft_order_id_idx"
  ON "loyalty_transactions"("craft_order_id");
ALTER TABLE "loyalty_transactions"
  ADD CONSTRAINT "loyalty_transactions_craft_order_id_fkey"
  FOREIGN KEY ("craft_order_id") REFERENCES "craft_orders"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
