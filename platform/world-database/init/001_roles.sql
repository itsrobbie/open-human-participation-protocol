-- Global cluster roles for the demo ecosystem (U9: run ONCE with the backing tier).
--
-- Postgres LOGIN roles are CLUSTER-GLOBAL, not per-database, so the four app
-- roles are created once and shared by every tenant database (ohpp_0, ohpp_1,
-- ...). Per-tenant schema creation and the per-database CONNECT/schema grants
-- live in 003_tenant_schemas.sql, which runs once per tenant database.
--
-- Idempotent: each role is created only if absent, so re-running is a no-op.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'bank_app') THEN
    CREATE ROLE bank_app LOGIN PASSWORD 'ohpp_bank_demo_password';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'insurance_claims_app') THEN
    CREATE ROLE insurance_claims_app LOGIN PASSWORD 'ohpp_insurance_demo_password';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'pizza_app') THEN
    CREATE ROLE pizza_app LOGIN PASSWORD 'ohpp_pizza_demo_password';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'marketplace_app') THEN
    CREATE ROLE marketplace_app LOGIN PASSWORD 'ohpp_marketplace_demo_password';
  END IF;
END $$;
