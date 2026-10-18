ALTER TYPE "BonusTransactionType" ADD VALUE 'OFFER_REWARD';

CREATE TYPE "CustomerOfferType" AS ENUM ('PROMOTION', 'GIVEAWAY');

CREATE TABLE "customer_offers" (
    "id" UUID NOT NULL,
    "type" "CustomerOfferType" NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "content" VARCHAR(8000) NOT NULL,
    "first_place_prize" VARCHAR(500),
    "first_place_points" INTEGER NOT NULL DEFAULT 0,
    "second_place_prize" VARCHAR(500),
    "second_place_points" INTEGER NOT NULL DEFAULT 0,
    "third_place_prize" VARCHAR(500),
    "third_place_points" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "drawn_at" TIMESTAMPTZ(3),
    "results_published_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "customer_offers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_offers_schedule_check" CHECK ("ends_at" > "starts_at"),
    CONSTRAINT "customer_offers_place_points_check" CHECK (
        "first_place_points" BETWEEN 0 AND 100000
        AND "second_place_points" BETWEEN 0 AND 100000
        AND "third_place_points" BETWEEN 0 AND 100000
    ),
    CONSTRAINT "customer_offers_rewards_check" CHECK (
        (
            "type" = 'GIVEAWAY'
            AND (("first_place_prize" IS NOT NULL AND length(trim("first_place_prize")) > 0) OR "first_place_points" > 0)
            AND (("second_place_prize" IS NOT NULL AND length(trim("second_place_prize")) > 0) OR "second_place_points" > 0)
            AND (("third_place_prize" IS NOT NULL AND length(trim("third_place_prize")) > 0) OR "third_place_points" > 0)
        )
        OR (
            "type" = 'PROMOTION'
            AND "first_place_prize" IS NULL AND "first_place_points" = 0
            AND "second_place_prize" IS NULL AND "second_place_points" = 0
            AND "third_place_prize" IS NULL AND "third_place_points" = 0
        )
    )
);

CREATE TABLE "customer_offer_participations" (
    "id" UUID NOT NULL,
    "offer_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "place" SMALLINT,
    CONSTRAINT "customer_offer_participations_place_check" CHECK ("place" IS NULL OR "place" BETWEEN 1 AND 3),
    CONSTRAINT "customer_offer_participations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_offer_participations_offer_id_customer_id_key"
    ON "customer_offer_participations"("offer_id", "customer_id");

CREATE INDEX "customer_offers_is_published_starts_at_ends_at_idx"
    ON "customer_offers"("is_published", "starts_at", "ends_at");

CREATE INDEX "customer_offers_type_ends_at_idx"
    ON "customer_offers"("type", "ends_at");

CREATE UNIQUE INDEX "customer_offer_participations_offer_id_place_key"
    ON "customer_offer_participations"("offer_id", "place");

CREATE INDEX "customer_offer_participations_offer_id_joined_at_idx"
    ON "customer_offer_participations"("offer_id", "joined_at");

CREATE INDEX "customer_offer_participations_customer_id_joined_at_idx"
    ON "customer_offer_participations"("customer_id", "joined_at");

ALTER TABLE "loyalty_transactions"
    ADD COLUMN "customer_offer_id" UUID;

CREATE UNIQUE INDEX "loyalty_transactions_customer_offer_id_customer_id_key"
    ON "loyalty_transactions"("customer_offer_id", "customer_id");

ALTER TABLE "customer_offers"
    ADD CONSTRAINT "customer_offers_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "customer_offer_participations"
    ADD CONSTRAINT "customer_offer_participations_offer_id_fkey"
    FOREIGN KEY ("offer_id") REFERENCES "customer_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "customer_offer_participations_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "loyalty_transactions"
    ADD CONSTRAINT "loyalty_transactions_customer_offer_id_fkey"
    FOREIGN KEY ("customer_offer_id") REFERENCES "customer_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
