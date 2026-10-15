CREATE TABLE "match3_level_rewards" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "level_id" UUID NOT NULL,
    "points_awarded" SMALLINT NOT NULL DEFAULT 10,
    "reward_claimed_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "match3_level_rewards_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "match3_level_rewards_customer_id_reward_claimed_at_completed_at_idx"
    ON "match3_level_rewards"("customer_id", "reward_claimed_at", "completed_at");

CREATE INDEX "match3_level_rewards_customer_id_level_id_completed_at_idx"
    ON "match3_level_rewards"("customer_id", "level_id", "completed_at");

ALTER TABLE "match3_level_rewards"
    ADD CONSTRAINT "match3_level_rewards_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "match3_level_rewards"
    ADD CONSTRAINT "match3_level_rewards_level_id_fkey"
    FOREIGN KEY ("level_id") REFERENCES "match3_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
