CREATE TABLE "customer_devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "device_type" VARCHAR(120) NOT NULL,
    "nickname" VARCHAR(120),
    "brand" VARCHAR(120),
    "model" VARCHAR(160),
    "serial_number" VARCHAR(160),
    "next_maintenance_at" DATE,
    "maintenance_note" VARCHAR(250),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "customer_devices_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_devices_customer_id_fkey"
        FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "customer_devices_customer_id_created_at_idx"
    ON "customer_devices"("customer_id", "created_at");

ALTER TABLE "repair_orders"
    ADD COLUMN "customer_device_id" UUID,
    ADD CONSTRAINT "repair_orders_customer_device_id_fkey"
        FOREIGN KEY ("customer_device_id") REFERENCES "customer_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "repair_orders_customer_device_id_idx"
    ON "repair_orders"("customer_device_id");

CREATE TABLE "device_maintenance_reminder_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "device_id" UUID NOT NULL,
    "scheduled_for" DATE NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locked_until" TIMESTAMPTZ(3),
    "sent_at" TIMESTAMPTZ(3),
    "last_error" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "device_maintenance_reminder_deliveries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "device_maintenance_reminder_deliveries_device_id_fkey"
        FOREIGN KEY ("device_id") REFERENCES "customer_devices"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "device_maintenance_reminder_deliveries_device_id_scheduled_for_key"
    ON "device_maintenance_reminder_deliveries"("device_id", "scheduled_for");
CREATE INDEX "device_maintenance_reminder_deliveries_sent_at_next_attempt_at_locked_until_idx"
    ON "device_maintenance_reminder_deliveries"("sent_at", "next_attempt_at", "locked_until");
