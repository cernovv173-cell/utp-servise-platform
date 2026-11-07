ALTER TABLE "users"
ADD COLUMN "login" VARCHAR(64);

CREATE UNIQUE INDEX "users_login_key" ON "users"("login");

CREATE TABLE "max_credential_deliveries" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "login" VARCHAR(64) NOT NULL,
  "encrypted_password" VARCHAR(512),
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "locked_until" TIMESTAMPTZ(3),
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "sent_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "max_credential_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "max_credential_deliveries_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "max_credential_deliveries_user_id_key"
ON "max_credential_deliveries"("user_id");

CREATE INDEX "max_credential_deliveries_expires_at_sent_at_locked_until_idx"
ON "max_credential_deliveries"("expires_at", "sent_at", "locked_until");
