CREATE TYPE "RepairWorkActStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED');

ALTER TABLE "repair_orders"
    ADD COLUMN "work_act_required" BOOLEAN NOT NULL DEFAULT FALSE;

-- Existing repairs keep their current closeout flow. New API-created orders set this flag explicitly.

CREATE TABLE "repair_work_acts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "created_by_id" UUID,
    "approved_by_id" UUID,
    "status" "RepairWorkActStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "items_snapshot" JSONB NOT NULL DEFAULT '[]'::jsonb,
    "approved_items_snapshot" JSONB,
    "removed_items_snapshot" JSONB,
    "submitted_at" TIMESTAMPTZ(3),
    "approved_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_work_acts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "repair_work_acts_revision_check" CHECK ("revision" >= 1),
    CONSTRAINT "repair_work_acts_order_id_key" UNIQUE ("order_id")
);

CREATE INDEX "repair_work_acts_status_submitted_at_idx"
    ON "repair_work_acts"("status", "submitted_at");

ALTER TABLE "repair_work_acts"
    ADD CONSTRAINT "repair_work_acts_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "repair_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "repair_work_acts_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "repair_work_acts_approved_by_id_fkey"
    FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
