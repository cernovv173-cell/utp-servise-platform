ALTER TABLE "repair_orders"
    ADD COLUMN "warranty_origin_order_id" UUID,
    ADD CONSTRAINT "repair_orders_warranty_origin_order_id_fkey"
        FOREIGN KEY ("warranty_origin_order_id") REFERENCES "repair_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "repair_orders_warranty_origin_order_id_idx"
    ON "repair_orders"("warranty_origin_order_id");
