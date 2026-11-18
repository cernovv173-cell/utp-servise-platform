ALTER TYPE "RepairDeviceType" ADD VALUE IF NOT EXISTS 'MONOBLOCK';

CREATE TYPE "RepairCatalogServiceCategory" AS ENUM ('SOFTWARE');

ALTER TABLE "repair_catalog_items"
ADD COLUMN "service_category" "RepairCatalogServiceCategory";

UPDATE "repair_catalog_items"
SET "service_category" = 'SOFTWARE'
WHERE "type" = 'SERVICE'
  AND "name" IN (
    'Создание учетной записи Microsoft',
    'Установка Windows 10',
    'Установка Windows 11',
    'Установка Windows 7',
    'Установка Windows 8 – 8.1',
    'Установка Windows Server',
    'Установка Windows Vista',
    'Установка Windows XP',
    'Установка антивирусной программы',
    'Установка дополнительных программ (офисных программ и мультимедийных приложений)',
    'Установка драйверов'
  );
