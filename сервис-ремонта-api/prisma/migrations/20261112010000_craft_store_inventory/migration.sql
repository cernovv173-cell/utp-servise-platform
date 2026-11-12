ALTER TABLE "craft_items"
ADD COLUMN "stock_quantity" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "shop_order_items"
ADD COLUMN "craft_item_id" UUID;

ALTER TABLE "shop_order_items"
ADD CONSTRAINT "shop_order_items_craft_item_id_fkey"
FOREIGN KEY ("craft_item_id") REFERENCES "craft_items"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "shop_order_items_craft_item_id_idx"
ON "shop_order_items"("craft_item_id");
