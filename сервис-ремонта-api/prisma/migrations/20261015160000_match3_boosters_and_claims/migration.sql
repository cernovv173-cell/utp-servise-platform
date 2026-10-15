CREATE TABLE "match3_inventory" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "item_key" VARCHAR(32) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "match3_inventory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "match3_inventory_quantity_nonnegative" CHECK ("quantity" >= 0)
);

CREATE UNIQUE INDEX "match3_inventory_customer_id_item_key_key"
    ON "match3_inventory"("customer_id", "item_key");

ALTER TABLE "match3_inventory"
    ADD CONSTRAINT "match3_inventory_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
