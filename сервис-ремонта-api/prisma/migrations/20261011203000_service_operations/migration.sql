CREATE TYPE "RepairOrderPriority" AS ENUM ('NORMAL', 'URGENT');

ALTER TABLE "repair_orders"
    ADD COLUMN "device_brand" VARCHAR(120),
    ADD COLUMN "device_model" VARCHAR(160),
    ADD COLUMN "device_serial_number" VARCHAR(160),
    ADD COLUMN "priority" "RepairOrderPriority" NOT NULL DEFAULT 'NORMAL';

CREATE INDEX "repair_orders_preferred_at_status_idx"
    ON "repair_orders"("preferred_at", "status");

CREATE INDEX "repair_orders_status_expected_completion_at_idx"
    ON "repair_orders"("status", "expected_completion_at");
