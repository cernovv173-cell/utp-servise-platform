CREATE TABLE "max_email_login_verifications" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "code_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "failed_attempts" INTEGER NOT NULL DEFAULT 0,
  "request_count" INTEGER NOT NULL DEFAULT 1,
  "request_window_started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "max_email_login_verifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "max_email_login_verifications_user_id_key" UNIQUE ("user_id"),
  CONSTRAINT "max_email_login_verifications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "max_email_login_verifications_expires_at_idx"
  ON "max_email_login_verifications"("expires_at");
