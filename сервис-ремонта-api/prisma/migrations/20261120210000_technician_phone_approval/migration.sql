CREATE TYPE "CustomerApprovalMethod" AS ENUM ('PHONE');

ALTER TABLE "repair_orders"
ADD COLUMN "visit_pickup_approval_method" "CustomerApprovalMethod",
ADD COLUMN "onsite_approval_method" "CustomerApprovalMethod";

ALTER TABLE "repair_estimates"
ADD COLUMN "response_method" "CustomerApprovalMethod",
ADD COLUMN "responded_by_id" UUID;

ALTER TABLE "repair_work_acts"
ADD COLUMN "approval_method" "CustomerApprovalMethod";

ALTER TABLE "repair_estimates"
ADD CONSTRAINT "repair_estimates_responded_by_id_fkey"
FOREIGN KEY ("responded_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "repair_estimates_responded_by_id_idx"
ON "repair_estimates"("responded_by_id");
