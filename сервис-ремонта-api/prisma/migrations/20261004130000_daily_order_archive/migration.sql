ALTER TABLE "repair_orders"
ADD COLUMN "archived_at" TIMESTAMPTZ(3);

CREATE INDEX "repair_orders_archived_at_created_at_idx"
ON "repair_orders"("archived_at", "created_at");
