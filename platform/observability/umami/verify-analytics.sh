#!/usr/bin/env bash
# Reviewable end-to-end check that the Umami analytics backend actually ingests
# events (U7.1, Phase 7). Run via `make verify-analytics` after `make dev-analytics`.
#
# This is the analytics equivalent of `make ca-verify` / `make flutter-verify-pinning`:
# a repeatable, committed check that belongs to the flywheel - NOT ad-hoc curl.
#
# Steps:
#   1. Confirm Umami is reachable.
#   2. Emit an OHPP-taxonomy event to /api/send for the seeded website UUID.
#   3. Log in and query the website's event stats to confirm the event landed.
#
# Uses only curl + sh. Dev-only. Exits non-zero with a clear message on failure.
set -eu

BASE="${UMAMI_BASE_URL:-http://localhost:8001}"
USER="${UMAMI_ADMIN_USER:-admin}"
PASS="${UMAMI_ADMIN_PASSWORD:-umami}"
WEBSITE_ID="${OHPP_UMAMI_WEBSITE_ID:-0a119000-0b11-4000-8000-000000000002}"
EVENT_NAME="verify_analytics_probe"

echo "[verify-analytics] checking Umami at $BASE ..."
if ! curl -sf "$BASE/api/heartbeat" >/dev/null 2>&1; then
  echo "[verify-analytics] Umami not reachable at $BASE. Run 'make dev-analytics' first." >&2
  exit 1
fi

echo "[verify-analytics] emitting a '$EVENT_NAME' event to /api/send ..."
# Umami needs (a) a `url`, and (b) a browser-like User-Agent - it silently drops
# "bot-looking" UAs via the isbot heuristic - otherwise it accepts the POST (200)
# but never records the event. This is the same reason the app's sink presents a
# real mobile-browser UA.
BROWSER_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
SEND_STATUS="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE/api/send" \
  -H 'Content-Type: application/json' \
  -H "User-Agent: $BROWSER_UA" \
  -d "{\"type\":\"event\",\"payload\":{\"website\":\"$WEBSITE_ID\",\"name\":\"$EVENT_NAME\",\"hostname\":\"ohpp.local\",\"url\":\"/verify\",\"data\":{\"request_type\":\"select\",\"decision\":\"approve\"}}}")"
if [ "$SEND_STATUS" != "200" ] && [ "$SEND_STATUS" != "201" ]; then
  echo "[verify-analytics] /api/send returned HTTP $SEND_STATUS (expected 200/201)." >&2
  exit 1
fi

echo "[verify-analytics] logging in to query stats ..."
TOKEN="$(curl -sf -X POST "$BASE/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}" \
  | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')"
if [ -z "$TOKEN" ]; then
  echo "[verify-analytics] failed to obtain auth token." >&2
  exit 1
fi

# Query the event metrics for our website (lists custom event names + counts).
# Umami records events asynchronously, so poll briefly.
START_AT="$(( ( $(date +%s) - 3600 ) * 1000 ))"
END_AT="$(( ( $(date +%s) + 3600 ) * 1000 ))"
URL="$BASE/api/websites/$WEBSITE_ID/metrics?startAt=$START_AT&endAt=$END_AT&type=event"

i=0
while [ "$i" -lt 15 ]; do
  RESP="$(curl -sf -H "Authorization: Bearer $TOKEN" "$URL" 2>/dev/null || true)"
  # The event name appears in the metrics response once it is recorded.
  if printf '%s' "$RESP" | grep -q "$EVENT_NAME"; then
    echo "[verify-analytics] OK: '$EVENT_NAME' event landed in Umami for website $WEBSITE_ID."
    exit 0
  fi
  i=$((i + 1))
  sleep 2
done

echo "[verify-analytics] event did not appear in Umami stats within the timeout." >&2
echo "[verify-analytics] last stats response: $RESP" >&2
exit 1
