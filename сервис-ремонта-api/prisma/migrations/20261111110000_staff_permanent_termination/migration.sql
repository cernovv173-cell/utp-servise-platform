ALTER TABLE "users"
ADD COLUMN "terminated_at" TIMESTAMPTZ(3),
ADD COLUMN "terminated_by_id" UUID;

CREATE INDEX "users_terminated_by_id_idx" ON "users"("terminated_by_id");

ALTER TABLE "users"
ADD CONSTRAINT "users_terminated_by_id_fkey"
FOREIGN KEY ("terminated_by_id") REFERENCES "users"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
