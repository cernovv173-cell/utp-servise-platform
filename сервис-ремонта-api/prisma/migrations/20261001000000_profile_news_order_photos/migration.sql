ALTER TABLE "users" ADD COLUMN "avatar_object_id" VARCHAR(255);
ALTER TABLE "news_articles" ADD COLUMN "image_object_id" VARCHAR(255);

CREATE TABLE "repair_order_photos" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "object_id" VARCHAR(255) NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "repair_order_photos_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "repair_order_photos_object_id_key" UNIQUE ("object_id")
);

CREATE INDEX "repair_order_photos_order_id_created_at_idx" ON "repair_order_photos"("order_id", "created_at");

ALTER TABLE "repair_order_photos" ADD CONSTRAINT "repair_order_photos_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "repair_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "repair_order_photos" ADD CONSTRAINT "repair_order_photos_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
