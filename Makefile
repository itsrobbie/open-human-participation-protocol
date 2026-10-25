.PHONY: help help-all check dev dev-analytics verify-analytics urls dev-build dev-down dev-backing-up dev-backing-down dev-apps-up dev-apps-down ca-issue ca-verify dev-logs dev-logs-resolver dev-logs-bank dev-logs-insurance dev-logs-pizza dev-logs-marketplace backing-db-init tenant-db-init tenant-up tenant-down tenant-list cli cli-reset test test-node-e2e test-ui test-file test-contracts validate test-unit test-unit-sdk test-unit-resolver test-unit-bank test-unit-insurance test-unit-cli test-unit-portal test-unit-node-sdk test-unit-pizza test-unit-marketplace test-integration build build-resolver build-bank build-insurance build-cli build-portal build-node-sdk build-pizza build-marketplace clean clean-cache clean-all test-backing-up test-backing-down test-apps-up test-apps-down test-stack-up test-stack-rebuild test-stack-down test-stack-logs test-stack-logs-pizza test-stack-logs-marketplace test-stack-ps flutter-test flutter-test-unit flutter-test-golden flutter-golden-update flutter-test-e2e flutter-verify-pinning verify-observability verify-landing verify-flutter-telemetry flutter-run-device flutter-lint flutter-build-ios flutter-build-android ci-image ci-flutter ci-flutter-goldens coverage coverage-portal coverage-node-sdk coverage-resolver-unit coverage-flutter

# Developer-local overrides (git-ignored). Put machine-specific values here, e.g.
# the iOS simulator to run the Flutter E2E on:
#   FLUTTER_E2E_DEVICE=iPhone 17 Pro w/ Watch
# The leading dash means "include if it exists, ignore silently if not".
-include .env.local

# U9 parallel environments: STACK_ID selects which isolated stack this invocation
# targets. Resolution (scripts/stack-alloc.sh): an explicit STACK_ID=N wins; else
# this worktree's pinned .stack-id is reused; else the lowest free id is allocated
# and pinned. Each worktree thus gets a distinct id (own DB ohpp_N, own ports),
# so parallel worktrees share services but never share data. The derivation helper
# then emits every per-stack value into .stack.env (git-ignored), included so both
# Make and docker compose interpolation see the derived OHPP_PROJECT / OHPP_PORT_*.
STACK_ID := $(shell STACK_ID=$(STACK_ID) scripts/stack-alloc.sh)
$(shell STACK_ID=$(STACK_ID) scripts/stack-derive.sh > .stack.env 2>/dev/null)
-include .stack.env
export

# Default target: the friendly, curated getting-started menu.
.DEFAULT_GOAL := help

help: ## Show the getting-started guide and common commands
	@printf '\n'
	@printf '  \033[1;38;5;99m▊▊\033[0m  \033[1mOpen Human Participation Protocol\033[0m — dev environment\n'
	@printf '      The layer that proves a human really participated.\n'
	@printf '\n'
	@printf '  \033[1mGET STARTED (first time)\033[0m\n'
	@printf '    \033[36m1.\033[0m make check        \033[2m# check you have Docker + the tools installed\033[0m\n'
	@printf '    \033[36m2.\033[0m make dev          \033[2m# build + start everything (first run ~3-5 min)\033[0m\n'
	@printf '    \033[36m3.\033[0m open the front door it prints:  \033[1;36mhttp://localhost:8888\033[0m\n'
	@printf '\n'
	@printf '  \033[1mEVERYDAY\033[0m\n'
	@printf '    make dev              \033[2mStart the full dev stack (prints the front-door URL)\033[0m\n'
	@printf '    make dev-analytics    \033[2mStart dev + the opt-in analytics profile (Umami)\033[0m\n'
	@printf '    make dev-down         \033[2mStop everything\033[0m\n'
	@printf '    make urls             \033[2mPrint every service URL\033[0m\n'
	@printf '    make cli              \033[2mRun the terminal attester simulator\033[0m\n'
	@printf '\n'
	@printf '  \033[1mTEST\033[0m\n'
	@printf '    make validate         \033[2mFull layered gate: contracts, unit, integration, web E2E\033[0m\n'
	@printf '    make test             \033[2mBrowser E2E suite (isolated stack, auto-teardown)\033[0m\n'
	@printf '    make test-unit        \033[2mAll unit tests (fast)\033[0m\n'
	@printf '    make test-integration \033[2mResolver integration tests (Docker)\033[0m\n'
	@printf '    make flutter-test     \033[2mFlutter app tests\033[0m\n'
	@printf '\n'
	@printf '  \033[1mFLUTTER ON DEVICE\033[0m\n'
	@printf '    make flutter-test-e2e    \033[2mE2E on the iOS simulator (dev + first-round validation)\033[0m\n'
	@printf '    make flutter-e2e-device  \033[2mE2E on a WIRED iPhone (validation sign-off)\033[0m\n'
	@printf '    make flutter-play-device \033[2mRelease build on a WIRELESS iPhone for UX/UI play (tailnet/LAN)\033[0m\n'
	@printf '\n'
	@printf '  \033[1mVERIFY (live checks against a running dev stack)\033[0m\n'
	@printf '    make verify-landing        \033[2mFront door serves + links resolve\033[0m\n'
	@printf '    make verify-observability  \033[2mEvery service data lands in the dashboards\033[0m\n'
	@printf '    make verify-analytics      \033[2mAn event reaches Umami\033[0m\n'
	@printf '    make ca-verify             \033[2mThe local HTTPS certs are valid + trusted\033[0m\n'
	@printf '\n'
	@printf '  \033[1mMORE\033[0m\n'
	@printf '    make help-all         \033[2mList every available target\033[0m\n'
	@printf '    make clean            \033[2mStop the dev stack and delete its data\033[0m\n'
	@printf '\n'

help-all: ## List every available target (full reference)
	@printf '\nAll targets:\n\n'
	@grep -hE '^[a-zA-Z][a-zA-Z0-9_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort -u \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-24s\033[0m %s\n", $$1, $$2}'
	@printf '\n'

# ─── Prerequisite check ──────────────────────────────────────────────────────

check: ## Check the tools you need are installed (run this first)
	@printf '\n  Checking prerequisites for OHPP...\n\n'
	@ok=1; \
	check_cmd() { \
	  name="$$1"; cmd="$$2"; hint="$$3"; \
	  if command -v "$$cmd" >/dev/null 2>&1; then \
	    printf '  \033[32m✓\033[0m %-16s %s\n' "$$name" "$$($$cmd --version 2>/dev/null | head -1)"; \
	  else \
	    printf '  \033[31m✗\033[0m %-16s missing — %s\n' "$$name" "$$hint"; ok=0; \
	  fi; \
	}; \
	check_cmd "Docker"  docker  "install Docker Desktop: https://www.docker.com/products/docker-desktop/"; \
	if docker compose version >/dev/null 2>&1; then \
	  printf '  \033[32m✓\033[0m %-16s %s\n' "Docker Compose" "$$(docker compose version 2>/dev/null | head -1)"; \
	else \
	  printf '  \033[31m✗\033[0m %-16s missing — comes with Docker Desktop (Compose v2)\n' "Docker Compose"; ok=0; \
	fi; \
	check_cmd "Make"    make    "macOS/Linux: preinstalled; Windows: use the devcontainer (see README) or WSL2/Git Bash"; \
	check_cmd "Git"     git     "install Git: https://git-scm.com/downloads"; \
	check_cmd "Python 3" python3 "needed by 'make dev' (Keycloak redirect generator); install from https://www.python.org/ — or just use the devcontainer"; \
	printf '\n'; \
	if docker info >/dev/null 2>&1; then \
	  printf '  \033[32m✓\033[0m %-16s running\n' "Docker daemon"; \
	else \
	  printf '  \033[31m✗\033[0m %-16s not running — open Docker Desktop and wait for "Engine running"\n' "Docker daemon"; ok=0; \
	fi; \
	printf '\n'; \
	if [ "$$ok" = "1" ]; then \
	  printf '  \033[32mAll set.\033[0m Next:  \033[1mmake dev\033[0m  then open  \033[1;36mhttp://localhost:8888\033[0m\n\n'; \
	else \
	  printf '  \033[33mSome prerequisites are missing.\033[0m Install the items marked ✗ above, then re-run  \033[1mmake check\033[0m\n\n'; \
	  exit 1; \
	fi

# ─── Dev Stack (two tiers) ───────────────────────────────────────────────────
#
# The dev stack is split into two profiles so app iteration never restarts the
# slow third-party services:
#   - "backing" = postgres, keycloak, redis, otel-collector, loki, tempo,
#                 prometheus, grafana (third-party images; rarely rebuilt).
#   - "apps"    = resolver, portal, bank, insurance, pizza, marketplace (our code).
#
# Typical loop: `make dev-backing-up` once, then `make dev-apps-up` / `dev-apps-down`
# repeatedly. `make dev` is a convenience that brings up both tiers.
#
# Note: every compose invocation activates BOTH profiles so that apps' depends_on
# links to backing services resolve; lifecycle is controlled by naming services
# (backing services are reused if already running, never recreated by dev-apps-up).

COMPOSE = docker compose --progress quiet -p $(OHPP_PROJECT) -f docker-compose.apps.yml --profile apps
COMPOSE_BACKING = docker compose --progress quiet -p ohpp-backing -f docker-compose.backing.yml --profile backing
BACKING_SERVICES = cert-init postgres keycloak redis otel-collector loki tempo prometheus grafana glitchtip-init glitchtip glitchtip-worker
APP_SERVICES = resolver portal bank insurance-claims pizza marketplace landing

backing-db-init: dev-backing-up ## Initialize shared/global DB objects ONCE (cluster roles + observability DBs). Not per tenant.
	$(COMPOSE_BACKING) up -d --wait postgres
	docker compose -p ohpp-backing -f docker-compose.backing.yml exec -T postgres psql -U ohpp -d ohpp -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/001_roles.sql
	docker compose -p ohpp-backing -f docker-compose.backing.yml exec -T postgres psql -U ohpp -d ohpp -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/002_observability_databases.sql

tenant-db-init: backing-db-init ## Create + migrate THIS tenant's database (ohpp_$(STACK_ID)); applies per-tenant schemas
	@docker compose -p ohpp-backing -f docker-compose.backing.yml exec -T postgres \
		psql -U ohpp -d ohpp -tAc "SELECT 1 FROM pg_database WHERE datname='$(OHPP_DB_NAME)'" | grep -q 1 \
		|| docker compose -p ohpp-backing -f docker-compose.backing.yml exec -T postgres createdb -U ohpp -O ohpp $(OHPP_DB_NAME)
	docker compose -p ohpp-backing -f docker-compose.backing.yml exec -T postgres psql -U ohpp -d $(OHPP_DB_NAME) -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/003_tenant_schemas.sql

ensure-docker: ## Ensure the Docker daemon is running (starts Docker Desktop on macOS and waits)
	@if docker info > /dev/null 2>&1; then exit 0; fi; \
	echo "Docker daemon not running."; \
	if [ "$$(uname)" = "Darwin" ] && [ -d "/Applications/Docker.app" ]; then \
		echo "Starting Docker Desktop..."; \
		open -a Docker; \
		printf "Waiting for Docker to be ready"; \
		for i in $$(seq 1 60); do \
			if docker info > /dev/null 2>&1; then echo " ready."; exit 0; fi; \
			printf "."; sleep 2; \
		done; \
		echo ""; echo "Error: Docker did not become ready within ~2 minutes. Start Docker Desktop manually and retry."; \
		exit 1; \
	else \
		echo "Error: start the Docker daemon (Docker Desktop / colima / etc.) and retry."; \
		exit 1; \
	fi

dev-backing-up: ensure-docker ## Start ONLY the backing tier (third-party services)
	@python3 scripts/gen-keycloak-redirects.py >/dev/null
	$(COMPOSE_BACKING) up -d
	@echo "  Backing tier up (postgres, keycloak, redis, otel-collector, loki, tempo, prometheus, grafana)."

ca-issue: ## Issue/refresh the local dev CA + per-service leaf certs (idempotent)
	$(COMPOSE_BACKING) up cert-init

ca-verify: ## Verify the local CA issued leaf certs with correct SANs and a trusted root
	$(COMPOSE_BACKING) run --rm --no-deps --entrypoint sh cert-init -c '\
		set -e; \
		echo "== root trust: verify each leaf (with intermediate) against root_ca.crt =="; \
		for svc in resolver keycloak postgres redis otel-collector; do \
			step certificate verify /certs/$$svc.chain.crt --roots /certs/root_ca.crt && echo "  $$svc: root-trusted OK"; \
		done; \
		echo "== SANs: resolver cert must cover service name + localhost =="; \
		step certificate inspect /certs/resolver.crt --short | grep -q "resolver" && echo "  resolver SAN OK"; \
		step certificate inspect /certs/resolver.crt --short | grep -q "localhost" && echo "  localhost SAN OK"'

dev-backing-down: ## Stop ONLY the backing tier
	$(COMPOSE_BACKING) stop $(BACKING_SERVICES)

dev-apps-up: ensure-docker ## Build + start ONLY our code (auto-starts backing if it isn't running)
	@docker compose ps --status running --services 2>/dev/null | grep -q '^postgres$$' || $(MAKE) dev-backing-up
	$(MAKE) tenant-db-init
	$(COMPOSE) up --build -d $(APP_SERVICES)

# The one front door. `make dev`/`dev-analytics` print ONLY this; the landing
# page (and `make urls`) map everything else.
define OHPP_FRONT_DOOR
	@echo ""
	@echo "  ┌───────────────────────────────────────────────────────────┐"
	@echo "  │  OHPP World is ready (tenant stack $(STACK_ID)).                        │"
	@echo "  └───────────────────────────────────────────────────────────┘"
	@echo "  Open the front door:  http://localhost:$(OHPP_PORT_LANDING)"
	@echo "  It links to every app, dashboard and tool. (See 'make urls'.)"
	@echo ""
endef

dev-apps-down: ## Stop ONLY our code (leaves the backing tier running)
	$(COMPOSE) stop $(APP_SERVICES)

dev: dev-apps-up ## Start the full dev stack (backing + apps)
	$(OHPP_FRONT_DOOR)

# ─── Self-serving tenant lifecycle (U9) ──────────────────────────────────────
#
# Add / drop / list isolated environments with one command. Each tenant is the
# worktree's STACK_ID (auto-allocated, or explicit STACK_ID=N). All tenants share
# ONE backing tier (ohpp-backing) but never share data: each owns database
# ohpp_$(STACK_ID), its own ports (banded), project ohpp-$(STACK_ID) and network.

tenant-up: ensure-docker ## Add/refresh THIS tenant (STACK_ID=N): ensure backing, create its db, start its app tier. Idempotent.
	@echo "Bringing up tenant stack $(STACK_ID) (project $(OHPP_PROJECT), db $(OHPP_DB_NAME))..."
	$(MAKE) test-backing-up
	$(MAKE) tenant-db-init
	$(COMPOSE) up --build -d $(APP_SERVICES)
	@echo "  Tenant $(STACK_ID) up. Front door: http://localhost:$(OHPP_PORT_LANDING)   (see 'make urls STACK_ID=$(STACK_ID)')"

tenant-down: ## Remove ONLY this tenant (STACK_ID=N): stop + remove its app tier, drop its database. Backing + other tenants untouched.
	@echo "Tearing down tenant stack $(STACK_ID) (project $(OHPP_PROJECT), db $(OHPP_DB_NAME))..."
	-$(COMPOSE) --profile tools down --volumes --remove-orphans
	@echo "Dropping database $(OHPP_DB_NAME) on the shared backing Postgres..."
	-docker compose -p ohpp-backing -f docker-compose.backing.yml exec -T postgres \
		dropdb -U ohpp --if-exists $(OHPP_DB_NAME)
	@echo "  Tenant $(STACK_ID) removed. Its .stack-id pin (if any) is left for re-use; delete .stack-id to free the id."

tenant-list: ## List running tenant app tiers (ohpp-N projects) with their STACK_ID
	@echo "Running tenant app tiers (shared backing = ohpp-backing):"
	@docker compose ls --all --format json 2>/dev/null \
		| grep -o '"Name":"ohpp-[0-9]*"' | grep -o 'ohpp-[0-9]*' | sort -u \
		| sed 's/^/  /' || echo "  (none running)"

urls: ## Print every service URL (the landing page at :8888 shows these too)
	@echo "  Front door:       http://localhost:$(OHPP_PORT_LANDING)  (start here)"
	@echo "  --- Demo apps (tenant stack $(STACK_ID)) ---"
	@echo "  Bank:             http://localhost:$(OHPP_PORT_BANK)"
	@echo "  Insurance Claims: http://localhost:$(OHPP_PORT_INSURANCE)"
	@echo "  Pizza:            http://localhost:$(OHPP_PORT_PIZZA)"
	@echo "  Marketplace:      http://localhost:$(OHPP_PORT_MARKETPLACE)"
	@echo "  --- Platform (tenant stack $(STACK_ID)) ---"
	@echo "  Portal:           http://localhost:$(OHPP_PORT_PORTAL)"
	@echo "  Resolver API:     http://localhost:$(OHPP_PORT_RESOLVER_HTTP)/swagger"
	@echo "  --- Observability (shared backing) ---"
	@echo "  Grafana:          http://localhost:3001  (logs/traces/metrics - single pane)"
	@echo "  Prometheus:       http://localhost:9090"
	@echo "  GlitchTip:        http://localhost:8000  (crash/error reporting)"
	@echo "  Umami:            http://localhost:8001  (analytics; opt-in: make dev-analytics)"
	@echo "  --- Dev tools ---"
	@echo "  CLI attester:     make cli"

ANALYTICS_COMPOSE = $(COMPOSE_BACKING) --profile analytics

dev-analytics: tenant-db-init ## Start the dev stack WITH the analytics profile (Umami + placeholder stubs), seeded
	# tenant-db-init (above) chains backing-db-init, which has already ensured the
	# `umami` db/role exist. Bring up
	# Umami and wait for it to be healthy, then run the seed one-shot to completion
	# so the fixed analytics website UUID exists - no manual steps, survives clean.
	$(ANALYTICS_COMPOSE) up --build -d --wait umami minio mailpit openbao
	$(COMPOSE) up --build -d $(APP_SERVICES)
	$(ANALYTICS_COMPOSE) up umami-init
	$(OHPP_FRONT_DOOR)
	@echo "  (Analytics profile enabled — Umami, Mailpit, MinIO, OpenBao are on the front door / 'make urls'.)"
	@echo ""

verify-analytics: ## Reviewable live check: emit an event to Umami and confirm it lands (run 'make dev-analytics' first)
	./platform/observability/umami/verify-analytics.sh
	@echo "✓ Analytics verified: an event was ingested by Umami for the seeded website."

verify-landing: ## Reviewable check: the landing front door is served with the logo + all groups + key links (run 'make dev' first)
	./platform/landing/verify-landing.sh
	@echo "✓ Landing verified: the front door at http://localhost:8888 maps the whole demo."

verify-flutter-telemetry: ## Reviewable live check: the Flutter app's real telemetry exports a span that lands in Tempo as ohpp.client (run 'make dev' first)
	./platform/client-app/verify-flutter-telemetry.sh
	@echo "✓ Flutter telemetry verified: an ohpp.client span from the app's real exporter landed in Tempo."

verify-observability: ## Whole-world observability sweep against the dev stack (run 'make dev-analytics' first)
	@echo "Checking the dev stack + analytics profile are up..."
	@curl -sf http://localhost:5050/health > /dev/null 2>&1 || (echo "Error: dev stack not running. Start it with 'make dev' first." && exit 1)
	@curl -sf http://localhost:8001/api/heartbeat > /dev/null 2>&1 || (echo "Error: Umami not running. Start it with 'make dev-analytics' first." && exit 1)
	npm exec --prefix tests/e2e -- playwright test --config tests/e2e/playwright.observability.config.ts
	@echo "✓ Whole-world observability verified: every service's data lands in the dashboards."

dev-build: ## Rebuild and restart ONLY our code (force-recreate apps)
	$(MAKE) tenant-db-init
	$(COMPOSE) up --build -d --force-recreate $(APP_SERVICES)
	@echo ""
	@echo "  Bank:            http://localhost:$(OHPP_PORT_BANK)"
	@echo "  Insurance Claims: http://localhost:$(OHPP_PORT_INSURANCE)"
	@echo "  Pizza:           http://localhost:$(OHPP_PORT_PIZZA)"
	@echo "  Marketplace:     http://localhost:$(OHPP_PORT_MARKETPLACE)"
	@echo "  Portal:          http://localhost:$(OHPP_PORT_PORTAL)"
	@echo "  Resolver:        http://localhost:$(OHPP_PORT_RESOLVER_HTTP)/swagger"
	@echo "  CLI attester:    make cli (development simulator, not the mobile Client App)"
	@echo ""

dev-down: ## Stop the entire dev stack (both tiers)
	$(COMPOSE) --profile tools down
	$(COMPOSE_BACKING) --profile analytics down

dev-logs: ## Tail logs from all services
	$(COMPOSE) logs -f --tail=50

dev-logs-resolver: ## Tail resolver logs
	$(COMPOSE) logs -f --tail=50 resolver

dev-logs-bank: ## Tail bank logs
	$(COMPOSE) logs -f --tail=50 bank

dev-logs-insurance: ## Tail Insurance Claims logs
	$(COMPOSE) logs -f --tail=50 insurance-claims

dev-logs-pizza: ## Tail Pizza app logs
	$(COMPOSE) logs -f --tail=50 pizza

dev-logs-marketplace: ## Tail Marketplace app logs
	$(COMPOSE) logs -f --tail=50 marketplace

cli: ## Run the interactive development attester simulator
	$(COMPOSE) run --rm cli

cli-reset: ## Forget the CLI simulator token and signing keys
	docker compose --profile backing --profile apps --profile tools run --rm --entrypoint sh cli -c 'rm -f /root/.ohpp/cli-config.json'

# ─── E2E Tests ───────────────────────────────────────────────────────────────

test: ## Run all E2E tests (isolated stack, auto-teardown)
	npm exec --prefix tests/e2e -- playwright test --config tests/e2e/playwright.config.ts

test-ui: ## Run E2E tests with Playwright UI
	npm exec --prefix tests/e2e -- playwright test --config tests/e2e/playwright.config.ts --ui

test-file: ## Run a specific test file (usage: make test-file FILE=15-full-flow)
	npm exec --prefix tests/e2e -- playwright test --config tests/e2e/playwright.config.ts tests/e2e/tests/$(FILE)*.spec.ts

test-headed: ## Run E2E tests with browser visible
	npm exec --prefix tests/e2e -- playwright test --config tests/e2e/playwright.config.ts --headed

test-node-e2e: ## Run Node app E2E tests only (Pizza + Marketplace + interop)
	npm exec --prefix tests/e2e -- playwright test --config tests/e2e/playwright.config.ts tests/e2e/tests/30-*.spec.ts tests/e2e/tests/31-*.spec.ts tests/e2e/tests/32-*.spec.ts tests/e2e/tests/33-*.spec.ts tests/e2e/tests/34-*.spec.ts

attest-smoke: ## HTTP-only smoke of the device attestation chain (bank transfer -> device approves -> Completed). Run 'make dev' first. Localizes backend failures independent of the Flutter app.
	@curl -sf http://localhost:5050/health > /dev/null 2>&1 || (echo "Error: Dev stack not running. Start it with 'make dev' first." && exit 1)
	./scripts/attest-smoke.sh

# ─── Unit Tests ──────────────────────────────────────────────────────────────

validate: ## Run the layered validation suite in pyramid order (contracts, unit, integration, web whole-case). Docker required for integration + e2e.
	@echo ""
	@echo "═══ validate: layer 1/4 — contracts (lint: Makefile + Compose surfaces, P1 testid scheme) ═══"
	$(MAKE) test-contracts
	@echo ""
	@echo "═══ validate: layer 2/4 — unit + component (SDKs, resolver, apps, portal) ═══"
	$(MAKE) test-unit
	@echo ""
	@echo "═══ validate: layer 3/4 — integration (one service + real deps; requires Docker) ═══"
	$(MAKE) test-integration
	@echo ""
	@echo "═══ validate: layer 4/4 — web whole-case E2E (isolated stack, cross-system ceremonies) ═══"
	$(MAKE) test
	@echo ""
	@echo "═══ validate: all four layers passed. Flutter app-attester layers run separately via 'make flutter-test' (see coverage matrix). ═══"

test-contracts: ## Validate Makefile and Compose developer surfaces
	node --test --test-reporter=dot tests/contracts/*.test.mjs

test-unit: ## Run all unit tests (SDKs + resolver + CLI + bank + insurance + node apps)
	$(MAKE) test-contracts
	dotnet test sdks/dotnet/tests/OHPP.Protocol.Tests.Unit/OHPP.Protocol.Tests.Unit.csproj
	dotnet test sdks/dotnet/tests/OHPP.Sdk.Tests.Unit/OHPP.Sdk.Tests.Unit.csproj
	dotnet test sdks/dotnet/tests/OHPP.Sdk.Server.Tests.Unit/OHPP.Sdk.Server.Tests.Unit.csproj
	dotnet test platform/resolver/Resolver.sln --filter "Category!=RequiresDocker"
	dotnet test demo/mock-apps/dotnet/bank/Bank.sln
	dotnet test demo/mock-apps/dotnet/insurance-claims/tests/InsuranceClaims.Tests.Unit/InsuranceClaims.Tests.Unit.csproj
	$(MAKE) test-unit-cli
	$(MAKE) test-unit-portal
	$(MAKE) test-unit-node-sdk
	$(MAKE) test-unit-pizza
	$(MAKE) test-unit-marketplace

test-unit-sdk: ## Run protocol, requester SDK, and server SDK unit tests
	dotnet test sdks/dotnet/tests/OHPP.Protocol.Tests.Unit/OHPP.Protocol.Tests.Unit.csproj
	dotnet test sdks/dotnet/tests/OHPP.Sdk.Tests.Unit/OHPP.Sdk.Tests.Unit.csproj
	dotnet test sdks/dotnet/tests/OHPP.Sdk.Server.Tests.Unit/OHPP.Sdk.Server.Tests.Unit.csproj

test-unit-resolver: ## Run resolver unit tests only
	dotnet test platform/resolver/Resolver.sln --filter "Category!=RequiresDocker"

test-unit-bank: ## Run bank unit tests only
	dotnet test demo/mock-apps/dotnet/bank/Bank.sln

test-unit-insurance: ## Run insurance claims unit tests only
	dotnet test demo/mock-apps/dotnet/insurance-claims/tests/InsuranceClaims.Tests.Unit/InsuranceClaims.Tests.Unit.csproj

test-unit-cli: ## Run CLI attester simulator unit tests
	dotnet test demo/client-cli/tests/OHPP.Cli.Tests.Unit/OHPP.Cli.Tests.Unit.csproj

test-unit-portal: ## Run Portal unit and component tests
	npm --prefix platform/portal run test:unit

test-unit-node-sdk: ## Run Node OHPP SDK unit + integration tests
	npm --prefix sdks/node run test

test-unit-pizza: ## Run Pizza app unit + integration tests
	npm --prefix demo/mock-apps/node/pizza run test

test-unit-marketplace: ## Run Marketplace app unit + integration tests
	npm --prefix demo/mock-apps/node/marketplace run test

test-integration: ## Run resolver integration tests (requires Docker postgres)
	dotnet build platform/resolver/tests/OHPP.Tests.Integration.Api/OHPP.Tests.Integration.Api.csproj --configuration Release --maxcpucount:1
	dotnet test platform/resolver/tests/OHPP.Tests.Integration.Api/OHPP.Tests.Integration.Api.csproj --configuration Release --no-build --filter "Category=RequiresDocker" --logger "console;verbosity=detailed"

# ─── Coverage (production-lifecycle plan, Phase 0.2 / 5.1) ───────────────────
# Each emits a machine-readable coverage report for one production surface.
# Floors are enforced in Phase 5.1; these targets just produce the numbers.

coverage-portal: ## Portal coverage (vitest v8 -> platform/portal/coverage)
	npm --prefix platform/portal run test:coverage

coverage-node-sdk: ## Node SDK coverage (vitest v8)
	npm --prefix sdks/node run test:coverage

coverage-resolver-unit: ## Resolver unit coverage (coverlet cobertura, no Docker)
	for p in platform/resolver/tests/OHPP.Tests.Unit.*/; do \
		dotnet test "$$p" --collect:"XPlat Code Coverage" --results-directory coverage/resolver || exit 1; \
	done

coverage-flutter: ## Flutter coverage (lcov -> platform/client-app/coverage/lcov.info)
	cd platform/client-app && flutter test --coverage

coverage: coverage-portal coverage-node-sdk coverage-resolver-unit coverage-flutter ## All production-surface coverage reports

# ─── Flutter Client App ──────────────────────────────────────────────────────

flutter-test: ## Run all Flutter tests (unit + widget + golden + integration)
	cd platform/client-app && flutter test

flutter-test-unit: ## Run Flutter unit and widget tests (excludes E2E)
	cd platform/client-app && flutter test test/

flutter-test-file: ## Run a specific Flutter test file (usage: make flutter-test-file FILE=test/shared/models/foo_test.dart)
	@[ -n "$(FILE)" ] || (echo "Error: pass FILE=<path under platform/client-app>, e.g. FILE=test/shared/models/participation_request_expiry_test.dart" && exit 1)
	cd platform/client-app && flutter test $(FILE)

flutter-test-golden: ## Verify Flutter golden baselines are up to date
	cd platform/client-app && flutter test --update-goldens
	@if [ -n "$$(git status --porcelain 'platform/client-app/test/**/goldens/*.png')" ]; then \
		echo "Golden baselines have changed. Review and commit."; \
		git diff --stat 'platform/client-app/test/**/goldens/*.png'; \
	else \
		echo "All golden baselines up to date."; \
	fi

flutter-golden-update: ## Update golden baselines (after intentional visual changes)
	cd platform/client-app && flutter test --update-goldens

# ---- Local = CI: run the Flutter CI gate in the SAME image GitHub builds ------
# These mirror .github/workflows/flutter-ci.yml exactly. CI builds the image
# from .devcontainer/Dockerfile and runs the same docker run commands, so a
# green `make ci-flutter` locally means a green CI run. No registry involved.
CI_IMAGE ?= ohpp-dev-image:ci
# Build/run the image on the host's native arch. Goldens no longer need an exact
# arch match: the tolerant comparator in test/flutter_test_config.dart absorbs
# sub-pixel arm64-vs-amd64 rasterisation drift, so one baseline set passes on
# both a local Mac (arm64) and the amd64 CI runner.
CI_RUN = docker run --rm -v "$(PWD)":/workspace -w /workspace/platform/client-app $(CI_IMAGE)

ci-image: ## Build the one-OS CI image from .devcontainer/Dockerfile (what CI builds)
	docker build -f .devcontainer/Dockerfile -t $(CI_IMAGE) .

ci-flutter: ci-image ## Run the full Flutter CI gate locally in the CI image (lint + test incl. goldens)
	@echo "== Lint =="
	$(CI_RUN) bash -c "flutter pub get && flutter analyze --no-fatal-infos"
	@echo "== Test (incl. golden tests via the tolerant comparator) =="
	$(CI_RUN) bash -c "flutter pub get && flutter test"
	@echo "PASS: CI gate green (lint + test incl. goldens)."

ci-flutter-goldens: ci-image ## Regenerate golden baselines in the CI image (only when intended visual changes) and stage for review
	$(CI_RUN) bash -c "flutter pub get && flutter test --update-goldens"
	@echo "Goldens regenerated in the CI image. Review 'git diff' and commit."

# Observability --dart-define values for the Flutter app (U7.1). Empty by
# default => the app runs with no-op seams. Override on the command line to
# enable, e.g.:
#   make flutter-run-device OTEL_ENDPOINT=http://192.168.68.60:4318 \
#        CRASH_DSN=http://<key>@localhost:8000/1 \
#        ANALYTICS_HOST=http://localhost:8001 ANALYTICS_KEY=<umami-website-uuid>
# The E2E target defaults OTEL_ENDPOINT to the local Collector, CRASH_DSN to the
# seeded GlitchTip dev project, and ANALYTICS_* to the seeded Umami dev website
# so app spans + crashes + analytics are verifiable. (ANALYTICS still requires the
# analytics profile to be up: `make dev-analytics`.)
OTEL_ENDPOINT ?=
CRASH_DSN ?=
ANALYTICS_HOST ?=
ANALYTICS_KEY ?=
# Seeded GlitchTip dev DSN (deterministic; dashless hex of the seeded UUID key).
SEEDED_CRASH_DSN = http://0bbc1e00c11e40008000000000000001@localhost:8000/1
# Seeded Umami dev analytics (deterministic website UUID = the tracking key).
SEEDED_ANALYTICS_HOST = http://localhost:8001
SEEDED_ANALYTICS_KEY = 0a119000-0b11-4000-8000-000000000002
FLUTTER_OBS_DEFINES = \
	$(if $(OTEL_ENDPOINT),--dart-define=OTEL_ENDPOINT=$(OTEL_ENDPOINT),) \
	$(if $(CRASH_DSN),--dart-define=CRASH_DSN=$(CRASH_DSN),) \
	$(if $(ANALYTICS_HOST),--dart-define=ANALYTICS_HOST=$(ANALYTICS_HOST),) \
	$(if $(ANALYTICS_KEY),--dart-define=ANALYTICS_KEY=$(ANALYTICS_KEY),)

# Which iOS simulator the Flutter E2E runs on. Set FLUTTER_E2E_DEVICE to a
# simulator NAME (e.g. "iPhone 17 Pro w/ Watch") in .env.local (git-ignored) or
# on the command line. Running on a booted SIMULATOR avoids the "Untrusted
# Developer" prompt entirely (simulator apps aren't code-signed against a device
# provisioning profile, unlike a physical iPhone). If unset, any booted
# simulator is used.
FLUTTER_E2E_DEVICE ?=

# Physical-device config for the on-device targets below. Machine-specific, so
# set these in .env.local (git-ignored), not here:
#   FLUTTER_DEVICE_ID   the device id from `flutter devices` (or `xcrun devicectl
#                       list devices`), e.g. 00008120-001E4DE81EFBC01E
#   FLUTTER_DEVICE_HOST the host the ON-DEVICE app uses to reach this machine's
#                       backend. A phone can't use localhost, so use a LAN IP or
#                       a tailnet hostname, e.g. my-macbook.my-tailnet.ts.net
#                       (the transport underneath is an implementation detail).
FLUTTER_DEVICE_ID ?=
FLUTTER_DEVICE_HOST ?=

# Backend --dart-defines the app reads to reach a non-localhost host. Empty
# unless FLUTTER_DEVICE_HOST is set (then they point every backend URL at it
# over the plain-HTTP dev ports; the dev TLS certs only have SANs for localhost
# + the service name, so HTTP avoids a cert-pinning failure on a real device).
FLUTTER_DEVICE_DEFINES = \
	$(if $(FLUTTER_DEVICE_HOST),--dart-define=RESOLVER_URL=http://$(FLUTTER_DEVICE_HOST):5050,) \
	$(if $(FLUTTER_DEVICE_HOST),--dart-define=KEYCLOAK_TOKEN_URL=http://$(FLUTTER_DEVICE_HOST):8080/realms/ohpp/protocol/openid-connect/token,)
# Same host, but the E2E_* names the integration_test suite reads.
FLUTTER_DEVICE_E2E_DEFINES = \
	$(if $(FLUTTER_DEVICE_HOST),--dart-define=E2E_KEYCLOAK_URL=http://$(FLUTTER_DEVICE_HOST):8080,) \
	$(if $(FLUTTER_DEVICE_HOST),--dart-define=E2E_RESOLVER_URL=http://$(FLUTTER_DEVICE_HOST):5050,) \
	$(if $(FLUTTER_DEVICE_HOST),--dart-define=E2E_BANK_URL=http://$(FLUTTER_DEVICE_HOST):5010,) \
	$(if $(FLUTTER_DEVICE_HOST),--dart-define=E2E_PIZZA_URL=http://$(FLUTTER_DEVICE_HOST):5030,) \
	$(if $(FLUTTER_DEVICE_HOST),--dart-define=E2E_MARKETPLACE_URL=http://$(FLUTTER_DEVICE_HOST):5040,)

flutter-test-e2e: ## Run Flutter E2E on a booted iOS simulator against the dev stack (set FLUTTER_E2E_DEVICE in .env.local; run 'make dev' first)
	@echo "Checking dev stack is running..."
	@curl -sf http://localhost:5050/health > /dev/null 2>&1 || (echo "Error: Dev stack not running. Start it with 'make dev' first." && exit 1)
	@SIM_ID=$$(FLUTTER_E2E_DEVICE="$(FLUTTER_E2E_DEVICE)" ./scripts/resolve-ios-simulator.sh); \
	if [ -z "$$SIM_ID" ]; then exit 1; fi; \
	echo "Running E2E tests on simulator $$SIM_ID..."; \
	cd platform/client-app && flutter test integration_test/ -d "$$SIM_ID" \
		--dart-define=OHPP_ANTI_AGENT_MODE=test \
		--dart-define=OTEL_ENDPOINT=$(if $(OTEL_ENDPOINT),$(OTEL_ENDPOINT),http://localhost:4318) \
		--dart-define=CRASH_DSN=$(if $(CRASH_DSN),$(CRASH_DSN),$(SEEDED_CRASH_DSN)) \
		--dart-define=E2E_PIZZA_URL=$(if $(E2E_PIZZA_URL),$(E2E_PIZZA_URL),http://localhost:5030) \
		--dart-define=E2E_MARKETPLACE_URL=$(if $(E2E_MARKETPLACE_URL),$(E2E_MARKETPLACE_URL),http://localhost:5040) \
		$(if $(ANALYTICS_HOST),--dart-define=ANALYTICS_HOST=$(ANALYTICS_HOST),) \
		$(if $(ANALYTICS_KEY),--dart-define=ANALYTICS_KEY=$(ANALYTICS_KEY),)
	@echo "✓ E2E tests passed"

flutter-play-sim: ## UX/UI hands-on on a booted iOS SIMULATOR against localhost (fast, no signing/tailnet). Set FLUTTER_E2E_DEVICE to pick the sim; run 'make dev' first.
	@echo "Checking dev stack is running..."
	@curl -sf http://localhost:5050/health > /dev/null 2>&1 || (echo "Error: Dev stack not running. Start it with 'make dev' first." && exit 1)
	@SIM_ID=$$(FLUTTER_E2E_DEVICE="$(FLUTTER_E2E_DEVICE)" ./scripts/resolve-ios-simulator.sh); \
	if [ -z "$$SIM_ID" ]; then exit 1; fi; \
	echo "Running app on simulator $$SIM_ID (backend: localhost)..."; \
	cd platform/client-app && flutter run -d "$$SIM_ID" \
		--dart-define=OHPP_ANTI_AGENT_MODE=test \
		--dart-define=RESOLVER_URL=http://localhost:5050 \
		--dart-define=KEYCLOAK_TOKEN_URL=http://localhost:8080/realms/ohpp/protocol/openid-connect/token \
		$(FLUTTER_OBS_DEFINES)

flutter-verify-pinning: ## Live cert-pinning check: real Dio+adapter accepts the resolver's real cert, rejects a wrong one (needs 'make dev')
	@echo "Reading dev root CA from the ca_certs volume..."
	@ROOT_CA_B64="$$($(COMPOSE_BACKING) run --rm --no-deps -T --entrypoint sh cert-init -c 'base64 /certs/root_ca.crt' | tr -d '\r\n')"; \
	if [ -z "$$ROOT_CA_B64" ]; then echo "Error: could not read dev root CA. Run 'make dev' (or 'make ca-issue') first." && exit 1; fi; \
	cd platform/client-app && flutter test test_e2e/cert_pinning_live_test.dart \
		--dart-define=RESOLVER_TLS_URL=https://localhost:5443 \
		--dart-define=DEV_ROOT_CA_PEM_B64="$$ROOT_CA_B64"
	@echo "✓ Live cert-pinning verified (accepts real cert, rejects different — fail-closed)"

flutter-run-device: ## Run the app on a connected device with observability enabled (pass OTEL_ENDPOINT/CRASH_DSN/ANALYTICS_*)
	cd platform/client-app && flutter run $(FLUTTER_OBS_DEFINES)

# ─── On-device workflows (physical iPhone) ───────────────────────────────────
# Three-mode split (see also flutter-test-e2e for the simulator path):
#   dev + first-round validation  -> simulator        (make flutter-test-e2e)
#   validation sign-off           -> WIRED device      (make flutter-e2e-device)
#   UX/UI hands-on feedback       -> WIRELESS device   (make flutter-play-device)

# Which integration_test/*.dart files the on-device sign-off drives, in order.
# Override to run a subset while bringing tests up one at a time, e.g.:
#   make flutter-e2e-device FLUTTER_E2E_TESTS=smoke_device_test
#   make flutter-e2e-device FLUTTER_E2E_TESTS="smoke_device_test app_test"
FLUTTER_E2E_TESTS ?= smoke_device_test app_test crash_report_test crypto_device_test e2e_flows_test bank_approval_flow_test telemetry_export_test

flutter-e2e-device: ## Validation sign-off: automated E2E on a WIRED physical device via flutter drive (set FLUTTER_DEVICE_ID + FLUTTER_DEVICE_HOST; run 'make dev' first). Subset via FLUTTER_E2E_TESTS.
	@[ -n "$(FLUTTER_DEVICE_ID)" ] || (echo "Error: set FLUTTER_DEVICE_ID in .env.local (see 'flutter devices')." && exit 1)
	@[ -n "$(FLUTTER_DEVICE_HOST)" ] || (echo "Error: set FLUTTER_DEVICE_HOST in .env.local (LAN IP or tailnet host the phone can reach)." && exit 1)
	@echo "Checking dev stack is reachable at $(FLUTTER_DEVICE_HOST):5050 ..."
	@curl -sf http://$(FLUTTER_DEVICE_HOST):5050/health > /dev/null 2>&1 || (echo "Error: backend not reachable at http://$(FLUTTER_DEVICE_HOST):5050. Start it with 'make dev' and confirm the phone can reach this host." && exit 1)
	@echo "NOTE: use a USB cable. Wireless debug-attach is unreliable for automated driving on iOS."
	@# Incremental build by default (fast; flutter drive rebuilds only what changed).
	@# Pass FLUTTER_E2E_CLEAN=1 to force a full clean rebuild — use that if you ever
	@# suspect a stale binary (e.g. results don't reflect a source change).
	@if [ -n "$(FLUTTER_E2E_CLEAN)" ]; then \
		echo "FLUTTER_E2E_CLEAN set: forcing a clean rebuild..."; \
		cd platform/client-app && flutter clean > /dev/null 2>&1 && rm -rf build/ios && cd - > /dev/null; \
	fi
	@for t in $(FLUTTER_E2E_TESTS); do \
		echo "=== flutter drive: $$t ==="; \
		./scripts/check-ios-device-unlocked.sh "$(FLUTTER_DEVICE_ID)" || exit 1; \
		cd platform/client-app && flutter drive \
			--driver=test_driver/integration_test.dart \
			--target=integration_test/$$t.dart \
			-d "$(FLUTTER_DEVICE_ID)" \
			--dart-define=OHPP_ANTI_AGENT_MODE=test \
			$(FLUTTER_DEVICE_E2E_DEFINES) \
			--dart-define=OTEL_ENDPOINT=$(if $(OTEL_ENDPOINT),$(OTEL_ENDPOINT),http://$(FLUTTER_DEVICE_HOST):4318) \
			|| exit 1; \
		cd - > /dev/null; \
	done
	@echo "✓ On-device E2E passed (wired)"

flutter-play-device: ## UX/UI hands-on: install a RELEASE build on the device (wireless OK) pointed at FLUTTER_DEVICE_HOST over your tailnet/LAN (not for automated testing)
	@[ -n "$(FLUTTER_DEVICE_ID)" ] || (echo "Error: set FLUTTER_DEVICE_ID in .env.local (see 'flutter devices')." && exit 1)
	@[ -n "$(FLUTTER_DEVICE_HOST)" ] || (echo "Error: set FLUTTER_DEVICE_HOST in .env.local (LAN IP or tailnet host the phone can reach)." && exit 1)
	@echo "Checking the iPhone is unlocked (a locked device can't install/launch)..."
	@./scripts/check-ios-device-unlocked.sh "$(FLUTTER_DEVICE_ID)"
	@# Incremental by default. Pass FLUTTER_PLAY_CLEAN=1 to force a fresh build
	@# (use when a code change isn't showing up on the device).
	@if [ -n "$(FLUTTER_PLAY_CLEAN)" ]; then \
		echo "FLUTTER_PLAY_CLEAN set: forcing a clean rebuild..."; \
		cd platform/client-app && flutter clean > /dev/null 2>&1 && rm -rf build/ios && cd - > /dev/null; \
	fi
	@echo "Installing RELEASE build on $(FLUTTER_DEVICE_ID), backend host $(FLUTTER_DEVICE_HOST) ..."
	cd platform/client-app && flutter run --release -d "$(FLUTTER_DEVICE_ID)" \
		$(FLUTTER_DEVICE_DEFINES) $(FLUTTER_OBS_DEFINES)
	@echo "Release build installed. Over wireless, flutter run may not stay attached — that's fine:"
	@echo "the release app runs standalone. Just tap the app icon on the phone to open it."

flutter-lint: ## Run Flutter analyzer (lint)
	cd platform/client-app && flutter analyze

flutter-build-ios: ## Build iOS app (debug, no codesign)
	cd platform/client-app && flutter build ios --debug --no-codesign $(FLUTTER_OBS_DEFINES)

flutter-build-android: ## Build Android APK (debug)
	cd platform/client-app && flutter build apk --debug $(FLUTTER_OBS_DEFINES)

# ─── Build ───────────────────────────────────────────────────────────────────

build: build-resolver build-bank build-insurance build-cli build-portal build-node-sdk build-pizza build-marketplace ## Build everything locally

build-resolver: ## Build the resolver
	dotnet build platform/resolver/Resolver.sln --maxcpucount:1 -p:GenerateContracts=true

build-bank: ## Build the bank
	dotnet build demo/mock-apps/dotnet/bank/Bank.sln
	npm --prefix demo/mock-apps/dotnet/bank/ui run build

build-insurance: ## Build the insurance claims app
	dotnet build demo/mock-apps/dotnet/insurance-claims/src/InsuranceClaims.Presentation/InsuranceClaims.Presentation.csproj
	npm --prefix demo/mock-apps/dotnet/insurance-claims/ui run build

build-cli: ## Build the CLI attester simulator
	dotnet build demo/client-cli/ClientCli.sln

build-portal: ## Build the portal
	npm --prefix platform/portal run build

build-node-sdk: ## Build the Node OHPP SDK
	npm --prefix sdks/node run build

build-pizza: ## Build the Pizza app (backend + frontend)
	npm --prefix sdks/node run build
	npm --prefix demo/mock-apps/node/pizza run build
	npm --prefix demo/mock-apps/node/pizza/client run build

build-marketplace: ## Build the Marketplace app (backend + frontend)
	npm --prefix sdks/node run build
	npm --prefix demo/mock-apps/node/marketplace run build
	npm --prefix demo/mock-apps/node/marketplace/client run build

# ─── Cleanup ─────────────────────────────────────────────────────────────────

clean: ## Stop dev stack and remove volumes
	$(COMPOSE) --profile tools down --volumes
	$(COMPOSE_BACKING) --profile analytics down --volumes

clean-cache: ## Clear Docker build cache (frees disk space)
	docker builder prune -a -f

clean-all: ## Nuclear option: stop everything, remove all images/volumes/cache
	$(COMPOSE) --profile tools down --volumes --rmi all 2>/dev/null || true
	$(COMPOSE_BACKING) --profile analytics down --volumes --rmi all 2>/dev/null || true
	docker builder prune -a -f
	@echo "Cleaned. Next 'make dev' or 'make test' will rebuild from scratch."

# ─── Test Stack (two tiers) ──────────────────────────────────────────────────
#
# U9: the test stack is NOT a separate compose file. docker-compose.test.yml is
# retired; the E2E suite runs the SAME split files as dev (docker-compose.backing.yml
# + docker-compose.apps.yml) as the WORKTREE'S OWN tenant (its allocated STACK_ID).
# Backing is the one shared tier (ohpp-backing); the app tier is this worktree's
# project ohpp-$(STACK_ID). reset-db.sql only ever touches this tenant's ohpp_N,
# so a parallel worktree's data is never affected. Debug data in this tenant is
# disposable (tests reset it); persistent data lives in a dedicated worktree you
# never run tests against.
#
# TEST_* vars are kept as thin aliases of the dev split-file vars so the targets
# and the names the harness/docs reference still resolve.

TEST_COMPOSE = $(COMPOSE)
TEST_COMPOSE_BACKING = $(COMPOSE_BACKING)
TEST_BACKING_SERVICES = postgres keycloak otel-collector tempo
TEST_APP_SERVICES = resolver portal bank insurance-claims pizza marketplace

test-backing-up: ## Ensure the shared backing tier is up (same one dev uses)
	@python3 scripts/gen-keycloak-redirects.py >/dev/null
	$(TEST_COMPOSE_BACKING) up cert-init
	$(TEST_COMPOSE_BACKING) up -d --wait $(TEST_BACKING_SERVICES)

test-backing-down: ## Stop the shared backing tier
	$(TEST_COMPOSE_BACKING) stop $(TEST_BACKING_SERVICES)

test-apps-up: ## Build + start this worktree's app tier for tests (auto-starts backing; inits this tenant's db)
	@docker compose -p ohpp-backing -f docker-compose.backing.yml ps --status running --services 2>/dev/null | grep -q '^postgres$$' || $(MAKE) test-backing-up
	$(MAKE) tenant-db-init
	$(TEST_COMPOSE) up --build -d --wait $(TEST_APP_SERVICES)

test-apps-down: ## Stop this worktree's app tier (leaves shared backing running)
	$(TEST_COMPOSE) stop $(TEST_APP_SERVICES)

test-stack-up: ## Start this worktree's full stack (shared backing + its app tier) for debugging
	$(MAKE) test-backing-up
	$(MAKE) tenant-db-init
	$(TEST_COMPOSE) up --build -d --wait $(TEST_APP_SERVICES)

test-stack-rebuild: ## Force rebuild this worktree's app images (no cache) and start
	$(TEST_COMPOSE) build --no-cache $(TEST_APP_SERVICES)
	$(MAKE) test-stack-up

test-stack-down: ## Tear down this worktree's app tier + volumes (shared backing left running)
	$(TEST_COMPOSE) --profile tools down --volumes --remove-orphans

test-stack-logs: ## Tail this worktree's app tier logs
	$(TEST_COMPOSE) logs -f --tail=50

test-stack-logs-pizza: ## Tail pizza container logs (this worktree's tenant)
	$(TEST_COMPOSE) logs -f --tail=50 pizza

test-stack-logs-marketplace: ## Tail marketplace container logs (this worktree's tenant)
	$(TEST_COMPOSE) logs -f --tail=50 marketplace

test-stack-ps: ## Show this worktree's tenant container status
	$(TEST_COMPOSE) ps -a
