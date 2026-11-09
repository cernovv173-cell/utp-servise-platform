CREATE TABLE IF NOT EXISTS "customer_offer_winner_push_deliveries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "offer_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_until" TIMESTAMPTZ(3),
  "sent_at" TIMESTAMPTZ(3),
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_error" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_offer_winner_push_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_offer_winner_push_deliveries_offer_id_fkey"
    FOREIGN KEY ("offer_id") REFERENCES "customer_offers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "customer_offer_winner_push_deliveries_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "customer_offer_winner_push_deliveries_offer_id_customer_id_key"
  ON "customer_offer_winner_push_deliveries"("offer_id", "customer_id");
CREATE INDEX IF NOT EXISTS "customer_offer_winner_push_deliveries_sent_at_next_attempt_at_locked_until_idx"
  ON "customer_offer_winner_push_deliveries"("sent_at", "next_attempt_at", "locked_until");
CREATE INDEX IF NOT EXISTS "customer_offer_winner_push_deliveries_customer_id_sent_at_idx"
  ON "customer_offer_winner_push_deliveries"("customer_id", "sent_at");

INSERT INTO "customer_offer_winner_push_deliveries" ("offer_id", "customer_id")
SELECT offer."id", participation."customer_id"
FROM "customer_offers" AS offer
JOIN "customer_offer_participations" AS participation
  ON participation."offer_id" = offer."id"
WHERE offer."type"::text = 'GIVEAWAY'
  AND offer."is_published" = TRUE
  AND offer."results_published_at" IS NOT NULL
  AND participation."place" IS NOT NULL
ON CONFLICT ("offer_id", "customer_id") DO NOTHING;
