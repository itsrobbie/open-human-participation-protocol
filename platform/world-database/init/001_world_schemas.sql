-- World Database bootstrap for the demo ecosystem.
-- Each mock app owns one schema and one least-privilege database role.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bank_app') THEN
    CREATE ROLE bank_app LOGIN PASSWORD 'ohpp_bank_demo_password';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'insurance_claims_app') THEN
    CREATE ROLE insurance_claims_app LOGIN PASSWORD 'ohpp_insurance_demo_password';
  END IF;
END $$;

GRANT CONNECT ON DATABASE ohpp TO bank_app, insurance_claims_app;

CREATE SCHEMA IF NOT EXISTS bank AUTHORIZATION bank_app;
CREATE SCHEMA IF NOT EXISTS insurance_claims AUTHORIZATION insurance_claims_app;

GRANT USAGE, CREATE ON SCHEMA bank TO bank_app;
GRANT USAGE, CREATE ON SCHEMA insurance_claims TO insurance_claims_app;
