#!/usr/bin/env bash
# End-to-end attestation smoke test over the PUBLIC HTTP API (no DB access).
#
# Walks the full "bank creates a request, a device approves it" chain the mobile
# client performs, but with curl, so you can localize a failure to the backend
# independently of the Flutter app:
#
#   1. Portal identity token         (Keycloak: ohpp realm / ohpp-portal)
#   2. Register a device             (POST /api/devices)                 -> device token
#   3. Register the device key       (POST /api/devices/me/keys)
#   4. Bank token                    (Keycloak: ohpp-bank realm / ohpp-bank-app)
#   5. Create a transfer             (POST {bank}/api/transfers)         -> participationRequestId
#   6. Read device pending list      (GET /api/devices/me/pending)       -> assert the request shows
#   7. Submit an attestation         (POST /api/devices/me/attestations) -> assert 200
#   8. Poll the bank transfer status (GET {bank}/api/transfers/{id}/status) -> assert Completed
#
# Every step prints its HTTP status. On the first failure the script prints the
# response body and exits non-zero, so the failing hop is obvious.
#
# Config (all have localhost defaults for `make dev`; override for a device/tailnet):
#   RESOLVER_URL   (default http://localhost:5050)
#   KEYCLOAK_URL   (default http://localhost:8080)
#   BANK_URL       (default http://localhost:5010)
#   OHPP_USER      (default demo)         Keycloak username (portal + bank realms)
#   OHPP_PASS      (default demo)         Keycloak password
#   BANK_ACCOUNT   (default demo-account) OHPP-connected bank account to transfer from
#   BANK_PAYEE     (default payee-landlord)
#   AMOUNT         (default: unique per run, e.g. 123.45)
#
# Requires: curl, python3 (for JSON parsing). Read-only against the DB (none).
set -euo pipefail

RESOLVER_URL="${RESOLVER_URL:-http://localhost:5050}"
KEYCLOAK_URL="${KEYCLOAK_URL:-http://localhost:8080}"
BANK_URL="${BANK_URL:-http://localhost:5010}"
OHPP_USER="${OHPP_USER:-demo}"
OHPP_PASS="${OHPP_PASS:-demo}"
BANK_ACCOUNT="${BANK_ACCOUNT:-demo-account}"
BANK_PAYEE="${BANK_PAYEE:-payee-landlord}"
# Unique amount per run so the request summary is identifiable and repeat runs
# don't collide. e.g. 100.00 + (ms % 9000)/100 -> 100.00..189.99
AMOUNT="${AMOUNT:-$(python3 -c 'import time; print(f"{100 + (int(time.time()*1000) % 9000)/100:.2f}")')}"

log()  { echo "$@" >&2; }
fail() { log "FAIL: $*"; exit 1; }

# json_field <json> <python-expression-on-d>  (d = parsed dict)
json_field() {
  python3 -c 'import sys,json; d=json.load(sys.stdin); print(eval(sys.argv[1]))' "$2" <<<"$1"
}

need() { command -v "$1" >/dev/null 2>&1 || fail "missing required tool: $1"; }
need curl
need python3
need openssl

# Real ES256 (P-256) keypair for this run. The resolver verifies the device
# signature against the registered public key with genuine ECDSA/SHA-256, so a
# placeholder key/signature is rejected (this is what a faked signature looks
# like: HTTP 401 "Device signature verification failed"). We therefore generate
# a real keypair, register its public key PEM, and sign the canonical payload.
KEYDIR="$(mktemp -d)"
trap 'rm -rf "$KEYDIR"' EXIT
openssl ecparam -name prime256v1 -genkey -noout -out "$KEYDIR/priv.pem" 2>/dev/null \
  || fail "openssl could not generate a P-256 key"
openssl ec -in "$KEYDIR/priv.pem" -pubout -out "$KEYDIR/pub.pem" 2>/dev/null \
  || fail "openssl could not derive the public key"
PUBLIC_KEY_PEM="$(cat "$KEYDIR/pub.pem")"

# es256_sign_b64url <payload-string>
# Signs with SHA-256 + P-256 and prints the signature as base64url of the raw
# (r||s) IEEE-P1363 form the resolver's ECDsa.VerifyData expects.
es256_sign_b64url() {
  local payload="$1"
  printf '%s' "$payload" \
    | openssl dgst -sha256 -sign "$KEYDIR/priv.pem" 2>/dev/null \
    | python3 -c '
import sys, base64
der = sys.stdin.buffer.read()
# Decode the DER ECDSA signature (SEQUENCE { INTEGER r, INTEGER s }) into raw
# r||s (32 bytes each) which is what ECDsa.VerifyData with default format wants.
def read_len(b, i):
    n = b[i]; i += 1
    if n & 0x80:
        k = n & 0x7f; n = int.from_bytes(b[i:i+k], "big"); i += k
    return n, i
assert der[0] == 0x30
_, i = read_len(der, 1)
assert der[i] == 0x02; i += 1
rl, i = read_len(der, i); r = der[i:i+rl]; i += rl
assert der[i] == 0x02; i += 1
sl, i = read_len(der, i); s = der[i:i+sl]; i += sl
r = r.lstrip(b"\x00").rjust(32, b"\x00")
s = s.lstrip(b"\x00").rjust(32, b"\x00")
raw = r + s
print(base64.urlsafe_b64encode(raw).rstrip(b"=").decode())
'
}

log "== OHPP attestation smoke =="
log "resolver=$RESOLVER_URL keycloak=$KEYCLOAK_URL bank=$BANK_URL"
log "account=$BANK_ACCOUNT payee=$BANK_PAYEE amount=$AMOUNT user=$OHPP_USER"

# --- 1. Portal identity token ------------------------------------------------
log "[1/8] portal identity token ..."
ID_RESP="$(curl -s -X POST "$KEYCLOAK_URL/realms/ohpp/protocol/openid-connect/token" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode grant_type=password \
  --data-urlencode client_id=ohpp-portal \
  --data-urlencode "username=$OHPP_USER" \
  --data-urlencode "password=$OHPP_PASS")"
ID_TOKEN="$(json_field "$ID_RESP" 'd.get("access_token","")' || true)"
[ -n "$ID_TOKEN" ] || fail "no portal token (check Keycloak at $KEYCLOAK_URL and $OHPP_USER/$OHPP_PASS): $ID_RESP"
log "      ok"

# --- 2. Register a device ----------------------------------------------------
log "[2/8] register device ..."
DEV_BODY="$(curl -s -w '\n%{http_code}' -X POST "$RESOLVER_URL/api/devices" \
  -H "Authorization: Bearer $ID_TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"attest-smoke","deviceType":"ios-simulator"}')"
DEV_CODE="$(tail -n1 <<<"$DEV_BODY")"; DEV_JSON="$(sed '$d' <<<"$DEV_BODY")"
log "      HTTP $DEV_CODE"
[ "$DEV_CODE" = "201" ] || fail "device registration failed: $DEV_JSON"
DEVICE_TOKEN="$(json_field "$DEV_JSON" 'd["deviceToken"]')"
[ -n "$DEVICE_TOKEN" ] || fail "no deviceToken in response: $DEV_JSON"

# --- 3. Register the device key (the REAL public key PEM) --------------------
log "[3/8] register device key ..."
KEY_PAYLOAD="$(python3 -c 'import json,sys; print(json.dumps({"publicKey": sys.argv[1], "algorithm": "ES256"}))' "$PUBLIC_KEY_PEM")"
KEY_CODE="$(curl -s -o /dev/null -w '%{http_code}' -X POST "$RESOLVER_URL/api/devices/me/keys" \
  -H "Authorization: Bearer $DEVICE_TOKEN" -H 'Content-Type: application/json' \
  -d "$KEY_PAYLOAD")"
log "      HTTP $KEY_CODE"
[ "$KEY_CODE" = "200" ] || fail "device key registration failed (HTTP $KEY_CODE)"

# --- 4. Bank token -----------------------------------------------------------
log "[4/8] bank token ..."
BANK_RESP="$(curl -s -X POST "$KEYCLOAK_URL/realms/ohpp-bank/protocol/openid-connect/token" \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode grant_type=password \
  --data-urlencode client_id=ohpp-bank-app \
  --data-urlencode "username=$OHPP_USER" \
  --data-urlencode "password=$OHPP_PASS")"
BANK_TOKEN="$(json_field "$BANK_RESP" 'd.get("access_token","")' || true)"
[ -n "$BANK_TOKEN" ] || fail "no bank token: $BANK_RESP"
log "      ok"

# --- 5. Create a transfer (this is what generates the participation request) --
log "[5/8] create bank transfer ..."
XFER_BODY="$(curl -s -w '\n%{http_code}' -X POST "$BANK_URL/api/transfers" \
  -H "Authorization: Bearer $BANK_TOKEN" -H 'Content-Type: application/json' \
  -d "{\"fromAccountId\":\"$BANK_ACCOUNT\",\"toPayeeId\":\"$BANK_PAYEE\",\"amount\":$AMOUNT,\"reference\":\"attest-smoke\"}")"
XFER_CODE="$(tail -n1 <<<"$XFER_BODY")"; XFER_JSON="$(sed '$d' <<<"$XFER_BODY")"
log "      HTTP $XFER_CODE"
STATUS="$(json_field "$XFER_JSON" 'd.get("status","")' || true)"
REQUEST_ID="$(json_field "$XFER_JSON" 'd.get("participationRequestId") or ""' || true)"
if [ "$STATUS" != "PendingApproval" ] || [ -z "$REQUEST_ID" ]; then
  fail "transfer did not create a participation request (status=$STATUS). Is '$BANK_ACCOUNT' OHPP-connected? Body: $XFER_JSON"
fi
log "      requestId=$REQUEST_ID"

# --- 6. The device should see the request in its pending list ----------------
log "[6/8] device pending list contains the request ..."
PEND_BODY="$(curl -s -w '\n%{http_code}' "$RESOLVER_URL/api/devices/me/pending" \
  -H "Authorization: Bearer $DEVICE_TOKEN")"
PEND_CODE="$(tail -n1 <<<"$PEND_BODY")"; PEND_JSON="$(sed '$d' <<<"$PEND_BODY")"
log "      HTTP $PEND_CODE"
[ "$PEND_CODE" = "200" ] || fail "pending fetch failed: $PEND_JSON"
HAS_REQ="$(python3 -c 'import sys,json; d=json.load(sys.stdin); rid=sys.argv[1]; print(any(r.get("requestId")==rid for r in d))' "$REQUEST_ID" <<<"$PEND_JSON")"
[ "$HAS_REQ" = "True" ] || fail "request $REQUEST_ID not in device pending list: $PEND_JSON"
log "      present"

# --- 7. Submit the attestation (the step the app performs on approve) --------
# The canonical payload is the exact string the resolver verifies the signature
# against: sorted keys, no whitespace, non-null fields only. For a select
# "approve" that is simply {"selectedOption":"approve"}.
log "[7/8] submit attestation ..."
CANONICAL_PAYLOAD='{"selectedOption":"approve"}'
DEVICE_SIGNATURE="$(es256_sign_b64url "$CANONICAL_PAYLOAD")"
[ -n "$DEVICE_SIGNATURE" ] || fail "failed to sign the canonical payload"
ATT_PAYLOAD="$(python3 -c 'import json,sys; print(json.dumps({"requestId": sys.argv[1], "attestationPayload": sys.argv[2], "deviceSignature": sys.argv[3]}))' \
  "$REQUEST_ID" "$CANONICAL_PAYLOAD" "$DEVICE_SIGNATURE")"
ATT_BODY="$(curl -s -w '\n%{http_code}' -X POST "$RESOLVER_URL/api/devices/me/attestations" \
  -H "Authorization: Bearer $DEVICE_TOKEN" -H 'Content-Type: application/json' \
  -d "$ATT_PAYLOAD")"
ATT_CODE="$(tail -n1 <<<"$ATT_BODY")"; ATT_JSON="$(sed '$d' <<<"$ATT_BODY")"
log "      HTTP $ATT_CODE"
[ "$ATT_CODE" = "200" ] || fail "attestation submit failed (HTTP $ATT_CODE): $ATT_JSON"
log "      accepted"

# --- 8. The bank should now see the transfer Completed -----------------------
log "[8/8] poll bank transfer status -> Completed ..."
FINAL=""
for _ in $(seq 1 30); do
  ST_BODY="$(curl -s "$BANK_URL/api/transfers/$REQUEST_ID/status?accountId=$BANK_ACCOUNT" \
    -H "Authorization: Bearer $BANK_TOKEN")"
  FINAL="$(json_field "$ST_BODY" 'd.get("status","")' || true)"
  case "$FINAL" in
    Completed|Denied|Expired|Failed) break ;;
  esac
  sleep 1
done
log "      bank status=$FINAL"
[ "$FINAL" = "Completed" ] || fail "bank did not report Completed (got '$FINAL')"

log ""
log "PASS: full device-token attestation chain works end to end."
echo "PASS requestId=$REQUEST_ID amount=$AMOUNT status=$FINAL"
