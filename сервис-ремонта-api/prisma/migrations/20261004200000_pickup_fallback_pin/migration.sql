ALTER TABLE "repair_order_pickup_codes"
    ADD COLUMN "fallback_code_hash" CHAR(64),
    ADD COLUMN "fallback_code_salt" CHAR(32),
    ADD COLUMN "fallback_code_attempts" INTEGER NOT NULL DEFAULT 0;
