CREATE TABLE "news_push_deliveries" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "article_id" UUID NOT NULL,
  "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_until" TIMESTAMPTZ(3),
  "sent_at" TIMESTAMPTZ(3),
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_error" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "news_push_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "news_push_deliveries_article_id_fkey"
    FOREIGN KEY ("article_id") REFERENCES "news_articles"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "news_push_deliveries_article_id_key"
  ON "news_push_deliveries"("article_id");
CREATE INDEX "news_push_deliveries_sent_at_next_attempt_at_locked_until_idx"
  ON "news_push_deliveries"("sent_at", "next_attempt_at", "locked_until");
