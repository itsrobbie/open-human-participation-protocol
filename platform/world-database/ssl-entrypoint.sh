#!/usr/bin/env bash
# Postgres TLS entrypoint wrapper (U7.1, Phase 6 - datastore TLS).
#
# Postgres refuses to start if its private key is group/world readable: the key
# must be owned by the DB user (mode <= 0600) or by root (mode <= 0640). The
# shared ca_certs volume publishes leaf keys mode 0644 (so non-root services like
# Keycloak can read their own keys), which Postgres rejects.
#
# So we copy the postgres leaf cert + key out of the shared read-only volume into
# a private, correctly-permissioned location, then hand off to the stock
# docker-entrypoint with ssl enabled. Dev-only.
set -euo pipefail

SRC_CERT="/certs/postgres.chain.crt"   # leaf + intermediate (clients trust root)
SRC_KEY="/certs/postgres.key"
DST_DIR="/var/lib/postgresql/tls"
DST_CERT="$DST_DIR/server.crt"
DST_KEY="$DST_DIR/server.key"

if [ -f "$SRC_CERT" ] && [ -f "$SRC_KEY" ]; then
  mkdir -p "$DST_DIR"
  cp "$SRC_CERT" "$DST_CERT"
  cp "$SRC_KEY" "$DST_KEY"
  # postgres runs as the "postgres" user in this image; the key must be owned by
  # it and not readable by group/other.
  chown postgres:postgres "$DST_CERT" "$DST_KEY"
  chmod 0600 "$DST_KEY"
  chmod 0644 "$DST_CERT"

  # Enable TLS. The stock entrypoint appends these to the server invocation.
  set -- "$@" \
    -c ssl=on \
    -c ssl_cert_file="$DST_CERT" \
    -c ssl_key_file="$DST_KEY"
  echo "[postgres-tls] TLS enabled using $SRC_CERT"
else
  echo "[postgres-tls] leaf cert/key not found under /certs; starting WITHOUT TLS"
fi

exec docker-entrypoint.sh "$@"
