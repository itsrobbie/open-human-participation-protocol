#!/bin/sh
# OHPP dev CA + leaf certificate issuance (U7.1, Phase 6).
#
# Runs once in the smallstep/step-ca image (bundles the `step` CLI). Creates a
# local root + intermediate CA (persisted, idempotent) and per-service leaf
# certificates whose SANs cover the container service name and localhost, into
# the shared `ca_certs` volume mounted by every service.
#
# HTTPS-everywhere (Q5=B/Q5a=B). Dev-only: the CA password is a well-known dev
# value; real certs come from a real CA in production (go-live doc).
set -eu

CA_DIR="${CA_DIR:-/home/step/ca}"          # persisted CA key material
OUT_DIR="${OUT_DIR:-/certs}"               # shared ca_certs volume (leaf certs)
CA_PASSWORD="${STEPCA_PASSWORD:-ohpp-dev-ca-password}"
# Services that terminate TLS (server certs). SAN = "<name>,localhost,127.0.0.1".
SERVICES="${CERT_SERVICES:-resolver keycloak postgres redis otel-collector bank insurance-claims pizza marketplace portal glitchtip}"

ROOT_CRT="$CA_DIR/certs/root_ca.crt"
ROOT_KEY="$CA_DIR/secrets/root_ca_key"
INT_CRT="$CA_DIR/certs/intermediate_ca.crt"
INT_KEY="$CA_DIR/secrets/intermediate_ca_key"

echo "[ca] password file"
PW_FILE="$(mktemp)"
printf '%s' "$CA_PASSWORD" > "$PW_FILE"

mkdir -p "$CA_DIR/certs" "$CA_DIR/secrets" "$OUT_DIR"

# 1. Root + intermediate CA (idempotent - only create if absent so restarts
#    reuse the same trust root and previously issued certs stay valid).
if [ ! -f "$ROOT_CRT" ]; then
  echo "[ca] creating root CA"
  step certificate create "OHPP Dev Root CA" "$ROOT_CRT" "$ROOT_KEY" \
    --profile root-ca --no-password --insecure --force
fi

if [ ! -f "$INT_CRT" ]; then
  echo "[ca] creating intermediate CA"
  step certificate create "OHPP Dev Intermediate CA" "$INT_CRT" "$INT_KEY" \
    --profile intermediate-ca --ca "$ROOT_CRT" --ca-key "$ROOT_KEY" \
    --no-password --insecure --force
fi

# Publish the root to the shared volume so every service can trust it.
cp "$ROOT_CRT" "$OUT_DIR/root_ca.crt"

# 2. Per-service leaf certs (SAN = service name + localhost). Idempotent: skip
#    if a valid cert already exists for the service.
for svc in $SERVICES; do
  crt="$OUT_DIR/$svc.crt"
  key="$OUT_DIR/$svc.key"
  if [ -f "$crt" ] && step certificate verify "$crt" --roots "$ROOT_CRT" >/dev/null 2>&1; then
    echo "[ca] leaf cert for $svc already valid; skipping"
    # Keep perms correct even on the idempotent skip path (dev-only; see below).
    chmod 0644 "$crt" "$key" "$OUT_DIR/$svc.chain.crt" "$OUT_DIR/$svc.p12" 2>/dev/null || true
    continue
  fi
  echo "[ca] issuing leaf cert for $svc"
  step certificate create "$svc" "$crt" "$key" \
    --profile leaf \
    --ca "$INT_CRT" --ca-key "$INT_KEY" \
    --no-password --insecure --force \
    --not-after 8760h \
    --san "$svc" --san localhost --san 127.0.0.1

  # Also emit a full chain (leaf + intermediate) for servers that want it, and
  # a PKCS#12 bundle for .NET Kestrel (which loads a single .pfx conveniently).
  cat "$crt" "$INT_CRT" > "$OUT_DIR/$svc.chain.crt"
  step certificate p12 "$OUT_DIR/$svc.p12" "$crt" "$key" \
    --ca "$INT_CRT" --password-file "$PW_FILE" --force

  # This shared volume is consumed by services that run as non-root users
  # (e.g. Keycloak runs as uid 1000 and reads its key directly). step writes
  # keys mode 600 owned by root, which those users cannot read. This is a
  # dev-only CA with well-known material, so make the leaf artifacts readable
  # by every service container. NEVER do this in production.
  chmod 0644 "$crt" "$key" "$OUT_DIR/$svc.chain.crt" "$OUT_DIR/$svc.p12"
done

# Bundle root+intermediate for trust stores that want the whole CA chain.
cat "$INT_CRT" "$ROOT_CRT" > "$OUT_DIR/ca_bundle.crt"

# Export the .p12 password so consumers (Kestrel) know it.
printf '%s' "$CA_PASSWORD" > "$OUT_DIR/p12_password"

# Make the shared trust material readable by non-root service users (dev-only).
chmod 0644 "$OUT_DIR/root_ca.crt" "$OUT_DIR/ca_bundle.crt" "$OUT_DIR/p12_password" 2>/dev/null || true

rm -f "$PW_FILE"
echo "[ca] issuance complete. Leaf certs + root_ca.crt written to $OUT_DIR"
