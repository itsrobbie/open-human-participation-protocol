#!/usr/bin/env bash
# Runs once when the devcontainer is created. Reconciles the mounted Docker
# socket so the CLI can reach the host daemon, then prints the pinned toolchain
# so a mismatch is obvious on day one.
set -euo pipefail

echo "==> Reconciling Docker socket access"
if [ -S /var/run/docker.sock ]; then
  # The socket's group gid on the host rarely matches a group inside the image.
  # Create a matching group and make sure we can talk to the daemon. We run as
  # root in this container, so access is already there; this keeps a non-root
  # setup working too if the image is later de-privileged.
  SOCK_GID="$(stat -c '%g' /var/run/docker.sock 2>/dev/null || echo '')"
  if [ -n "$SOCK_GID" ] && ! getent group "$SOCK_GID" >/dev/null 2>&1; then
    groupadd -g "$SOCK_GID" hostdocker || true
  fi
  if docker version >/dev/null 2>&1; then
    echo "    docker CLI reaches the host daemon: OK"
  else
    echo "    WARNING: docker CLI cannot reach the host daemon via /var/run/docker.sock"
    echo "    On the host, ensure Docker Desktop is running and the socket is shared."
  fi
else
  echo "    WARNING: /var/run/docker.sock is not mounted. 'make dev' will not work."
  echo "    Check the 'mounts' entry in .devcontainer/devcontainer.json."
fi

echo "==> Pinned toolchain"
printf '    %-10s %s\n' "dotnet"  "$(dotnet --version 2>/dev/null || echo MISSING)"
printf '    %-10s %s\n' "node"    "$(node --version 2>/dev/null || echo MISSING)"
printf '    %-10s %s\n' "flutter" "$(flutter --version 2>/dev/null | head -1 || echo MISSING)"
printf '    %-10s %s\n' "python3" "$(python3 --version 2>/dev/null || echo MISSING)"
printf '    %-10s %s\n' "make"    "$(make --version 2>/dev/null | head -1 || echo MISSING)"

echo ""
echo "==> Ready. Run:  make check   then   make dev   and open http://localhost:8888"
