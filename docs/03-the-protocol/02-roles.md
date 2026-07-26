# Protocol roles

## Requester

**What it is**: Any application that needs human participation for certain actions.

**Examples**: A pizza ordering app, an online bank, a holiday booking site, an HR system, a smart home controller.

**What it does**:
- Generates registration challenges and presents them as `ohpp://` links
- Serves app metadata at `/.well-known/ohpp/app-metadata` (name, icon, callback path)
- Sends participation requests to the user's Resolver (with Bearer token auth)
- Receives signed attestations and verifies them
- Decides what to do based on the attestation (proceed, deny, retry)

**What it doesn't do**:
- Doesn't know which device the user has
- Doesn't know which participation provider the user chose
- Doesn't know how the participation was collected (biometrics, PIN, etc.)
- Doesn't communicate directly with the user's device

**Identity**: Domain-based `appId` (e.g., `pizza.example.com`). Globally unique, verifiable.

---

## Resolver

**What it is**: A participation service that routes requests to users and returns attestations. The "email server" of OHPP.

**Examples**: A company like "ParticipateHQ" or "HumanCheck" running a participation service. Or a self-hosted instance within an enterprise.

**What it does**:
- Serves discovery metadata at `/.well-known/ohpp/metadata` (endpoints, version)
- Handles registration (fetches Requester's app-metadata, issues tokens, calls back)
- Receives participation requests from Requesters
- Routes requests to the user's registered devices
- Returns signed attestations to Requesters
- Publishes public keys (JWKS) for attestation verification
- Optionally supports federation (forwarding to other Resolvers)

**What it doesn't do**:
- Doesn't define which actions require participation (that's the Requester's decision)
- Doesn't interpret or modify participation requests
- Doesn't know the business logic behind the request

**The Resolver ↔ Attester interface is internal to the provider.** The protocol standardises the Requester ↔ Resolver interface only.

---

## Attester

**What it is**: The endpoint (typically a phone app) that presents requests to the human and produces signed attestations.

**Examples**: A Flutter app on the user's phone, a companion app on a smartwatch, a desktop notification system.

**What it does**:
- Registers with a Resolver (user's chosen provider)
- Receives participation requests from the Resolver
- Presents requests to the human (summary, description, options)
- Verifies the human is present (biometrics, PIN - provider's choice)
- Signs attestations with a private key stored in the device's secure enclave
- Returns signed attestations to the Resolver
- Shows participation history

**What it doesn't do**:
- Doesn't communicate directly with Requesters
- Doesn't decide what actions require participation
- Doesn't validate business logic

---

## How they interact

```
Requester ──────── PROTOCOL BOUNDARY ────────── Resolver ······ (internal) ······ Attester
                                                                                      │
           ← Bearer token + ParticipationRequest →                                    │
                                                         ← push/deliver request →     │
                                                                                      │
                                                                              Human participates
                                                                                      │
                                                         ← signed attestation →       │
           ← ParticipationAttestation →                                               │
```

The protocol boundary is between Requester and Resolver. Everything between Resolver and Attester is internal to the participation service provider.

---

## Provider flexibility

A participation service provider typically builds both the Resolver and the Attester app together (like Gmail builds both the mail server and the Gmail app). But:

- A user could use one provider's Resolver with a different Attester (if providers support it)
- Multiple Attesters can register with one Resolver (phone + watch + tablet)
- A Resolver can forward to another Resolver (cross-provider delegation)

The user picks their provider. The Requester doesn't care which one. That's interoperability.

---

## Next

- [How It Works →](03-how-it-works.md)
- [Analogies →](04-analogies.md)
