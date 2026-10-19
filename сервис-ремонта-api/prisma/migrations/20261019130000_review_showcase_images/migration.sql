ALTER TABLE "reviews"
  ADD COLUMN "client_photo_object_id" VARCHAR(255),
  ADD COLUMN "client_photo_consent_at" TIMESTAMPTZ(3),
  ADD COLUMN "work_photo_object_id" VARCHAR(255);
