#!/usr/bin/env bash
# Preflight for on-device Flutter runs: WAIT until the iPhone is unlocked.
#
# A locked device silently breaks `flutter test`/`flutter drive`: iOS won't
# launch the app, so its Dart VM Service never appears and the tooling stalls
# for 60s+ with the opaque "Dart VM Service was not discovered" message.
#
# Rather than fail (people step away from their phones), this pauses the run:
# if the device is locked (or momentarily disconnected), it prints a clear
# message and polls until the device is unlocked and launch-ready, then returns
# so the run continues. It does NOT change any device settings.
#
# Usage: check-ios-device-unlocked.sh <device-id> [bundle-id]
#   device-id  the iOS device UDID (from `flutter devices` / devicectl)
#   bundle-id  app bundle id to probe with (default: dev.ohpp.ohppClient)
#
# Environment:
#   DEVICE_UNLOCK_TIMEOUT   max seconds to wait before giving up (default: 0 =
#                           wait forever). Set e.g. 600 in CI to avoid a hang.
#   DEVICE_UNLOCK_POLL      seconds between polls (default: 3)
#
# Exit codes:
#   0  device is present and unlocked (safe to proceed)
#   1  bad usage, or DEVICE_UNLOCK_TIMEOUT elapsed while still locked
set -euo pipefail

DEVICE_ID="${1:-}"
BUNDLE_ID="${2:-dev.ohpp.ohppClient}"
TIMEOUT="${DEVICE_UNLOCK_TIMEOUT:-0}"   # 0 = wait indefinitely
POLL="${DEVICE_UNLOCK_POLL:-3}"
# Automated driving (flutter drive) needs a WIRED connection: wireless
# debug-attach on iOS is slow/unreliable and the VM Service often never appears.
# Set REQUIRE_WIRED=0 to allow wireless (e.g. for a non-automated smoke run).
REQUIRE_WIRED="${REQUIRE_WIRED:-1}"

log() { echo "$@" >&2; }

if [ -z "$DEVICE_ID" ]; then
  log "Error: no device id passed to check-ios-device-unlocked.sh."
  exit 1
fi

# True when the device is connected over USB (i.e. NOT listed with a
# "(wireless)" tag by `flutter devices`). If we can't tell, don't block.
is_wired() {
  [ "$REQUIRE_WIRED" = "1" ] || return 0
  command -v flutter >/dev/null 2>&1 || return 0
  local line
  line="$(flutter devices --machine 2>/dev/null | grep -i "$DEVICE_ID" || true)"
  # --machine output includes "isWireless": true/false when available.
  if printf '%s' "$line" | grep -qi '"isWireless" *: *true'; then
    return 1
  fi
  return 0
}

if ! command -v xcrun >/dev/null 2>&1; then
  # No Xcode tooling: can't check. Don't block the run on non-macOS/CI.
  log "Note: xcrun not found; skipping device-unlocked preflight."
  exit 0
fi

# Returns:
#   ready       device present and unlocked (launch succeeded, OR an app-level
#               error such as the app not being installed yet — both mean the
#               device itself is up and unlocked)
#   locked      device is locked
#   absent      device not found / not connected / any other launch failure
#
# Classification is conservative: we only report "ready" on an affirmative
# success or a clearly app-level failure. Anything else waits, so an unexpected
# error never causes the runner to falsely proceed into a silent hang.
probe_state() {
  local out
  out="$(xcrun devicectl device process launch --device "$DEVICE_ID" "$BUNDLE_ID" 2>&1 || true)"

  if printf '%s' "$out" | grep -qiE "reason: Locked|could not be, unlocked|error 7 \(0x07\)"; then
    echo "locked"
    return
  fi
  # Present + unlocked if either the app launched, or it failed only because it
  # isn't installed yet (first run installs it via flutter).
  if printf '%s' "$out" | grep -qiE "Launched application|not installed|no such application|application.*not found on"; then
    # Present + unlocked — but for automated driving it must also be WIRED.
    if is_wired; then
      echo "ready"
    else
      echo "wireless"
    fi
    return
  fi
  # Everything else (device not found, connection error, unknown ERROR) => wait.
  echo "absent"
}

state="$(probe_state)"
if [ "$state" = "ready" ]; then
  log "Device $DEVICE_ID is unlocked, wired, and launch-ready."
  exit 0
fi

# Describe a not-ready state for the user.
announce() {
  log ""
  log "  ┌───────────────────────────────────────────────────────────┐"
  case "$1" in
    locked)
      log "  │  iPhone is LOCKED. The run is PAUSED, not failed.          │"
      log "  │  Unlock the phone and it will continue automatically.      │" ;;
    wireless)
      log "  │  iPhone is WIRELESS. The run is PAUSED, not failed.        │"
      log "  │  Plug in the USB cable — wireless debug-attach is          │"
      log "  │  unreliable for automated tests. It resumes once wired.    │" ;;
    *)
      log "  │  iPhone not detected. The run is PAUSED, not failed.       │"
      log "  │  Reconnect/unlock the phone and it will continue.          │" ;;
  esac
  log "  │  Tip: Settings > Display & Brightness > Auto-Lock > Never  │"
  log "  │  keeps it awake for the duration of a test run.            │"
  log "  └───────────────────────────────────────────────────────────┘"
  log ""
}

# Not ready: announce once, then wait/poll until it becomes ready.
announce "$state"

start="$(date +%s)"
last_state="$state"
while :; do
  sleep "$POLL"
  state="$(probe_state)"
  if [ "$state" = "ready" ]; then
    log "Device ready (unlocked + wired) — resuming."
    exit 0
  fi
  # If the state changed, reflect it once.
  if [ "$state" != "$last_state" ]; then
    announce "$state"
    last_state="$state"
  fi
  if [ "$TIMEOUT" -gt 0 ]; then
    now="$(date +%s)"
    if [ $(( now - start )) -ge "$TIMEOUT" ]; then
      log "Error: device still not ready after ${TIMEOUT}s (DEVICE_UNLOCK_TIMEOUT). Giving up."
      exit 1
    fi
  fi
done
