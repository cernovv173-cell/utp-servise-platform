CREATE TYPE "CustomerFeedbackType" AS ENUM ('COMPLAINT', 'SUGGESTION');
CREATE TYPE "CustomerFeedbackStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED');

CREATE TABLE "customer_feedback" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "customer_id" UUID NOT NULL,
    "type" "CustomerFeedbackType" NOT NULL,
    "content" VARCHAR(2000) NOT NULL,
    "status" "CustomerFeedbackStatus" NOT NULL DEFAULT 'NEW',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "customer_feedback_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "customer_feedback_customer_id_fkey"
      FOREIGN KEY ("customer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "customer_feedback_status_created_at_idx"
  ON "customer_feedback"("status", "created_at");
CREATE INDEX "customer_feedback_customer_id_created_at_idx"
  ON "customer_feedback"("customer_id", "created_at");
