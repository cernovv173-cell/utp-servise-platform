CREATE TYPE "CustomerGender" AS ENUM ('MALE', 'FEMALE');

ALTER TABLE "users"
  ADD COLUMN "gender" "CustomerGender",
  ADD COLUMN "birth_date" DATE;

CREATE TABLE "birthday_push_deliveries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "birthday_year" INTEGER NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_until" TIMESTAMPTZ(3),
  "sent_at" TIMESTAMPTZ(3),
  "last_error" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "birthday_push_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "birthday_push_deliveries_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "birthday_push_deliveries_user_id_birthday_year_key"
    UNIQUE ("user_id", "birthday_year")
);

CREATE INDEX "birthday_push_deliveries_birthday_year_sent_at_next_attempt_at_locked_until_idx"
  ON "birthday_push_deliveries"("birthday_year", "sent_at", "next_attempt_at", "locked_until");
