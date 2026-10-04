ALTER TYPE "RepairStatus" ADD VALUE 'READY_FOR_PICKUP';

CREATE TABLE "repair_order_intakes" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "front_condition" VARCHAR(1000) NOT NULL DEFAULT '',
    "front_photo_object_id" VARCHAR(255),
    "back_condition" VARCHAR(1000) NOT NULL DEFAULT '',
    "back_photo_object_id" VARCHAR(255),
    "left_condition" VARCHAR(1000) NOT NULL DEFAULT '',
    "left_photo_object_id" VARCHAR(255),
    "right_condition" VARCHAR(1000) NOT NULL DEFAULT '',
    "right_photo_object_id" VARCHAR(255),
    "serial_number" VARCHAR(160),
    "included_accessories" VARCHAR(1000) NOT NULL DEFAULT '',
    "intake_notes" VARCHAR(2000) NOT NULL DEFAULT '',
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "repair_order_intakes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "repair_order_intakes_order_id_key" ON "repair_order_intakes"("order_id");

CREATE TABLE "repair_order_pickup_codes" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "repair_order_pickup_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "repair_order_pickup_codes_order_id_key" ON "repair_order_pickup_codes"("order_id");
CREATE UNIQUE INDEX "repair_order_pickup_codes_token_hash_key" ON "repair_order_pickup_codes"("token_hash");
CREATE INDEX "repair_order_pickup_codes_expires_at_used_at_idx" ON "repair_order_pickup_codes"("expires_at", "used_at");

CREATE TABLE "repair_warranties" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "warranty_number" VARCHAR(48) NOT NULL,
    "customer_name" VARCHAR(120) NOT NULL,
    "device_type" VARCHAR(120) NOT NULL,
    "repair_summary" VARCHAR(2000) NOT NULL,
    "warranty_days" INTEGER NOT NULL,
    "terms" VARCHAR(2000) NOT NULL,
    "issued_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "issued_by_id" UUID,
    CONSTRAINT "repair_warranties_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "repair_warranties_order_id_key" ON "repair_warranties"("order_id");
CREATE UNIQUE INDEX "repair_warranties_warranty_number_key" ON "repair_warranties"("warranty_number");

ALTER TABLE "repair_order_intakes"
    ADD CONSTRAINT "repair_order_intakes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "repair_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "repair_order_intakes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT "repair_order_intakes_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "repair_order_pickup_codes"
    ADD CONSTRAINT "repair_order_pickup_codes_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "repair_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "repair_warranties"
    ADD CONSTRAINT "repair_warranties_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "repair_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT "repair_warranties_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
