ALTER TABLE "repair_orders"
  ADD COLUMN "review_requested_at" TIMESTAMPTZ(3),
  ADD COLUMN "review_requested_by_id" UUID;

ALTER TABLE "repair_orders"
  ADD CONSTRAINT "repair_orders_review_requested_by_id_fkey"
  FOREIGN KEY ("review_requested_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
