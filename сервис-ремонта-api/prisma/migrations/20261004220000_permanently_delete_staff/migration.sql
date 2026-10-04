ALTER TABLE "technician_salary_entries"
  ALTER COLUMN "technician_id" DROP NOT NULL;

ALTER TABLE "technician_salary_entries"
  DROP CONSTRAINT "technician_salary_entries_technician_id_fkey",
  ADD CONSTRAINT "technician_salary_entries_technician_id_fkey"
    FOREIGN KEY ("technician_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "repair_receipts"
  ALTER COLUMN "issued_by_id" DROP NOT NULL;

ALTER TABLE "repair_receipts"
  DROP CONSTRAINT "repair_receipts_issued_by_id_fkey",
  ADD CONSTRAINT "repair_receipts_issued_by_id_fkey"
    FOREIGN KEY ("issued_by_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
