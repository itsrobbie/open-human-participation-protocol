# Quick start

## What's in this repository

This repository contains the complete OHPP protocol specification: the problem it solves, the concepts behind it, the formal message schemas, ceremony definitions, security model, and real-world use cases.

If you're evaluating OHPP, start here:

| If you want to... | Read |
|-------------------|------|
| Understand the problem | [01 - The problem](../01-the-problem/01-human-participation-problem.md) |
| Understand the approach | [02 - Concepts](../02-concepts/01-participation-vs-intent.md) |
| See how it works at a high level | [03 - The protocol](../03-the-protocol/01-overview.md) |
| Read the formal specification | [04 - Specification](../04-specification/01-message-schemas.md) |
| See industry-specific scenarios | [05 - Use cases](../05-use-cases/01-financial-services.md) |

---

## Current status

The protocol specification is complete. The following are in active development:

| Component | Status |
|-----------|--------|
| Protocol specification (this repo, `/docs/`) | Complete |
| Participation Service (Resolver, .NET 10) | Planned |
| Client App (Flutter, iOS/Android) | Planned |
| OHPP SDKs (TypeScript, Python, Go) | Planned |
| Demo simulation (Docker Compose) | Planned |
| Mock apps (10 apps, mixed tech stacks) | Planned |
| Mock AI Agent | Planned |

---

## What's coming: the demo simulation

Once built, the demo will be a local simulation of the entire OHPP ecosystem. One `docker compose up` command will start:

- A Resolver (Participation Service)
- A Client App simulator (web-based stand-in for the phone app)
- An AI Agent interface (preset actions, not free-form chat)
- 10 mock Requester apps written in different tech stacks (Express, Next.js, Flask, Django, FastAPI, Gin, Fiber)

The point of the demo: show that OHPP works across different technologies, and let people experience the difference between "agent with OHPP" and "agent without OHPP" firsthand.

---

## Want to implement OHPP now?

The protocol specification in [section 04](../04-specification/01-message-schemas.md) is complete enough to build against. If you want to integrate OHPP into an application today:

1. Read [Integrate as a Requester](02-integrate-requester.md) for the step-by-step protocol flow
2. Implement the five pieces: app-metadata endpoint, challenge generation, registration callback, participation requests, attestation verification
3. For testing, you'd need a Resolver to talk to (reference implementation coming soon)

---

## Next

- [Integrate as a Requester →](02-integrate-requester.md)
- [Run a Resolver →](03-run-resolver.md)
- [FAQ →](04-faq.md)
