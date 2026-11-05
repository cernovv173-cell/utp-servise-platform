CREATE TYPE "ProductAnalyticsMetric" AS ENUM ('LOGIN', 'REGISTRATION', 'APP_DOWNLOAD');

CREATE TYPE "ProductAnalyticsChannel" AS ENUM ('WEB', 'ANDROID', 'MAX', 'OTHER');

CREATE TABLE "product_analytics_daily_metrics" (
    "day" DATE NOT NULL,
    "metric" "ProductAnalyticsMetric" NOT NULL,
    "channel" "ProductAnalyticsChannel" NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "product_analytics_daily_metrics_pkey" PRIMARY KEY ("day", "metric", "channel")
);
