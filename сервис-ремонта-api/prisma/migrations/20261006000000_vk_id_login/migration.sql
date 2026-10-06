ALTER TABLE "users" ADD COLUMN "vk_id" VARCHAR(128);

CREATE UNIQUE INDEX "users_vk_id_key" ON "users"("vk_id");
