-- Per-tenant application schemas and grants (U9: run ONCE PER TENANT database).
--
-- This runs inside a single tenant database (ohpp_0, ohpp_1, ...), selected by
-- the psql connection (-d ohpp_${STACK_ID}), so it uses NO hardcoded database
-- name. The app LOGIN roles it references are cluster-global and are created
-- once by 001_roles.sql with the backing tier.
--
-- Idempotent: CREATE SCHEMA IF NOT EXISTS + GRANT are safe to re-run.

-- CONNECT on the CURRENT database (whichever tenant db we are attached to).
DO $$
BEGIN
  EXECUTE format(
    'GRANT CONNECT ON DATABASE %I TO bank_app, insurance_claims_app, pizza_app, marketplace_app',
    current_database()
  );
END $$;

CREATE SCHEMA IF NOT EXISTS bank AUTHORIZATION bank_app;
CREATE SCHEMA IF NOT EXISTS insurance_claims AUTHORIZATION insurance_claims_app;
CREATE SCHEMA IF NOT EXISTS pizza AUTHORIZATION pizza_app;
CREATE SCHEMA IF NOT EXISTS marketplace AUTHORIZATION marketplace_app;

GRANT USAGE, CREATE ON SCHEMA bank TO bank_app;
GRANT USAGE, CREATE ON SCHEMA insurance_claims TO insurance_claims_app;
GRANT USAGE, CREATE ON SCHEMA pizza TO pizza_app;
GRANT USAGE, CREATE ON SCHEMA marketplace TO marketplace_app;
