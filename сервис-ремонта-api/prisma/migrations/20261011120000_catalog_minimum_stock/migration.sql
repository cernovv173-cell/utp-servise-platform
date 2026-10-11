ALTER TABLE "repair_catalog_items"
ADD COLUMN "minimum_stock_quantity" INTEGER;

UPDATE "repair_catalog_items"
SET "minimum_stock_quantity" = 3
WHERE "type" <> 'SERVICE'
  AND "stock_quantity" IS NOT NULL;
