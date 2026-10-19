ALTER TABLE "repair_catalog_items"
  ADD COLUMN "description" VARCHAR(2000),
  ADD COLUMN "image_object_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
