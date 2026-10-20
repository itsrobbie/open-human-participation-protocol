#!/usr/bin/env bash
# Reviewable end-to-end check that the Flutter app's telemetry actually reaches
# the dashboards (U7.1). Run via `make verify-flutter-telemetry` after `make dev`.
#
# Two halves, one answer:
#   1. Drive the app's REAL OtlpTelemetryService (test_e2e/telemetry_live_test.dart)
#      to export a uniquely-named span to the live OTel Collector; assert 2xx.
#   2. Query Tempo to confirm the span is searchable as service ohpp.client.
#
# Headless (no simulator). Dev-only.
set -eu

OTEL_ENDPOINT="${OTEL_ENDPOINT:-http://localhost:4318}"
TEMPO_URL="${TEMPO_URL:-http://localhost:3200}"
# Unique per run so we never match a stale span.
SPAN_NAME="verify_flutter_$(date +%s)"

echo "[verify-flutter-telemetry] collector=$OTEL_ENDPOINT tempo=$TEMPO_URL span=$SPAN_NAME"

# Sanity: collector + Tempo reachable.
curl -sf "$TEMPO_URL/ready" >/dev/null 2>&1 || {
  echo "[verify-flutter-telemetry] Tempo not reachable at $TEMPO_URL. Run 'make dev' first." >&2
  exit 1
}

echo "[verify-flutter-telemetry] exporting a span via the app's real OtlpTelemetryService ..."
( cd platform/client-app && flutter test test_e2e/telemetry_live_test.dart \
    --dart-define=OTEL_ENDPOINT="$OTEL_ENDPOINT" \
    --dart-define=SPAN_NAME="$SPAN_NAME" )

echo "[verify-flutter-telemetry] querying Tempo for the ohpp.client span ..."
# Tempo tag search needs a recent time window (sparse services age out otherwise).
i=0
while [ "$i" -lt 20 ]; do
  START=$(( $(date +%s) - 3600 ))
  END=$(( $(date +%s) + 60 ))
  RESP="$(curl -sf "$TEMPO_URL/api/search?tags=$(printf 'service.name=ohpp.client' | sed 's/=/%3D/')&limit=20&start=$START&end=$END" 2>/dev/null || true)"
  if printf '%s' "$RESP" | grep -q "$SPAN_NAME"; then
    echo "[verify-flutter-telemetry] OK: span '$SPAN_NAME' is queryable in Tempo as ohpp.client."
    exit 0
  fi
  # The trace may be found by service even if the name field isn't in the summary;
  # accept a fresh ohpp.client trace whose root name matches too.
  if printf '%s' "$RESP" | grep -q '"rootServiceName":"ohpp.client"'; then
    if printf '%s' "$RESP" | grep -q "$SPAN_NAME"; then
      echo "[verify-flutter-telemetry] OK: ohpp.client span '$SPAN_NAME' in Tempo."
      exit 0
    fi
  fi
  i=$((i + 1))
  sleep 2
done

echo "[verify-flutter-telemetry] span did not appear in Tempo within the timeout." >&2
echo "[verify-flutter-telemetry] last Tempo response: $RESP" >&2
exit 1
