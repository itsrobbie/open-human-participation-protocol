# Human Participation Protocol

**The internet was built assuming humans are at the keyboard. That assumption is no longer true.**

AI agents now operate autonomously, using legitimate credentials, navigating applications, approving workflows, and completing tasks - all without a human touching a button. Existing security infrastructure (OAuth, passkeys, FIDO2) can prove *who* performed an action. None of it can prove a human *actually participated*.

The Human Participation Protocol (HPP) is an open protocol that enables any application to request - and cryptographically verify - that a human was meaningfully involved in a decision.

---

## The problem

Modern systems can prove identity. They cannot prove participation.

An AI agent can authenticate, navigate, approve, and complete workflows using valid credentials. The audit trail looks perfect. But the human may never have seen, reviewed, or consciously decided anything.

As agents become the primary operators of software, verifying genuine human involvement becomes a requirement for governance, compliance, and trust.

[Read the full problem statement →](docs/01-the-problem/01-human-participation-problem.md)

---

## The idea

What if applications could "hook out" to a human when participation is required? Not by reinventing identity or auth, but by adding a new layer: a standardised way to request human participation, collect a decision, and prove it happened.

Like email - where any client works with any server - HPP defines an interoperable protocol where:
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
| [03 - The Protocol](docs/03-the-protocol/) | HPP at a glance - roles, ceremonies, analogies |
| [04 - Specification](docs/04-specification/) | Formal message schemas, ceremonies, security |
| [05 - Use Cases](docs/05-use-cases/) | Real-world scenarios across industries |
| [06 - Getting Started](docs/06-getting-started/) | Run the demo, integrate HPP, FAQ |

---

## Status

This project is in active development. The protocol specification is being formalised, and a reference implementation (participation service, mobile client, and demo simulation) is being built.

## License

[TBD]

## Contributing

[TBD]
