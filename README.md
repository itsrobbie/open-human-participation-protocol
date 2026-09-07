# Open Human Participation Protocol

**The internet was built assuming humans are at the keyboard. That assumption is no longer true.**

AI agents now operate autonomously, using legitimate credentials, navigating applications, approving workflows, and completing tasks - all without a human touching a button. Existing security infrastructure (OAuth, passkeys, FIDO2) can prove *who* performed an action. None of it can prove a human *actually participated*.

The Open Human Participation Protocol (OHPP) is an open protocol that enables any application to request - and cryptographically verify - that a human was meaningfully involved in a decision.

---

## The problem

Modern systems can prove identity. They cannot prove participation.

An AI agent can authenticate, navigate, approve, and complete workflows using valid credentials. The audit trail looks perfect. But the human may never have seen, reviewed, or consciously decided anything.

As agents become the primary operators of software, verifying genuine human involvement becomes a requirement for governance, compliance, and trust.

[Read the full problem statement →](docs/01-the-problem/01-human-participation-problem.md)

---

## The idea

What if applications could "hook out" to a human when participation is required? Not by reinventing identity or auth, but by adding a new layer: a standardised way to request human participation, collect a decision, and prove it happened.

Like email - where any client works with any server - OHPP defines an interoperable protocol where:
- Any application can request human participation
- Any participation service can route it to the human
- Any client app can collect the response
- The proof is cryptographic and independently verifiable

[Read the concepts →](docs/02-concepts/01-participation-vs-intent.md)

---

## How it works

Three roles. Two fixed endpoints. One ceremony.

| Role | What it does | Example |
|------|-------------|---------|
| **Requester** | Needs human participation | A pizza app, a bank, any SaaS |
| **Resolver** | Routes requests to the human | A Participation Service (like an email server) |
| **Attester** | Collects the human's decision | A phone app (like an email client) |

[Read the protocol overview →](docs/03-the-protocol/01-overview.md)

---

## Quick links

| Section | Description |
|---------|-------------|
| [01 - The Problem](docs/01-the-problem/) | Why this matters - the Human Participation Problem |
| [02 - Concepts](docs/02-concepts/) | Participation vs intent, the agentic world, design principles |
| [03 - The Protocol](docs/03-the-protocol/) | OHPP at a glance - roles, ceremonies, analogies |
| [04 - Specification](docs/04-specification/) | Formal message schemas, ceremonies, security |
| [05 - Use Cases](docs/05-use-cases/) | Real-world scenarios across industries |
| [06 - Getting Started](docs/06-getting-started/) | Integration guides, project status, FAQ |

---

## Status

The protocol specification is complete. A working reference implementation and demo are available:

| Component | Status |
|-----------|--------|
| Protocol specification (`/docs/`) | Complete |
| Resolver — Participation Service (.NET 8) | Working — `platform/resolver/` |
| .NET SDKs (Protocol, Requester, Server) | Working — `sdks/dotnet/` |
| Node.js SDK (TypeScript) | Working — `sdks/node/` |
| Portal — Management dashboard (React) | Working — `platform/portal/` |
| CLI attester simulator | Working for development and protocol testing in `demo/client-cli/` |
| Demo Bank App (OHPP-enabled, .NET) | Working — `demo/mock-apps/dotnet/bank/` |
| Demo Insurance Claims App (.NET) | Working — `demo/mock-apps/dotnet/insurance-claims/` |
| Demo Pizza App (Node SDK, Express + React) | Working — `demo/mock-apps/node/pizza/` |
| Demo Marketplace App (Node SDK, Express + React) | Working — `demo/mock-apps/node/marketplace/` |
| Docker Compose demo | Working — `make dev` |
| OHPP World landing page (single front door) | Working — `platform/landing/` (http://localhost:8888) |
| Client App (Flutter, iOS/Android) | Working — `platform/client-app/` |
| Repo-wide observability (OTel → Grafana/Loki/Tempo/Prometheus) | Working — `platform/observability/` |
| Crash reporting (GlitchTip) + product analytics (Umami, opt-in) | Working — `make dev` / `make dev-analytics` |
| HTTPS everywhere in dev (local step-ca) + app cert pinning | Working — `platform/ca/` |
| Additional mock apps (Python, Go) | Planned (U4-U5) |
| Mock AI Agent | Planned (U6) |

### Prerequisites

You need three things installed before you can run the project:

| Tool | What it is | Install |
|------|-----------|---------|
| **Git** | Version control (downloads the code) | [git-scm.com/downloads](https://git-scm.com/downloads) |
| **Docker Desktop** | Runs the whole stack in containers | [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/) |
| **Make** | Runs the project commands | Already on macOS/Linux. Windows: install via [chocolatey](https://chocolatey.org/) (`choco install make`) or use Git Bash. |

#### Installing Docker Desktop

1. Download Docker Desktop for your OS from [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/).
2. Run the installer and follow the prompts. Accept the defaults.
3. Once installed, open Docker Desktop. Wait until the bottom-left status indicator turns green and says "Engine running".
4. Leave Docker Desktop running in the background whenever you work on this project.

#### Verifying your setup

Open a terminal (Terminal on macOS, PowerShell or Git Bash on Windows), clone the repo, and run:

```bash
make check
```

It checks Docker, Docker Compose, Make, and Git are installed and that the Docker daemon is
running, printing a ✓ or a ✗ (with a fix) for each. When everything is ✓, you're ready for
`make dev`.

#### Common Docker problems

| Symptom | Cause | Fix |
|---------|-------|-----|
| `npipe:////./pipe/dockerDesktopLinuxEngine` error (Windows) | Docker Desktop is not running | Open Docker Desktop and wait for "Engine running" |
| `Cannot connect to the Docker daemon` (macOS/Linux) | Docker Desktop is not running | Open Docker Desktop or run `open -a Docker` on macOS |
| `permission denied` on Linux | Your user is not in the `docker` group | Run `sudo usermod -aG docker $USER` then log out and back in |
| Image pull takes a long time | Normal on first run | The first `make dev` downloads ~2 GB of images. Subsequent runs are fast because images are cached. |
| Port already in use | Another app is using that port | Stop the other app, or run `make dev-down` to stop a previous OHPP stack |

### Try it now

```bash
git clone https://github.com/itsrobbie/human-participation-protocol.git
cd human-participation-protocol
make check   # confirm you have Docker + the tools (first time)
make dev     # build + start everything
```

That's it. One command builds everything from source and starts the full stack, then prints a
single URL — the **front door** at http://localhost:8888 — that maps the whole demo. No SDK
installs, no database setup, no config files.

#### What `make dev` actually does

You don't need to understand this to use it, but if you're curious:

1. Issues a local dev Certificate Authority (step-ca) and per-service certificates, so every
   service-to-service hop runs over HTTPS/TLS - no proprietary certs or accounts needed.
2. Starts a PostgreSQL database container and runs schema migrations.
3. Starts the observability backbone (OpenTelemetry Collector → Loki/Tempo/Prometheus →
   Grafana) plus GlitchTip for crash reporting - all local, all open-source.
4. Builds Docker images for each service (Resolver, Portal, Bank, Pizza, the landing page, etc.) from source code.
5. Starts all containers in the background.
6. Prints a single URL — the front door at http://localhost:8888 — which maps every service. (`make urls` prints the full list.)

Everything runs offline from any vendor account. Product analytics (Umami) is opt-in via
`make dev-analytics` and is not started by the default `make dev`.

The first run takes 3-5 minutes (downloading base images and building). After that, rebuilds only take 30-60 seconds because Docker caches layers.

#### Stopping and restarting

```bash
make dev-down    # Stop everything
make dev         # Start again (fast, uses cached builds)
make dev-build   # Force a full rebuild if something seems stale
make clean       # Stop and delete all data (starts fresh next time)
```

Once running, open **one URL — the front door:**

### 👉 http://localhost:8888 — OHPP World

That landing page is your map to the whole demo. It has a get-started walkthrough and links to
every app, dashboard, and tool, grouped by purpose:
- **Demo apps** — Bank, Insurance Claims, Pizza, Marketplace (sign in with `demo` / `demo`)
- **Platform** — Portal (devices/apps), Resolver API (Swagger)
- **Observability** — Grafana (single pane for logs/traces/metrics), Prometheus, GlitchTip, Umami
- **Dev tools** — the CLI attester and the `make verify-*` checks

Prefer the terminal? `make urls` prints every service URL, and `make help` lists every command.

The stack has one World database container named `postgres`. The database entrypoint creates schemas and roles for a new volume. `make dev` also runs the same idempotent SQL inside that container, so an existing development volume is upgraded before the applications start. There is no second database or database initializer container.

[Full quick start guide →](docs/06-getting-started/01-quick-start.md)

---

## Development

All common commands are in the `Makefile`. Run `make help` to see everything.

| Command | What it does |
|---------|-------------|
| `make dev` | Start the dev stack (HTTPS everywhere, observability, crash reporting); prints the front door URL |
| `make dev-analytics` | Start the dev stack plus the opt-in analytics profile (Umami + stubs) |
| `make urls` | Print every service URL (the front door at :8888 shows these too) |
| `make verify-analytics` | Emit an event and confirm it lands in Umami (reviewable live check) |
| `make ca-verify` | Verify the local CA issued leaf certs with correct SANs and a trusted root |
| `make flutter-verify-pinning` | Live check: the app accepts the real resolver cert, rejects a wrong one (fail-closed) |
| `make cli` | Run the interactive CLI attester simulator |
| `make cli-reset` | Forget the CLI simulator token and signing keys |
| `make test` | Run the complete Playwright browser gate (isolated stack, auto-teardown) |
| `make test-unit` | Run contract, .NET, CLI, Portal, and Node unit gates |
| `make test-unit-node-sdk` | Run Node OHPP SDK unit + integration tests |
| `make test-unit-pizza` | Run Pizza app unit + integration tests |
| `make test-unit-marketplace` | Run Marketplace app unit + integration tests |
| `make test-integration` | Run all Resolver Docker integration classes in Release |
| `make test-unit-cli` | Run the CLI unit and infrastructure tests |
| `make test-unit-portal` | Run Portal Vitest and Testing Library tests |
| `make test-file FILE=26-portal-quality` | Run accessibility, refresh, concurrency, failure, and pagination browser evidence |
| `make test-file FILE=27-portal-mobile` | Run the dedicated 375px Portal project |
| `make build` | Build Resolver, Bank, Insurance Claims, CLI, Portal, and Node apps |
| `make build-pizza` | Build the Pizza app (SDK + backend + frontend) |
| `make build-marketplace` | Build the Marketplace app (SDK + backend + frontend) |
| `make clean-cache` | Free Docker disk space |

### Running tests

```bash
make test
```

Spins up an isolated Docker stack, runs all Playwright E2E tests through real browser interactions, and tears everything down. Your dev stack is never touched.

Use `make test-unit` for the complete fast gate and `make test-integration` for the 97 Resolver tests that require Testcontainers PostgreSQL. The integration target builds once, then runs the Release output without a nested test-time build and with detailed progress output. This avoids the .NET hang-dump collector, which is not supported reliably on macOS.

### CLI attester simulator

The CLI is a development attester simulator, not the planned iOS and Android Client App. It exercises the Attester role from a terminal: it registers an ES256 public key, listens for pending requests and server-sent events, collects a response, signs an attestation, and submits it to the Resolver.

1. Start the development stack with `make dev`.
2. In Portal, register a device and copy its device token.
3. Run `make cli`.
4. At the first prompt, paste the device token and enter `https://resolver:8443` as the Resolver URL (the CLI container trusts the dev CA root). The plain `http://resolver:8080` endpoint is also still reachable as a transitional fallback.
5. Create a participation request from a demo application. Leave the CLI running, then select an option or enter the requested value at its prompt.

The token and ES256 key pair persist in the Docker `cli_config` volume between runs. `make cli-reset` removes only the CLI configuration file. The next `make cli` run prompts for a new token and creates a new key pair. See [the CLI guide](demo/client-cli/README.md) for its scope and limitations.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.

## Contributing

Not accepting external contributions at this time.
