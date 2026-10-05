ALTER TABLE "users" ADD COLUMN "yandex_id" VARCHAR(128);

CREATE UNIQUE INDEX "users_yandex_id_key" ON "users"("yandex_id");
