ALTER TYPE "BonusTransactionType" ADD VALUE 'REFERRAL_REWARD';

CREATE TYPE "ReferralStatus" AS ENUM ('PENDING', 'REWARDED');

ALTER TABLE "users"
    ADD COLUMN "referral_code" VARCHAR(16);

CREATE UNIQUE INDEX "users_referral_code_key"
    ON "users"("referral_code");

CREATE TABLE "customer_referrals" (
    "id" UUID NOT NULL,
    "referrer_id" UUID NOT NULL,
    "invitee_id" UUID NOT NULL,
    "status" "ReferralStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rewarded_at" TIMESTAMPTZ(3),
    "reward_order_id" UUID,
    CONSTRAINT "customer_referrals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_referrals_invitee_id_key"
    ON "customer_referrals"("invitee_id");

CREATE UNIQUE INDEX "customer_referrals_reward_order_id_key"
    ON "customer_referrals"("reward_order_id");

CREATE INDEX "customer_referrals_referrer_id_status_created_at_idx"
    ON "customer_referrals"("referrer_id", "status", "created_at");

ALTER TABLE "customer_referrals"
    ADD CONSTRAINT "customer_referrals_referrer_id_fkey"
    FOREIGN KEY ("referrer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "customer_referrals_invitee_id_fkey"
    FOREIGN KEY ("invitee_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT "customer_referrals_reward_order_id_fkey"
    FOREIGN KEY ("reward_order_id") REFERENCES "repair_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "loyalty_transactions"
    ADD COLUMN "referral_id" UUID;

CREATE UNIQUE INDEX "loyalty_transactions_referral_id_customer_id_key"
    ON "loyalty_transactions"("referral_id", "customer_id");

ALTER TABLE "loyalty_transactions"
    ADD CONSTRAINT "loyalty_transactions_referral_id_fkey"
    FOREIGN KEY ("referral_id") REFERENCES "customer_referrals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
