CREATE TABLE "customer_business_profiles" (
  "id" UUID NOT NULL,
  "owner_user_id" UUID NOT NULL,
  "company_name" VARCHAR(160) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "customer_business_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "customer_business_profiles_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "customer_business_profiles_owner_user_id_key"
  ON "customer_business_profiles"("owner_user_id");

ALTER TABLE "customer_devices"
  ADD COLUMN "business_profile_id" UUID;

ALTER TABLE "repair_orders"
  ADD COLUMN "business_profile_id" UUID;

CREATE INDEX "customer_devices_business_profile_id_created_at_idx"
  ON "customer_devices"("business_profile_id", "created_at");

CREATE INDEX "repair_orders_business_profile_id_created_at_idx"
  ON "repair_orders"("business_profile_id", "created_at");

ALTER TABLE "customer_devices"
  ADD CONSTRAINT "customer_devices_business_profile_id_fkey"
  FOREIGN KEY ("business_profile_id") REFERENCES "customer_business_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "repair_orders"
  ADD CONSTRAINT "repair_orders_business_profile_id_fkey"
  FOREIGN KEY ("business_profile_id") REFERENCES "customer_business_profiles"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
