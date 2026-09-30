CREATE TABLE "repair_catalog_items" (
    "id" UUID NOT NULL,
    "type" "RepairOrderItemType" NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "unit_price_rub" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "repair_catalog_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "repair_catalog_items_unit_price_rub_check" CHECK ("unit_price_rub" >= 0 AND "unit_price_rub" <= 10000000)
);

CREATE INDEX "repair_catalog_items_active_type_name_idx" ON "repair_catalog_items"("active", "type", "name");
ALTER TABLE "repair_catalog_items" ADD CONSTRAINT "repair_catalog_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "repair_order_items" ADD COLUMN "catalog_item_id" UUID;
CREATE INDEX "repair_order_items_catalog_item_id_idx" ON "repair_order_items"("catalog_item_id");
ALTER TABLE "repair_order_items" ADD CONSTRAINT "repair_order_items_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "repair_catalog_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "news_articles" (
    "id" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "content" VARCHAR(8000) NOT NULL,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ(3),
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "news_articles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "news_articles_is_published_published_at_idx" ON "news_articles"("is_published", "published_at");
ALTER TABLE "news_articles" ADD CONSTRAINT "news_articles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
