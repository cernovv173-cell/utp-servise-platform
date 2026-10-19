CREATE TABLE "birthday_bonus_awards" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "birthday_year" INTEGER NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "birthday_bonus_awards_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "birthday_bonus_awards_user_id_birthday_year_key"
    UNIQUE ("user_id", "birthday_year"),
  CONSTRAINT "birthday_bonus_awards_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);
