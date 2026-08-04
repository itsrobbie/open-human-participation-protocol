.PHONY: help dev dev-build dev-down dev-logs dev-logs-resolver dev-logs-bank dev-logs-insurance world-db-init cli cli-reset test test-ui test-file test-contracts test-unit test-unit-sdk test-unit-resolver test-unit-bank test-unit-insurance test-unit-cli test-unit-portal test-integration build build-resolver build-bank build-insurance build-cli build-portal clean clean-cache clean-all

# Default: show help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── Dev Stack ───────────────────────────────────────────────────────────────

world-db-init: ## Initialize or upgrade the single World database
	docker compose up -d --wait postgres
	docker compose exec -T postgres psql -U ohpp -d ohpp -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/001_world_schemas.sql

dev: world-db-init ## Start the dev stack (builds if needed)
	docker compose up --build -d
	@echo ""
	@echo "  Bank:            http://localhost:5010"
	@echo "  Insurance Claims: http://localhost:5020"
	@echo "  Portal:          http://localhost:3000"
	@echo "  Resolver:        http://localhost:5050/swagger"
	@echo "  CLI attester:    make cli (development simulator, not the mobile Client App)"
	@echo ""

dev-build: world-db-init ## Rebuild and restart the dev stack
	docker compose up --build -d --force-recreate
	@echo ""
	@echo "  Bank:            http://localhost:5010"
	@echo "  Insurance Claims: http://localhost:5020"
	@echo "  Portal:          http://localhost:3000"
	@echo "  Resolver:        http://localhost:5050/swagger"
	@echo "  CLI attester:    make cli (development simulator, not the mobile Client App)"
	@echo ""

dev-down: ## Stop the dev stack
	docker compose down

dev-logs: ## Tail logs from all services
	docker compose logs -f --tail=50

dev-logs-resolver: ## Tail resolver logs
	docker compose logs -f --tail=50 resolver

dev-logs-bank: ## Tail bank logs
	docker compose logs -f --tail=50 bank

dev-logs-insurance: ## Tail Insurance Claims logs
	docker compose logs -f --tail=50 insurance-claims

cli: ## Run the interactive development attester simulator
	docker compose --profile tools run --rm cli

cli-reset: ## Forget the CLI simulator token and signing keys
	docker compose --profile tools run --rm --entrypoint sh cli -c 'rm -f /root/.ohpp/cli-config.json'

# ─── E2E Tests ───────────────────────────────────────────────────────────────

test: ## Run all E2E tests (isolated stack, auto-teardown)
	npm exec --prefix tests/e2e -- playwright test --config tests/e2e/playwright.config.ts

test-ui: ## Run E2E tests with Playwright UI
	npm exec --prefix tests/e2e -- playwright test --config tests/e2e/playwright.config.ts --ui

test-file: ## Run a specific test file (usage: make test-file FILE=15-full-flow)
	npm exec --prefix tests/e2e -- playwright test --config tests/e2e/playwright.config.ts tests/e2e/tests/$(FILE)*.spec.ts

test-headed: ## Run E2E tests with browser visible
	npm exec --prefix tests/e2e -- playwright test --config tests/e2e/playwright.config.ts --headed

# ─── Unit Tests ──────────────────────────────────────────────────────────────

test-contracts: ## Validate Makefile and Compose developer surfaces
	node --test --test-reporter=dot tests/contracts/*.test.mjs

test-unit: ## Run all unit tests (SDKs + resolver + CLI + bank + insurance)
	$(MAKE) test-contracts
	dotnet test sdks/dotnet/tests/OHPP.Protocol.Tests.Unit/OHPP.Protocol.Tests.Unit.csproj
	dotnet test sdks/dotnet/tests/OHPP.Sdk.Tests.Unit/OHPP.Sdk.Tests.Unit.csproj
	dotnet test sdks/dotnet/tests/OHPP.Sdk.Server.Tests.Unit/OHPP.Sdk.Server.Tests.Unit.csproj
	dotnet test platform/resolver/Resolver.sln --filter "Category!=RequiresDocker"
	dotnet test demo/mock-apps/dotnet/bank/Bank.sln
	dotnet test demo/mock-apps/dotnet/insurance-claims/tests/InsuranceClaims.Tests.Unit/InsuranceClaims.Tests.Unit.csproj
	$(MAKE) test-unit-cli
	$(MAKE) test-unit-portal

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

test-integration: ## Run resolver integration tests (requires Docker postgres)
	dotnet build platform/resolver/tests/OHPP.Tests.Integration.Api/OHPP.Tests.Integration.Api.csproj --configuration Release --maxcpucount:1
	dotnet test platform/resolver/tests/OHPP.Tests.Integration.Api/OHPP.Tests.Integration.Api.csproj --configuration Release --no-build --filter "Category=RequiresDocker" --logger "console;verbosity=detailed"

# ─── Build ───────────────────────────────────────────────────────────────────

build: build-resolver build-bank build-insurance build-cli build-portal ## Build everything locally

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

# ─── Cleanup ─────────────────────────────────────────────────────────────────

clean: ## Stop dev stack and remove volumes
	docker compose down --volumes

clean-cache: ## Clear Docker build cache (frees disk space)
	docker builder prune -a -f

clean-all: ## Nuclear option: stop everything, remove all images/volumes/cache
	docker compose down --volumes --rmi all
	docker compose -p ohpp-test -f docker-compose.test.yml down --volumes --rmi all 2>/dev/null || true
	docker builder prune -a -f
	@echo "Cleaned. Next 'make dev' or 'make test' will rebuild from scratch."
