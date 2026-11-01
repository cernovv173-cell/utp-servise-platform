CREATE TABLE "customer_referral_codes" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "slot" SMALLINT NOT NULL,
    "code" VARCHAR(16) NOT NULL,
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "claimed_at" TIMESTAMPTZ(3),
    CONSTRAINT "customer_referral_codes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_referral_codes_slot_check" CHECK ("slot" BETWEEN 1 AND 3),
    CONSTRAINT "customer_referral_codes_expiry_check" CHECK ("expires_at" > "issued_at")
);

CREATE UNIQUE INDEX "customer_referral_codes_owner_id_slot_key"
    ON "customer_referral_codes"("owner_id", "slot");

CREATE UNIQUE INDEX "customer_referral_codes_code_key"
    ON "customer_referral_codes"("code");

CREATE INDEX "customer_referral_codes_owner_id_expires_at_idx"
    ON "customer_referral_codes"("owner_id", "expires_at");

ALTER TABLE "customer_referral_codes"
    ADD CONSTRAINT "customer_referral_codes_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "customer_referrals"
    ADD COLUMN "promo_code_id" UUID;

CREATE UNIQUE INDEX "customer_referrals_promo_code_id_key"
    ON "customer_referrals"("promo_code_id");

ALTER TABLE "customer_referrals"
    ADD CONSTRAINT "customer_referrals_promo_code_id_fkey"
    FOREIGN KEY ("promo_code_id") REFERENCES "customer_referral_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
