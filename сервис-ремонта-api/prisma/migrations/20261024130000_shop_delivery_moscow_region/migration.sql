ALTER TABLE "shop_orders"
    ADD COLUMN "delivery_area" VARCHAR(20),
    ALTER COLUMN "delivery_city" TYPE VARCHAR(120);

ALTER TABLE "shop_orders"
    ADD CONSTRAINT "shop_orders_delivery_area_check"
    CHECK ("delivery_area" IS NULL OR "delivery_area" IN ('MOSCOW', 'MOSCOW_REGION'));
