ALTER TABLE "repair_catalog_items"
ALTER COLUMN "device_types" SET DEFAULT ARRAY['COMPUTER', 'LAPTOP']::"RepairDeviceType"[];
