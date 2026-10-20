# OHPP one-OS dev image.
#
# This is the single Linux environment that every contributor and CI enters, so
# Windows, macOS, and Linux all run the same shell and the same toolchain. Build
# it once; use it from .devcontainer/devcontainer.json (local) and from the CI
# workflows (hosted). Pins match the app Dockerfiles and the Flutter CI so local
# and CI render identically (this is what makes golden tests deterministic).
#
# Pins (keep in sync with the sources named):
#   dotnet  8.0.100   -> global.json
#   node    20        -> app Dockerfiles (node:20-alpine)
#   flutter 3.47.0    -> .github/workflows/flutter-ci.yml, client-app/pubspec.yaml
#   python3           -> scripts/gen-keycloak-redirects.py
#
# It does NOT run a Docker daemon. `make dev` drives the HOST daemon through the
# mounted docker socket (see devcontainer.json / the CI runner's own daemon), so
# containers this image starts are siblings on the host, and ports publish to the
# host's localhost. Only the Docker CLI + compose plugin live here.

FROM mcr.microsoft.com/dotnet/sdk:8.0

ARG FLUTTER_VERSION=3.47.0
ARG NODE_MAJOR=20

ENV DEBIAN_FRONTEND=noninteractive \
    FLUTTER_HOME=/opt/flutter \
    PATH=/opt/flutter/bin:/opt/flutter/bin/cache/dart-sdk/bin:/usr/local/bin:$PATH \
    # Flutter in a container runs as a non-root-friendly, CI-friendly setup.
    PUB_CACHE=/opt/flutter/.pub-cache

# --- OS packages: shell tooling + Docker CLI + Flutter/Playwright/psql deps -----
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        ca-certificates curl gnupg lsb-release \
        git make bash openssl jq unzip xz-utils \
        python3 python3-pip \
        postgresql-client \
        # Flutter / Dart build + headless test deps
        libglu1-mesa \
        # fonts: pin a fixed set so golden rasterisation is identical everywhere
        fonts-dejavu-core fonts-liberation fontconfig; \
    rm -rf /var/lib/apt/lists/*

# --- Docker CLI + compose plugin (client only; talks to the mounted socket) -----
RUN set -eux; \
    install -m 0755 -d /etc/apt/keyrings; \
    curl -fsSL https://download.docker.com/linux/debian/gpg \
        | gpg --dearmor -o /etc/apt/keyrings/docker.gpg; \
    chmod a+r /etc/apt/keyrings/docker.gpg; \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
        https://download.docker.com/linux/debian $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" \
        > /etc/apt/sources.list.d/docker.list; \
    apt-get update; \
    apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin; \
    rm -rf /var/lib/apt/lists/*

# --- Node 20 (NodeSource) -------------------------------------------------------
RUN set -eux; \
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -; \
    apt-get install -y --no-install-recommends nodejs; \
    rm -rf /var/lib/apt/lists/*

# --- Flutter (pinned, stable) ---------------------------------------------------
# Cloned shallow at the exact version tag. Precaching the Linux + web artifacts
# keeps `flutter test` / analyze / goldens fast and offline-stable.
RUN set -eux; \
    git clone --depth 1 --branch "${FLUTTER_VERSION}" https://github.com/flutter/flutter.git "${FLUTTER_HOME}"; \
    git config --global --add safe.directory "${FLUTTER_HOME}"; \
    flutter --version; \
    flutter config --no-analytics --enable-web; \
    flutter precache --universal --no-ios --no-android --no-macos --no-windows; \
    chmod -R a+rwx "${FLUTTER_HOME}"

# Make the font cache deterministic (goldens depend on this).
RUN fc-cache -f

WORKDIR /workspace

CMD ["bash"]
