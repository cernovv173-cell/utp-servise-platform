ALTER TABLE "technician_monthly_salary_reports"
ADD COLUMN "adjustment_version" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "file_adjustment_version" INTEGER NOT NULL DEFAULT 0;

CREATE TYPE "TechnicianPayrollAdjustmentType" AS ENUM (
  'TAX',
  'ADVANCE',
  'DEDUCTION'
);

CREATE TABLE "technician_payroll_adjustments" (
  "id" UUID NOT NULL,
  "report_id" UUID NOT NULL,
  "technician_id" UUID,
  "technician_name" VARCHAR(120) NOT NULL,
  "type" "TechnicianPayrollAdjustmentType" NOT NULL,
  "amount_rub" INTEGER NOT NULL,
  "description" VARCHAR(250) NOT NULL,
  "occurred_at" DATE NOT NULL,
  "created_by_id" UUID,
  "created_by_name" VARCHAR(120) NOT NULL,
  "voided_at" TIMESTAMPTZ(3),
  "voided_by_id" UUID,
  "voided_by_name" VARCHAR(120),
  "void_reason" VARCHAR(250),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "technician_payroll_adjustments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "technician_payroll_adjustments_positive_amount_check"
    CHECK ("amount_rub" > 0),
  CONSTRAINT "technician_payroll_adjustments_void_fields_check"
    CHECK (
      ("voided_at" IS NULL AND "voided_by_name" IS NULL AND "void_reason" IS NULL)
      OR
      ("voided_at" IS NOT NULL AND "voided_by_name" IS NOT NULL AND "void_reason" IS NOT NULL)
    ),
  CONSTRAINT "technician_payroll_adjustments_report_id_fkey"
    FOREIGN KEY ("report_id") REFERENCES "technician_monthly_salary_reports"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "technician_payroll_adjustments_technician_id_fkey"
    FOREIGN KEY ("technician_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "technician_payroll_adjustments_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "technician_payroll_adjustments_voided_by_id_fkey"
    FOREIGN KEY ("voided_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "technician_payroll_adjustments_report_id_technician_id_type_idx"
ON "technician_payroll_adjustments"("report_id", "technician_id", "type");

CREATE INDEX "technician_payroll_adjustments_report_id_occurred_at_idx"
ON "technician_payroll_adjustments"("report_id", "occurred_at");
