ALTER TABLE "news_articles"
  ADD COLUMN "starts_at" TIMESTAMPTZ(3),
  ADD COLUMN "ends_at" TIMESTAMPTZ(3),
  ADD COLUMN "is_featured" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "news_articles_public_schedule_idx"
  ON "news_articles" ("is_published", "starts_at", "ends_at", "published_at");
