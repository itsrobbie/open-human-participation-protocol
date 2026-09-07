-- Observability backends (U7.1) reuse the shared World Postgres rather than
-- running their own Postgres containers. GlitchTip (crash reporting) and Umami
-- (product analytics) each require a dedicated database (they run migrations
-- that assume DB ownership), so unlike the mock apps (which use schemas) these
-- get their own databases + roles.
--
-- Note: Umami is the analytics backend (opt-in `analytics` profile). It replaced
-- PostHog, whose current self-host requires Kafka + ~16GB RAM and cannot cleanly
-- reuse shared datastores - which contradicts this unit's lean one-command goal.
-- Umami is Postgres-only and still provides events, funnels, retention, and
-- journeys. See infrastructure-design/deployment-architecture.md for the rationale.
--
-- Dev-only credentials. Never used in production (see go-live readiness doc).

-- Roles (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'glitchtip_app') THEN
    CREATE ROLE glitchtip_app LOGIN PASSWORD 'ohpp_glitchtip_dev_password';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'umami_app') THEN
    CREATE ROLE umami_app LOGIN PASSWORD 'ohpp_umami_dev_password';
  END IF;
END $$;

-- Databases cannot be created inside a DO block / transaction. Use \gexec to
-- conditionally create them from a SELECT that emits the CREATE statements.
SELECT 'CREATE DATABASE glitchtip OWNER glitchtip_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'glitchtip')\gexec

SELECT 'CREATE DATABASE umami OWNER umami_app'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'umami')\gexec
