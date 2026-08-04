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
| Portal — Management dashboard (React) | Working — `platform/portal/` |
| CLI attester simulator | Working for development and protocol testing in `demo/client-cli/` |
| Demo Bank App (OHPP-enabled) | Working — `demo/mock-apps/dotnet/bank/` |
| Demo Insurance Claims App | Working — `demo/mock-apps/dotnet/insurance-claims/` |
| Docker Compose demo | Working — `docker compose up` |
| Client App (Flutter, iOS/Android) | Planned (U7) |
| Additional mock apps (Node, Python, Go) | Planned (U3-U5) |
| Mock AI Agent | Planned (U6) |

### Try it now

```bash
git clone https://github.com/your-org/human-participation-protocol.git
cd human-participation-protocol
make dev
```

That's it. One command builds everything from source and starts the full stack. No SDK installs, no database setup, no config files.

Once running, open:
- **Bank demo**: http://localhost:5010 — sign in with `demo` / `demo`, make a transfer, and see OHPP in action
- **Insurance Claims demo**: http://localhost:5020 — sign in with `demo` / `demo`, submit a claim, and reload to verify persistence
- **Portal**: http://localhost:3000 — register devices, manage apps, and use the development-only Protocol Lab
- **Resolver API**: http://localhost:5050/swagger — explore the protocol

The stack has one World database container named `postgres`. The database entrypoint creates schemas and roles for a new volume. `make dev` also runs the same idempotent SQL inside that container, so an existing development volume is upgraded before the applications start. There is no second database or database initializer container.

[Full quick start guide →](docs/06-getting-started/01-quick-start.md)

---

## Development

All common commands are in the `Makefile`. Run `make help` to see everything.

| Command | What it does |
|---------|-------------|
| `make dev` | Start the dev stack |
| `make cli` | Run the interactive CLI attester simulator |
| `make cli-reset` | Forget the CLI simulator token and signing keys |
| `make test` | Run the complete Playwright browser gate (isolated stack, auto-teardown) |
| `make test-unit` | Run contract, .NET, CLI, and Portal Vitest unit gates |
| `make test-integration` | Run all Resolver Docker integration classes in Release |
| `make test-unit-cli` | Run the CLI unit and infrastructure tests |
| `make test-unit-portal` | Run Portal Vitest and Testing Library tests |
| `make test-file FILE=26-portal-quality` | Run accessibility, refresh, concurrency, failure, and pagination browser evidence |
| `make test-file FILE=27-portal-mobile` | Run the dedicated 375px Portal project |
| `make build` | Build Resolver, Bank, Insurance Claims, CLI, and Portal |
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
4. At the first prompt, paste the device token and enter `http://resolver:8080` as the Resolver URL. That internal URL is reachable from the CLI container.
5. Create a participation request from a demo application. Leave the CLI running, then select an option or enter the requested value at its prompt.

The token and ES256 key pair persist in the Docker `cli_config` volume between runs. `make cli-reset` removes only the CLI configuration file. The next `make cli` run prompts for a new token and creates a new key pair. See [the CLI guide](demo/client-cli/README.md) for its scope and limitations.

## License

[TBD]

## Contributing

[TBD]
