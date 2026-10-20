#!/bin/sh
# STACK_ID derivation helper (U9 parallel environments).
#
# Given STACK_ID (default 0), emit every environmental value that must differ
# between parallel stacks, as `KEY=value` lines on stdout. Stack 0 is identity:
# with STACK_ID unset or 0 every value equals today's committed dev value, so a
# bare `make dev` is unchanged. Stack N adds N*STRIDE to each host port and
# suffixes each name with the id.
#
# Only HOST-facing values move. In-container ports stay fixed (a container always
# listens on its own port), so container-to-container service URLs never change.
#
# Usage:
#   STACK_ID=1 scripts/stack-derive.sh            # print derived env
#   eval "$(STACK_ID=1 scripts/stack-derive.sh)"  # load into the shell
#
# No em dashes. POSIX sh.

STACK_ID="${STACK_ID:-0}"

# Guard: STACK_ID must be a non-negative integer.
case "$STACK_ID" in
    ''|*[!0-9]*)
        echo "stack-derive: STACK_ID must be a non-negative integer, got '$STACK_ID'" >&2
        exit 2
        ;;
esac

# Max simultaneous environments the port scheme guarantees collision-free.
# Realistic RAM bound. The banded layout and the contract test both assume it.
MAX_STACKS=16

# Guard: STACK_ID must be below the supported ceiling (banding is only proven
# collision-free for ids 0..MAX_STACKS-1).
if [ "$STACK_ID" -ge "$MAX_STACKS" ]; then
    echo "stack-derive: STACK_ID must be < ${MAX_STACKS} (RAM-bound ceiling), got '$STACK_ID'" >&2
    exit 2
fi

# Banded host-port scheme (U9). The flat stride-100 scheme was NOT collision-free
# at 16 stacks (89 collisions, e.g. portal 3000 vs grafana 3001 once id>=1), so it
# is replaced by a banded layout proven collision-free for ids 0..15:
#   id 0   -> today's exact host port for every service (identity).
#   id>=1  -> each service owns a contiguous 15-wide band in 20000..20374;
#            host port = band_base + (id - 1).
# p <today_base> <band_base> emits the right one for the current STACK_ID.
p() {
    if [ "$STACK_ID" -eq 0 ]; then
        echo "$1"
    else
        echo $(( $2 + STACK_ID - 1 ))
    fi
}

cat <<EOF
# Derived for STACK_ID=${STACK_ID}. Stack 0 = identity (today's exact ports);
# ids 1..$((MAX_STACKS - 1)) use the banded range 20000..20374 (collision-free).
STACK_ID=${STACK_ID}

# Compose identity
OHPP_PROJECT=ohpp-${STACK_ID}
OHPP_NETWORK=ohpp-${STACK_ID}
OHPP_VOLUME_SUFFIX=-${STACK_ID}

# Database and realm
OHPP_DB_NAME=ohpp_${STACK_ID}
OHPP_REALM=ohpp-${STACK_ID}

# Observability identity (keeps two stacks' telemetry separable)
OHPP_OTEL_INSTANCE_ID=${STACK_ID}
OHPP_DEPLOYMENT_ENV=stack-${STACK_ID}

# Host-published ports. Arg 1 = today's base (id 0 identity); arg 2 = band base
# (id>=1). In-container ports are fixed, so only the host side moves.
OHPP_PORT_MAILPIT_SMTP=$(p 1025 20000)
OHPP_PORT_PORTAL=$(p 3000 20015)
OHPP_PORT_GRAFANA=$(p 3001 20030)
OHPP_PORT_LOKI=$(p 3110 20045)
OHPP_PORT_TEMPO=$(p 3200 20060)
OHPP_PORT_OTLP_GRPC=$(p 4317 20075)
OHPP_PORT_OTLP_HTTP=$(p 4318 20090)
OHPP_PORT_BANK=$(p 5010 20105)
OHPP_PORT_INSURANCE=$(p 5020 20120)
OHPP_PORT_PIZZA=$(p 5030 20135)
OHPP_PORT_MARKETPLACE=$(p 5040 20150)
OHPP_PORT_RESOLVER_HTTP=$(p 5050 20165)
OHPP_PORT_POSTGRES=$(p 5432 20180)
OHPP_PORT_RESOLVER_HTTPS=$(p 5443 20195)
OHPP_PORT_REDIS=$(p 6379 20210)
OHPP_PORT_GLITCHTIP=$(p 8000 20225)
OHPP_PORT_UMAMI=$(p 8001 20240)
OHPP_PORT_MAILPIT_UI=$(p 8025 20255)
OHPP_PORT_KEYCLOAK=$(p 8080 20270)
OHPP_PORT_OPENBAO=$(p 8200 20285)
OHPP_PORT_KEYCLOAK_HTTPS=$(p 8443 20300)
OHPP_PORT_LANDING=$(p 8888 20315)
OHPP_PORT_MINIO_CONSOLE=$(p 9001 20330)
OHPP_PORT_MINIO_API=$(p 9002 20345)
OHPP_PORT_PROMETHEUS=$(p 9090 20360)
EOF
