CREATE TYPE "RepairEstimateKind" AS ENUM ('INITIAL', 'ADDITIONAL');
CREATE TYPE "RepairEstimateStatus" AS ENUM ('PENDING', 'APPROVED', 'DECLINED', 'SUPERSEDED');

CREATE TABLE "repair_estimates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "created_by_id" UUID,
    "version" INTEGER NOT NULL,
    "kind" "RepairEstimateKind" NOT NULL,
    "status" "RepairEstimateStatus" NOT NULL DEFAULT 'PENDING',
    "diagnosis" VARCHAR(2000) NOT NULL,
    "items_snapshot" JSONB NOT NULL,
    "total_rub" INTEGER NOT NULL,
    "customer_response_note" VARCHAR(500),
    "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_estimates_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "repair_estimates_total_rub_check" CHECK ("total_rub" >= 0),
    CONSTRAINT "repair_estimates_order_id_version_key" UNIQUE ("order_id", "version")
);

CREATE INDEX "repair_estimates_order_id_status_version_idx"
    ON "repair_estimates"("order_id", "status", "version");

ALTER TABLE "repair_estimates"
    ADD CONSTRAINT "repair_estimates_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "repair_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "repair_estimates_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
