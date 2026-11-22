CREATE TYPE "MonthlySalaryReportDeliveryStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'SENDING',
  'SENT',
  'FAILED',
  'UNKNOWN',
  'SKIPPED'
);

CREATE TABLE "technician_monthly_salary_reports" (
  "id" UUID NOT NULL,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "file_object_id" VARCHAR(255) NOT NULL,
  "file_name" VARCHAR(180) NOT NULL,
  "work_count" INTEGER NOT NULL,
  "technician_count" INTEGER NOT NULL,
  "total_salary_rub" INTEGER NOT NULL,
  "generated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "technician_monthly_salary_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "technician_monthly_salary_reports_period_start_key"
  ON "technician_monthly_salary_reports"("period_start");

CREATE TABLE "technician_monthly_salary_report_deliveries" (
  "id" UUID NOT NULL,
  "report_id" UUID NOT NULL,
  "recipient_user_id" UUID NOT NULL,
  "status" "MonthlySalaryReportDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_until" TIMESTAMPTZ(3),
  "sent_at" TIMESTAMPTZ(3),
  "last_error" VARCHAR(500),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "technician_monthly_salary_report_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "technician_monthly_salary_report_deliveries_report_id_fkey"
    FOREIGN KEY ("report_id") REFERENCES "technician_monthly_salary_reports"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "technician_monthly_salary_report_deliveries_recipient_user_id_fkey"
    FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "technician_monthly_salary_report_deliveries_report_id_recipient_user_id_key"
  ON "technician_monthly_salary_report_deliveries"("report_id", "recipient_user_id");
CREATE INDEX "technician_monthly_salary_report_deliveries_status_next_attempt_at_locked_until_idx"
  ON "technician_monthly_salary_report_deliveries"("status", "next_attempt_at", "locked_until");
CREATE INDEX "technician_monthly_salary_report_deliveries_recipient_user_id_created_at_idx"
  ON "technician_monthly_salary_report_deliveries"("recipient_user_id", "created_at");

INSERT INTO "app_settings" ("key", "value", "updated_at")
VALUES (
  'technician_monthly_salary_report',
  jsonb_build_object(
    'enabledAt',
    to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
  ),
  CURRENT_TIMESTAMP
)
ON CONFLICT ("key") DO NOTHING;
