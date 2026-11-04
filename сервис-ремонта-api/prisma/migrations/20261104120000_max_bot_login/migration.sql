ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

CREATE TYPE "MaxLoginStatus" AS ENUM ('PENDING', 'AWAITING_CONTACT', 'CONFIRMED', 'COMPLETED', 'FAILED');

CREATE TABLE "max_login_requests" (
    "id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "poll_token_hash" CHAR(64) NOT NULL,
    "status" "MaxLoginStatus" NOT NULL DEFAULT 'PENDING',
    "user_id" UUID,
    "max_user_id" VARCHAR(64),
    "max_display_name" VARCHAR(120),
    "referral_code" VARCHAR(16),
    "account_created" BOOLEAN NOT NULL DEFAULT false,
    "referral_applied" BOOLEAN NOT NULL DEFAULT false,
    "failure_code" VARCHAR(64),
    "failure_message" VARCHAR(500),
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "confirmed_at" TIMESTAMPTZ(3),
    "consumed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "max_login_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "max_login_requests_token_hash_key" ON "max_login_requests"("token_hash");
CREATE UNIQUE INDEX "max_login_requests_poll_token_hash_key" ON "max_login_requests"("poll_token_hash");
CREATE INDEX "max_login_requests_expires_at_idx" ON "max_login_requests"("expires_at");
CREATE INDEX "max_login_requests_max_user_id_status_idx" ON "max_login_requests"("max_user_id", "status");

ALTER TABLE "max_login_requests"
    ADD CONSTRAINT "max_login_requests_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
