ALTER TABLE "users"
  ADD COLUMN "salary_rate_percent" SMALLINT NOT NULL DEFAULT 75,
  ADD CONSTRAINT "users_salary_rate_percent_check"
    CHECK ("salary_rate_percent" BETWEEN 0 AND 100);
