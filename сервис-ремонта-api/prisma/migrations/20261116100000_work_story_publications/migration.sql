CREATE TYPE "NewsArticleKind" AS ENUM ('NEWS', 'WORK_STORY');

ALTER TABLE "news_articles"
ADD COLUMN "kind" "NewsArticleKind" NOT NULL DEFAULT 'NEWS';

CREATE INDEX "news_articles_kind_is_published_published_at_idx"
ON "news_articles"("kind", "is_published", "published_at");
