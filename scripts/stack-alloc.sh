#!/bin/sh
# STACK_ID allocator (U9 parallel environments).
#
# Resolves the STACK_ID for THIS worktree, print it on stdout. Resolution order:
#
#   1. Explicit STACK_ID in the environment (STACK_ID=N make ...) wins, always.
#      It is NOT pinned (an explicit override is deliberate and may be one-off).
#   2. A pinned .stack-id file in this worktree is reused every run.
#   3. Otherwise allocate the LOWEST FREE id and pin it to .stack-id.
#
# "Free" means: not currently claimed by a running compose project named ohpp-N,
# and not reserved by another worktree in the host-shared registry. This keeps
# the invariant that two worktrees never share a STACK_ID (and therefore never
# share a database ohpp_N), while needing zero manual id assignment.
#
# The ceiling (MAX_STACKS) mirrors scripts/stack-derive.sh. Allocation beyond it
# fails loudly rather than handing out a colliding id.
#
# No em dashes. POSIX sh.

set -eu

MAX_STACKS=16

# This worktree's pin file (next to the Makefile / repo root this runs from).
PIN_FILE=".stack-id"

# Host-shared registry of claimed ids across ALL worktrees on this machine. A
# worktree writes "<id> <abs-worktree-path>" here when it allocates, so a second
# worktree can see the claim even though it cannot read the first's .stack-id.
REGISTRY_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/ohpp"
REGISTRY="$REGISTRY_DIR/stack-registry"

# 1. Explicit override: use as-is, do not pin.
if [ -n "${STACK_ID:-}" ]; then
    echo "$STACK_ID"
    exit 0
fi

# 2. Pinned for this worktree: reuse.
if [ -f "$PIN_FILE" ]; then
    pinned=$(cat "$PIN_FILE")
    case "$pinned" in
        ''|*[!0-9]*) ;; # fall through to re-allocate if the pin is garbage
        *) echo "$pinned"; exit 0 ;;
    esac
fi

# 3. Allocate the lowest free id.
mkdir -p "$REGISTRY_DIR"
[ -f "$REGISTRY" ] || : > "$REGISTRY"

# Collect claimed ids: running compose projects named ohpp-<n>, plus registry
# entries whose worktree path still exists (stale entries are ignored).
claimed_file=$(mktemp)
trap 'rm -f "$claimed_file"' EXIT

# Running compose projects (best-effort; docker may be down, that is fine).
# OHPP_ALLOC_SKIP_DOCKER=1 skips this host-wide scan so tests (and offline runs)
# allocate purely from the isolated registry, independent of what is running.
if [ "${OHPP_ALLOC_SKIP_DOCKER:-0}" != "1" ] && command -v docker >/dev/null 2>&1; then
    docker compose ls --all --format json 2>/dev/null \
        | grep -o '"Name":"ohpp-[0-9]*"' \
        | grep -o 'ohpp-[0-9]*' \
        | sed 's/ohpp-//' >> "$claimed_file" || true
fi

# Registry entries with a still-existing worktree path.
while read -r rid rpath; do
    [ -n "${rid:-}" ] || continue
    if [ -n "${rpath:-}" ] && [ -d "$rpath" ]; then
        echo "$rid" >> "$claimed_file"
    fi
done < "$REGISTRY"

# Lowest id in [0, MAX_STACKS) not present in claimed_file.
id=0
while [ "$id" -lt "$MAX_STACKS" ]; do
    if ! grep -qx "$id" "$claimed_file"; then
        break
    fi
    id=$((id + 1))
done

if [ "$id" -ge "$MAX_STACKS" ]; then
    echo "stack-alloc: no free STACK_ID below ceiling ${MAX_STACKS} (all in use)" >&2
    exit 2
fi

# Pin for this worktree and record the claim in the host-shared registry.
echo "$id" > "$PIN_FILE"
abs_path=$(pwd)
# Drop any prior entry for this path, then append the fresh claim (atomic swap).
tmp_reg=$(mktemp)
grep -v " $abs_path$" "$REGISTRY" 2>/dev/null > "$tmp_reg" || true
echo "$id $abs_path" >> "$tmp_reg"
mv "$tmp_reg" "$REGISTRY"

echo "$id"
