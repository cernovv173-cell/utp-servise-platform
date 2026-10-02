CREATE TABLE "technician_salary_entries" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "technician_id" UUID NOT NULL,
    "service_total_rub" INTEGER NOT NULL,
    "salary_rub" INTEGER NOT NULL,
    "rate_percent" SMALLINT NOT NULL DEFAULT 75,
    "earned_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "technician_salary_entries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "technician_salary_entries_service_total_rub_check" CHECK ("service_total_rub" >= 0),
    CONSTRAINT "technician_salary_entries_salary_rub_check" CHECK ("salary_rub" >= 0),
    CONSTRAINT "technician_salary_entries_rate_percent_check" CHECK ("rate_percent" BETWEEN 0 AND 100)
);

CREATE UNIQUE INDEX "technician_salary_entries_order_id_key"
ON "technician_salary_entries"("order_id");
CREATE INDEX "technician_salary_entries_technician_id_earned_at_idx"
ON "technician_salary_entries"("technician_id", "earned_at");
CREATE INDEX "technician_salary_entries_earned_at_idx"
ON "technician_salary_entries"("earned_at");

ALTER TABLE "technician_salary_entries"
ADD CONSTRAINT "technician_salary_entries_order_id_fkey"
FOREIGN KEY ("order_id") REFERENCES "repair_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "technician_salary_entries"
ADD CONSTRAINT "technician_salary_entries_technician_id_fkey"
FOREIGN KEY ("technician_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "technician_salary_entries" (
    "id",
    "order_id",
    "technician_id",
    "service_total_rub",
    "salary_rub",
    "rate_percent",
    "earned_at"
)
SELECT
    gen_random_uuid(),
    order_row."id",
    order_row."assigned_technician_id",
    service_items."service_total_rub",
    ROUND(service_items."service_total_rub" * 0.75)::INTEGER,
    75,
    COALESCE(completion."completed_at", order_row."updated_at")
FROM "repair_orders" AS order_row
LEFT JOIN LATERAL (
    SELECT event."created_at" AS "completed_at"
    FROM "repair_status_events" AS event
    WHERE event."order_id" = order_row."id"
      AND event."to_status" = 'COMPLETED'
    ORDER BY event."created_at" DESC
    LIMIT 1
) AS completion ON TRUE
LEFT JOIN LATERAL (
    SELECT COALESCE(
        SUM(item."quantity" * item."unit_price_rub") FILTER (WHERE item."type" = 'SERVICE'),
        0
    )::INTEGER AS "service_total_rub"
    FROM "repair_order_items" AS item
    WHERE item."order_id" = order_row."id"
) AS service_items ON TRUE
WHERE order_row."status" = 'COMPLETED'
  AND order_row."assigned_technician_id" IS NOT NULL
ON CONFLICT ("order_id") DO NOTHING;
