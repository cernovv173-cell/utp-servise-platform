CREATE TABLE "procurement_suppliers" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "contact_name" VARCHAR(120),
    "phone" VARCHAR(32),
    "email" VARCHAR(320),
    "note" VARCHAR(1000),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "procurement_suppliers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "inventory_stock_receipts" (
    "id" UUID NOT NULL,
    "supplier_id" UUID,
    "supplier_name_snapshot" VARCHAR(160) NOT NULL,
    "catalog_item_id" UUID,
    "item_type" "RepairOrderItemType" NOT NULL,
    "item_name_snapshot" VARCHAR(160) NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_cost_rub" INTEGER,
    "document_reference" VARCHAR(120),
    "received_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_stock_receipts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "inventory_stock_receipts_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "inventory_stock_receipts_unit_cost_check" CHECK ("unit_cost_rub" IS NULL OR "unit_cost_rub" >= 0)
);

CREATE UNIQUE INDEX "procurement_suppliers_name_key" ON "procurement_suppliers"("name");
CREATE INDEX "procurement_suppliers_is_active_name_idx" ON "procurement_suppliers"("is_active", "name");
CREATE INDEX "inventory_stock_receipts_received_at_idx" ON "inventory_stock_receipts"("received_at");
CREATE INDEX "inventory_stock_receipts_supplier_id_received_at_idx" ON "inventory_stock_receipts"("supplier_id", "received_at");
CREATE INDEX "inventory_stock_receipts_catalog_item_id_received_at_idx" ON "inventory_stock_receipts"("catalog_item_id", "received_at");

ALTER TABLE "inventory_stock_receipts"
ADD CONSTRAINT "inventory_stock_receipts_supplier_id_fkey"
FOREIGN KEY ("supplier_id") REFERENCES "procurement_suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inventory_stock_receipts"
ADD CONSTRAINT "inventory_stock_receipts_catalog_item_id_fkey"
FOREIGN KEY ("catalog_item_id") REFERENCES "repair_catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
