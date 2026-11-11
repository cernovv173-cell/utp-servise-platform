ALTER TABLE "repair_orders"
  ADD COLUMN "visit_scenario_version" SMALLINT NOT NULL DEFAULT 0,
  ADD COLUMN "visit_is_within_city" BOOLEAN,
  ADD COLUMN "visit_customer_distance_km" INTEGER,
  ADD COLUMN "visit_verified_distance_km" INTEGER,
  ADD COLUMN "visit_distance_verified_at" TIMESTAMPTZ(3),
  ADD COLUMN "visit_distance_verified_by_id" UUID,
  ADD COLUMN "diagnosis_fee_rub" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "visit_fee_rub" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "visit_pickup_agreed_at" TIMESTAMPTZ(3),
  ADD COLUMN "technician_repair_completed_at" TIMESTAMPTZ(3),
  ADD COLUMN "onsite_repair_completed_at" TIMESTAMPTZ(3);

ALTER TABLE "technician_salary_entries"
  ADD COLUMN "visit_fees_rub" INTEGER NOT NULL DEFAULT 0;
