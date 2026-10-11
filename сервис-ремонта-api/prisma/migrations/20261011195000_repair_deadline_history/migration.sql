CREATE TABLE "repair_order_deadline_changes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "actor_id" UUID,
    "previous_expected_at" TIMESTAMPTZ(3),
    "expected_completion_at" TIMESTAMPTZ(3),
    "note" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "repair_order_deadline_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "repair_order_deadline_changes_order_id_created_at_idx"
    ON "repair_order_deadline_changes"("order_id", "created_at");

ALTER TABLE "repair_order_deadline_changes"
    ADD CONSTRAINT "repair_order_deadline_changes_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "repair_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "repair_order_deadline_changes_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
