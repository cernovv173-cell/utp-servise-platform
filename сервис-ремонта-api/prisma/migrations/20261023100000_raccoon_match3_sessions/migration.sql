CREATE TABLE "raccoon_match3_sessions" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "level_id" UUID NOT NULL,
    "state" JSONB NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    CONSTRAINT "raccoon_match3_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "raccoon_match3_sessions_customer_id_status_idx"
    ON "raccoon_match3_sessions"("customer_id", "status");
CREATE INDEX "raccoon_match3_sessions_level_id_created_at_idx"
    ON "raccoon_match3_sessions"("level_id", "created_at");
CREATE UNIQUE INDEX "raccoon_match3_sessions_one_active_per_customer_key"
    ON "raccoon_match3_sessions"("customer_id") WHERE "status" = 'ACTIVE';

ALTER TABLE "raccoon_match3_sessions"
    ADD CONSTRAINT "raccoon_match3_sessions_customer_id_fkey"
        FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "raccoon_match3_sessions_level_id_fkey"
        FOREIGN KEY ("level_id") REFERENCES "match3_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
