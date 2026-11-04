CREATE TYPE "RepairDeviceType" AS ENUM ('COMPUTER', 'LAPTOP', 'PHONE', 'TABLET');
CREATE TYPE "RepairIntakeMediaType" AS ENUM ('IMAGE', 'VIDEO');

ALTER TABLE "repair_catalog_items"
ADD COLUMN "device_types" "RepairDeviceType"[] NOT NULL DEFAULT ARRAY['COMPUTER', 'LAPTOP', 'PHONE', 'TABLET']::"RepairDeviceType"[];

UPDATE "repair_catalog_items"
SET "device_types" = CASE
  WHEN "name" ILIKE '%ноутбука и персонального компьютера%' THEN ARRAY['COMPUTER', 'LAPTOP']::"RepairDeviceType"[]
  WHEN "name" ILIKE '%ноутбук%' OR "name" ILIKE '%SO-DIMM%' OR "name" ILIKE '%OPTYBAY%' THEN ARRAY['LAPTOP']::"RepairDeviceType"[]
  WHEN "name" ILIKE '%SSD%' OR "name" ILIKE '%Windows%' OR "name" ILIKE '%перенос данных%' OR "name" ILIKE '%копирование%' OR "name" ILIKE '%клонирование%' OR "name" ILIKE '%жесткого диска%' OR "name" ILIKE '%жёсткого диска%' THEN ARRAY['COMPUTER', 'LAPTOP']::"RepairDeviceType"[]
  WHEN "name" ILIKE '%телефон%' OR "name" ILIKE '%смартфон%' THEN ARRAY['PHONE']::"RepairDeviceType"[]
  WHEN "name" ILIKE '%планшет%' THEN ARRAY['TABLET']::"RepairDeviceType"[]
  WHEN "name" ILIKE '%ПК%' OR "name" ILIKE '%персонального компьютера%' OR "name" ILIKE '%персональный компьютер%' OR "name" ILIKE '%материнской плате%' OR "name" ILIKE '%видеокарты%' OR "name" ILIKE '%видеокарту%' OR "name" ILIKE '%блока питания%' OR "name" ILIKE '%процессора%' OR "name" ILIKE '%сетевой карты%' OR "name" ILIKE '%оперативной памяти персонального компьютера%' THEN ARRAY['COMPUTER']::"RepairDeviceType"[]
  ELSE ARRAY['COMPUTER', 'LAPTOP', 'PHONE', 'TABLET']::"RepairDeviceType"[]
END
WHERE "type" IN ('SERVICE', 'SPARE_PART');

ALTER TABLE "repair_order_intakes"
ADD COLUMN "condition_summary" VARCHAR(3000) NOT NULL DEFAULT '',
ADD COLUMN "intake_media_object_id" VARCHAR(255),
ADD COLUMN "intake_media_type" "RepairIntakeMediaType";

UPDATE "repair_order_intakes"
SET "condition_summary" = concat_ws(E'\n',
  NULLIF("front_condition", ''),
  NULLIF("back_condition", ''),
  NULLIF("left_condition", ''),
  NULLIF("right_condition", '')
),
"intake_media_object_id" = COALESCE("front_photo_object_id", "back_photo_object_id", "left_photo_object_id", "right_photo_object_id"),
"intake_media_type" = CASE
  WHEN COALESCE("front_photo_object_id", "back_photo_object_id", "left_photo_object_id", "right_photo_object_id") IS NULL THEN NULL
  ELSE 'IMAGE'::"RepairIntakeMediaType"
END;

ALTER TABLE "news_articles" ADD COLUMN "video_object_id" VARCHAR(255);
ALTER TABLE "site_banners" ADD COLUMN "video_object_id" VARCHAR(255);
