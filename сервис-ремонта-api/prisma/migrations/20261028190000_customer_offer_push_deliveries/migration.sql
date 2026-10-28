CREATE TABLE "customer_offer_push_deliveries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "offer_id" UUID NOT NULL,
  "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_until" TIMESTAMPTZ(3),
  "sent_at" TIMESTAMPTZ(3),
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_error" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_offer_push_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_offer_push_deliveries_offer_id_fkey"
    FOREIGN KEY ("offer_id") REFERENCES "customer_offers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "customer_offer_push_deliveries_offer_id_key"
  ON "customer_offer_push_deliveries"("offer_id");
CREATE INDEX "customer_offer_push_deliveries_sent_at_next_attempt_at_locked_until_idx"
  ON "customer_offer_push_deliveries"("sent_at", "next_attempt_at", "locked_until");
