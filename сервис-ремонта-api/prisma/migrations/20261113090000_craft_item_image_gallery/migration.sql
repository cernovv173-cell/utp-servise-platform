ALTER TABLE "craft_items"
ADD COLUMN "image_object_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "craft_items"
SET "image_object_ids" = ARRAY["image_object_id"]
WHERE "image_object_id" IS NOT NULL;
