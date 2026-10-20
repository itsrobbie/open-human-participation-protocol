#!/usr/bin/env bash
# Resolve an iOS simulator to a UDID for the Flutter E2E run, booting it if needed.
#
# Selection order:
#   1. If FLUTTER_E2E_DEVICE is set, find the available simulator with that exact
#      name and boot it if it isn't already. (Set this in .env.local, git-ignored.)
#   2. Otherwise, use any already-booted simulator.
#
# Prints ONLY the resolved UDID on stdout (so `SIM_ID=$(...)` captures just that).
# All human-facing messages go to stderr. Exits non-zero with a clear message
# when no suitable simulator can be found.
#
# Running on a SIMULATOR is deliberate: simulator apps are not code-signed against
# a device provisioning profile, so they never trigger the iOS "Untrusted
# Developer" prompt that a physical iPhone shows after each debug reinstall.
set -euo pipefail

DEVICE_NAME="${FLUTTER_E2E_DEVICE:-}"

log() { echo "$@" >&2; }

# Query simctl once as JSON and let Python do the matching (robust vs text parsing).
resolve() {
  local wanted="$1"
  xcrun simctl list devices available -j 2>/dev/null | DEVICE_NAME="$wanted" python3 -c '
import sys, json, os
wanted = os.environ.get("DEVICE_NAME", "")
data = json.load(sys.stdin)
named = None            # (udid, state) for the requested name
any_booted = None       # udid of any booted sim (fallback)
for runtime, devices in data.get("devices", {}).items():
    for dev in devices:
        if not dev.get("isAvailable"):
            continue
        if dev.get("state") == "Booted" and any_booted is None:
            any_booted = dev["udid"]
        if wanted and dev.get("name") == wanted:
            named = (dev["udid"], dev.get("state", "Shutdown"))
if wanted:
    if named:
        print(f"NAMED\t{named[0]}\t{named[1]}")
    else:
        print("NONE")
else:
    print(f"BOOTED\t{any_booted}" if any_booted else "NONE")
'
}

if [ -n "$DEVICE_NAME" ]; then
  result="$(resolve "$DEVICE_NAME")"
  if [ "$result" = "NONE" ]; then
    log "Error: no available iOS simulator named \"$DEVICE_NAME\"."
    log "       List names with: xcrun simctl list devices available"
    log "       Set FLUTTER_E2E_DEVICE in .env.local to a name from that list."
    exit 1
  fi
  udid="$(printf '%s' "$result" | cut -f2)"
  state="$(printf '%s' "$result" | cut -f3)"
  if [ "$state" != "Booted" ]; then
    log "Booting simulator \"$DEVICE_NAME\" ($udid)..."
    xcrun simctl boot "$udid" >/dev/null 2>&1 || true
    # Give it a moment to reach a usable state.
    xcrun simctl bootstatus "$udid" -b >/dev/null 2>&1 || true
  else
    log "Using already-booted simulator \"$DEVICE_NAME\" ($udid)."
  fi
  printf '%s' "$udid"
  exit 0
fi

# No name requested: fall back to any booted simulator.
result="$(resolve "")"
if [ "$result" = "NONE" ]; then
  log "Error: no booted iOS simulator found."
  log "       Either set FLUTTER_E2E_DEVICE in .env.local to a simulator name,"
  log "       or boot one: xcrun simctl boot \"<name>\" (or open -a Simulator)."
  exit 1
fi
udid="$(printf '%s' "$result" | cut -f2)"
log "Using booted simulator $udid (set FLUTTER_E2E_DEVICE to pin a specific one)."
printf '%s' "$udid"
