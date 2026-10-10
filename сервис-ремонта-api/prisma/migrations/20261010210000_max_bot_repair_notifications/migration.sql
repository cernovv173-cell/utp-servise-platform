CREATE TYPE "MaxNotificationType" AS ENUM (
    'DEVICE_ACCEPTED',
    'DIAGNOSIS_COMPLETED',
    'READY_FOR_PICKUP'
);

CREATE TYPE "MaxDeliveryStatus" AS ENUM (
    'PENDING',
    'SENT',
    'SKIPPED',
    'FAILED'
);

ALTER TABLE "users"
ADD COLUMN "max_user_id" VARCHAR(64);

CREATE UNIQUE INDEX "users_max_user_id_key"
ON "users"("max_user_id");

CREATE TABLE "max_link_tokens" (
    "id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "max_link_tokens_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "max_notification_deliveries" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" "MaxNotificationType" NOT NULL,
    "status" "MaxDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_until" TIMESTAMPTZ(3),
    "sent_at" TIMESTAMPTZ(3),
    "last_error" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "max_notification_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "max_link_tokens_token_hash_key"
ON "max_link_tokens"("token_hash");

CREATE INDEX "max_link_tokens_user_id_expires_at_idx"
ON "max_link_tokens"("user_id", "expires_at");

CREATE INDEX "max_link_tokens_expires_at_used_at_idx"
ON "max_link_tokens"("expires_at", "used_at");

CREATE UNIQUE INDEX "max_notification_deliveries_order_id_type_key"
ON "max_notification_deliveries"("order_id", "type");

CREATE INDEX "max_notification_deliveries_status_next_attempt_at_locked_until_idx"
ON "max_notification_deliveries"("status", "next_attempt_at", "locked_until");

CREATE INDEX "max_notification_deliveries_user_id_created_at_idx"
ON "max_notification_deliveries"("user_id", "created_at");

ALTER TABLE "max_link_tokens"
ADD CONSTRAINT "max_link_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "max_notification_deliveries"
ADD CONSTRAINT "max_notification_deliveries_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "repair_orders"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "max_notification_deliveries"
ADD CONSTRAINT "max_notification_deliveries_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
