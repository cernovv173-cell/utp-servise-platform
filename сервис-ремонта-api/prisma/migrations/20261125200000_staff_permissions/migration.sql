ALTER TABLE "users"
ADD COLUMN "staff_permissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "staff_permissions_configured" BOOLEAN NOT NULL DEFAULT FALSE;
