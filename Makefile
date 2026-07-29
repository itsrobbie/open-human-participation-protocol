.PHONY: help dev dev-build dev-down dev-logs test test-ui test-file test-unit test-unit-resolver test-unit-bank build build-resolver build-bank build-portal clean clean-cache clean-all

# Default: show help
help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ─── Dev Stack ───────────────────────────────────────────────────────────────

dev: ## Start the dev stack (builds if needed)
	docker compose up --build -d
	@echo ""
	@echo "  Bank:     http://localhost:5010"
	@echo "  Portal:   http://localhost:3000"
	@echo "  Resolver: http://localhost:5050/swagger"
	@echo ""

dev-build: ## Rebuild and restart the dev stack
	docker compose up --build -d --force-recreate

dev-down: ## Stop the dev stack
	docker compose down

dev-logs: ## Tail logs from all services
	docker compose logs -f --tail=50

dev-logs-resolver: ## Tail resolver logs
	docker compose logs -f --tail=50 resolver

dev-logs-bank: ## Tail bank logs
	docker compose logs -f --tail=50 bank

# ─── E2E Tests ───────────────────────────────────────────────────────────────

test: ## Run all E2E tests (isolated stack, auto-teardown)
	cd tests/e2e && npx playwright test

test-ui: ## Run E2E tests with Playwright UI
	cd tests/e2e && npx playwright test --ui

test-file: ## Run a specific test file (usage: make test-file FILE=15-full-flow)
	cd tests/e2e && npx playwright test tests/$(FILE)*.spec.ts

test-headed: ## Run E2E tests with browser visible
	cd tests/e2e && npx playwright test --headed

# ─── Unit Tests ──────────────────────────────────────────────────────────────

test-unit: ## Run all .NET unit tests (resolver + bank)
	dotnet test platform/resolver/Resolver.sln --filter "Category!=RequiresDocker"
	dotnet test demo/mock-apps/dotnet/bank/Bank.sln

test-unit-resolver: ## Run resolver unit tests only
	dotnet test platform/resolver/Resolver.sln --filter "Category!=RequiresDocker"

test-unit-bank: ## Run bank unit tests only
	dotnet test demo/mock-apps/dotnet/bank/Bank.sln

test-integration: ## Run resolver integration tests (requires Docker postgres)
	dotnet test platform/resolver/Resolver.sln --filter "Category=RequiresDocker"

# ─── Build ───────────────────────────────────────────────────────────────────

build: build-resolver build-bank build-portal ## Build everything locally

build-resolver: ## Build the resolver
	dotnet build platform/resolver/Resolver.sln

build-bank: ## Build the bank
	dotnet build demo/mock-apps/dotnet/bank/Bank.sln

build-portal: ## Build the portal
	cd platform/portal && npm run build

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
