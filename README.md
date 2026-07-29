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
| CLI Client App | Working — `demo/client-cli/` |
| Demo Bank App (OHPP-enabled) | Working — `demo/mock-apps/dotnet/bank/` |
| Docker Compose demo | Working — `docker compose up` |
| Client App (Flutter, iOS/Android) | Planned (U7) |
| Additional mock apps (Node, Python, Go) | Planned (U3-U5) |
| Mock AI Agent | Planned (U6) |

### Try it now

```bash
git clone https://github.com/your-org/human-participation-protocol.git
cd human-participation-protocol
docker compose up --build
```

That's it. One command builds everything from source and starts the full stack. No SDK installs, no database setup, no config files.

Once running, open:
- **Bank demo**: http://localhost:5010 — make a transfer, see OHPP in action
- **Portal**: http://localhost:3000 — register devices, manage apps
- **Resolver API**: http://localhost:5050/swagger — explore the protocol

[Full quick start guide →](docs/06-getting-started/01-quick-start.md)

---

## Development

All common commands are in the `Makefile`. Run `make help` to see everything.

| Command | What it does |
|---------|-------------|
| `make dev` | Start the dev stack |
| `make test` | Run E2E tests (isolated stack, auto-teardown) |
| `make test-unit` | Run .NET unit tests |
| `make build` | Build everything locally |
| `make clean-cache` | Free Docker disk space |

### Running tests

```bash
make test
```

Spins up an isolated Docker stack, runs all Playwright E2E tests through real browser interactions, and tears everything down. Your dev stack is never touched.

## License

[TBD]

## Contributing

[TBD]
