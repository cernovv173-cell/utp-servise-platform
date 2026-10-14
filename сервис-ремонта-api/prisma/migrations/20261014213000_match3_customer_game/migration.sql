CREATE TABLE "match3_levels" (
    "id" UUID NOT NULL,
    "number" SMALLINT NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "target_part" VARCHAR(32) NOT NULL,
    "target_count" SMALLINT NOT NULL,
    "move_limit" SMALLINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "match3_levels_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "match3_game_sessions" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "level_id" UUID NOT NULL,
    "board" JSONB NOT NULL,
    "target_collected" SMALLINT NOT NULL DEFAULT 0,
    "moves_used" SMALLINT NOT NULL DEFAULT 0,
    "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    CONSTRAINT "match3_game_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "match3_level_completions" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "level_id" UUID NOT NULL,
    "target_collected" SMALLINT NOT NULL,
    "points_awarded" SMALLINT NOT NULL DEFAULT 0,
    "reward_claimed_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "match3_level_completions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "match3_levels_number_key" ON "match3_levels"("number");
CREATE INDEX "match3_levels_is_active_number_idx" ON "match3_levels"("is_active", "number");
CREATE INDEX "match3_game_sessions_customer_id_status_idx" ON "match3_game_sessions"("customer_id", "status");
CREATE INDEX "match3_game_sessions_level_id_created_at_idx" ON "match3_game_sessions"("level_id", "created_at");
CREATE UNIQUE INDEX "match3_game_sessions_one_active_per_customer_key" ON "match3_game_sessions"("customer_id") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "match3_level_completions_customer_id_level_id_key" ON "match3_level_completions"("customer_id", "level_id");
CREATE INDEX "match3_level_completions_customer_id_reward_claimed_at_completed_at_idx" ON "match3_level_completions"("customer_id", "reward_claimed_at", "completed_at");

ALTER TABLE "match3_game_sessions"
    ADD CONSTRAINT "match3_game_sessions_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "match3_game_sessions_level_id_fkey"
    FOREIGN KEY ("level_id") REFERENCES "match3_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "match3_level_completions"
    ADD CONSTRAINT "match3_level_completions_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "match3_level_completions_level_id_fkey"
    FOREIGN KEY ("level_id") REFERENCES "match3_levels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "match3_levels" (
    "id", "number", "title", "target_part", "target_count", "move_limit", "is_active", "updated_at"
)
SELECT
    md5('utp-match3-level-' || level_number)::uuid,
    level_number::SMALLINT,
    format('Этап %s — %s', level_number, part_title),
    part_key,
    (5 + ((level_number - 1) / 4))::SMALLINT,
    (12 + ((level_number - 1) / 5))::SMALLINT,
    true,
    CURRENT_TIMESTAMP
FROM (
    SELECT
        level_number,
        CASE
            WHEN level_number <= 13 THEN 'processor'
            WHEN level_number <= 25 THEN 'ram'
            WHEN level_number <= 38 THEN 'ssd'
            WHEN level_number <= 50 THEN 'cooling'
            WHEN level_number <= 63 THEN 'gpu'
            WHEN level_number <= 75 THEN 'motherboard'
            WHEN level_number <= 88 THEN 'power'
            ELSE 'case'
        END AS part_key,
        CASE
            WHEN level_number <= 13 THEN 'Процессор'
            WHEN level_number <= 25 THEN 'Оперативная память'
            WHEN level_number <= 38 THEN 'SSD-накопитель'
            WHEN level_number <= 50 THEN 'Система охлаждения'
            WHEN level_number <= 63 THEN 'Видеокарта'
            WHEN level_number <= 75 THEN 'Материнская плата'
            WHEN level_number <= 88 THEN 'Блок питания'
            ELSE 'Корпус'
        END AS part_title
    FROM generate_series(1, 100) AS level_number
) AS levels;
