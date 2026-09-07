#!/usr/bin/env bash
# Reviewable check that the OHPP World landing page is served and contains the
# expected front-door content (logo, grouped sections, key service links).
# Run via `make verify-landing` (after `make dev`). Dev-only.
set -eu

BASE="${LANDING_URL:-http://localhost:8888}"

echo "[verify-landing] checking $BASE ..."
if ! curl -sf "$BASE/healthz" >/dev/null 2>&1; then
  echo "[verify-landing] landing not reachable at $BASE. Run 'make dev' first." >&2
  exit 1
fi

HTML="$(curl -sf "$BASE/")"

# Assert the brand + each purpose group + a representative link per group are present.
must_contain() {
  if ! printf '%s' "$HTML" | grep -q "$1"; then
    echo "[verify-landing] MISSING expected content: $1" >&2
    exit 1
  fi
}

must_contain 'OHPP World'
must_contain '/assets/ohpp-logo.svg'   # the official logo
must_contain 'Start here'
must_contain 'Demo apps'
must_contain 'Platform'
must_contain 'Observability'
must_contain 'Dev tools'
# Representative links, one per group.
must_contain 'http://localhost:5010'          # Bank (demo apps)
must_contain 'http://localhost:3000'          # Portal (platform)
must_contain 'http://localhost:5050/swagger'  # Resolver API
must_contain 'http://localhost:3001'          # Grafana (observability)
must_contain 'make cli'                        # Dev tools

# Confirm the logo asset itself is served.
if ! curl -sf "$BASE/assets/ohpp-logo.svg" >/dev/null 2>&1; then
  echo "[verify-landing] logo asset not served at $BASE/assets/ohpp-logo.svg" >&2
  exit 1
fi

echo "[verify-landing] OK: landing page served with logo + all four groups + key links."
