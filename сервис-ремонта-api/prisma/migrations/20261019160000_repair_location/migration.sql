CREATE TYPE "RepairLocation" AS ENUM ('CUSTOMER_ADDRESS', 'SERVICE_CENTER');

ALTER TABLE "repair_orders"
  ADD COLUMN "repair_location" "RepairLocation";
