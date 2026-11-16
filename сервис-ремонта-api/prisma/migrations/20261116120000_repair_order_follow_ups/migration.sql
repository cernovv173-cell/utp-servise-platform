CREATE TYPE "RepairOrderFollowUpStatus" AS ENUM (
  'PENDING',
  'SENT',
  'WORKING',
  'NEEDS_HELP',
  'FAILED'
);

CREATE TABLE "repair_order_follow_ups" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "order_id" UUID NOT NULL,
  "status" "RepairOrderFollowUpStatus" NOT NULL DEFAULT 'PENDING',
  "scheduled_at" TIMESTAMPTZ(3) NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_until" TIMESTAMPTZ(3),
  "sent_at" TIMESTAMPTZ(3),
  "answered_at" TIMESTAMPTZ(3),
  "last_error" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "repair_order_follow_ups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "repair_order_follow_ups_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "repair_orders"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "repair_order_follow_ups_order_id_key"
  ON "repair_order_follow_ups"("order_id");
CREATE INDEX "repair_order_follow_ups_status_next_attempt_at_locked_until_idx"
  ON "repair_order_follow_ups"("status", "next_attempt_at", "locked_until");
