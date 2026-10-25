ALTER TABLE "shop_orders"
    ADD COLUMN "delivery_method" VARCHAR(16) NOT NULL DEFAULT 'PICKUP',
    ADD COLUMN "delivery_city" VARCHAR(32),
    ADD COLUMN "delivery_address" VARCHAR(500),
    ADD COLUMN "delivery_request_note" VARCHAR(500),
    ADD COLUMN "delivery_fee_rub" INTEGER,
    ADD COLUMN "delivery_window" VARCHAR(160),
    ADD COLUMN "delivery_offer_accepted_at" TIMESTAMPTZ(3);

ALTER TABLE "shop_orders"
    ADD CONSTRAINT "shop_orders_delivery_fee_rub_nonnegative_check"
    CHECK ("delivery_fee_rub" IS NULL OR "delivery_fee_rub" >= 0);
