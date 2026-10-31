CREATE TABLE "technician_profiles" (
    "user_id" UUID NOT NULL,
    "experience_years" SMALLINT,
    "bio" VARCHAR(2000) NOT NULL DEFAULT '',
    "certificates" JSONB NOT NULL DEFAULT '[]',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "verified_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "technician_profiles_pkey" PRIMARY KEY ("user_id"),
    CONSTRAINT "technician_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
ALTER TABLE "repair_order_photos" ADD COLUMN "portfolio_consent_at" TIMESTAMPTZ(3);
