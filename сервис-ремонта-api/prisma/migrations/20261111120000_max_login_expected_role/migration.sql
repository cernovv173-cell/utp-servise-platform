ALTER TABLE "max_login_requests"
ADD COLUMN "expected_role" "UserRole" NOT NULL DEFAULT 'CUSTOMER';
