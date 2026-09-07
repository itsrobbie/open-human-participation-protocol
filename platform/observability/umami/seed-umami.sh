#!/bin/sh
# Umami dev seeding (U7.1, Phase 7 - analytics profile).
#
# Umami auto-migrates its schema on boot, so this one-shot only needs to ensure a
# fixed dev website exists with a DETERMINISTIC UUID (the website UUID is the
# analytics tracking key). Pinning it means the app's ANALYTICS_KEY is a known,
# stable value with no manual clicking, and it survives a clean rebuild.
#
# IMPORTANT: Umami v2.14's `POST /api/websites` IGNORES the documented optional
# `id` field and always generates a random UUID, so the API cannot give us a
# deterministic key. We therefore seed the website row directly in Postgres with
# our fixed UUID (the same declarative approach GlitchTip uses to pin its DSN).
# Idempotent via ON CONFLICT. Dev-only.
set -eu

PGHOST="${PGHOST:-postgres}"
PGPORT="${PGPORT:-5432}"
PGDATABASE="${PGDATABASE:-umami}"
PGUSER="${PGUSER:-ohpp}"
export PGPASSWORD="${PGPASSWORD:-ohpp_dev_password}"

WEBSITE_ID="${OHPP_UMAMI_WEBSITE_ID:-0a119000-0b11-4000-8000-000000000002}"
WEBSITE_NAME="${OHPP_UMAMI_WEBSITE_NAME:-OHPP}"
WEBSITE_DOMAIN="${OHPP_UMAMI_WEBSITE_DOMAIN:-ohpp.local}"
ADMIN_USERNAME="${UMAMI_ADMIN_USER:-admin}"

echo "[umami-seed] waiting for Umami to create its schema (website table) ..."
i=0
until psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -tAc \
  "SELECT to_regclass('public.website') IS NOT NULL AND to_regclass('public.\"user\"') IS NOT NULL;" 2>/dev/null | grep -q '^t$'; do
  i=$((i + 1))
  if [ "$i" -gt 60 ]; then
    echo "[umami-seed] Umami schema did not appear in time" >&2
    exit 1
  fi
  sleep 2
done

echo "[umami-seed] ensuring website $WEBSITE_ID (owned by '$ADMIN_USERNAME') ..."
# Insert the website with our fixed UUID, owned by the admin user (looked up by
# username so we don't depend on a hardcoded user id). Idempotent: if the row
# already exists, refresh its name/domain so a null domain can never linger
# (a null domain makes Umami's stats endpoints 500).
psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -v ON_ERROR_STOP=1 <<SQL
INSERT INTO website (website_id, name, domain, user_id, created_by, created_at)
SELECT '$WEBSITE_ID', '$WEBSITE_NAME', '$WEBSITE_DOMAIN', u.user_id, u.user_id, CURRENT_TIMESTAMP
FROM "user" u
WHERE u.username = '$ADMIN_USERNAME'
ON CONFLICT (website_id) DO UPDATE
  SET name = EXCLUDED.name,
      domain = EXCLUDED.domain,
      updated_at = CURRENT_TIMESTAMP;
SQL

# Confirm it is really there with a non-null domain.
DOMAIN_OK="$(psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" -tAc \
  "SELECT domain FROM website WHERE website_id = '$WEBSITE_ID';")"
if [ -z "$DOMAIN_OK" ]; then
  echo "[umami-seed] failed to seed website (no row / null domain)" >&2
  exit 1
fi

echo "[umami-seed] DONE. Analytics website id (tracking key) = $WEBSITE_ID (domain=$DOMAIN_OK)"
