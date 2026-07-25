# The protocol: overview

## HPP in one paragraph

The Human Participation Protocol defines a standard way for any application to request human participation, route that request to the human's device, collect their decision, and return a cryptographically signed proof that participation occurred. It's interoperable (any app works with any provider), transport-agnostic (the protocol defines messages, not wires), and independently verifiable (proof is self-contained).

---

## The three roles

HPP defines three abstract roles:

### Requester

The application that needs human participation. A pizza shop, a bank, a SaaS tool, a smart home system - any software that reaches a point where a human should be involved.

The Requester doesn't know about devices, push notifications, or biometrics. It just says: "I need this human to participate in this decision" and gets back a signed attestation.

### Resolver

The service that routes participation requests to the human. Think of it as the "email server" of participation - it knows how to reach the user's devices, delivers the request, collects the response, and returns it to the Requester.

Users choose their Resolver (their "participation provider") the same way they choose Gmail or Outlook for email. Different providers, same protocol.

Discovery uses the `.well-known` URI pattern established by RFC 8615, the same mechanism used for ACME certificate validation, OpenID Connect discovery, and (increasingly) AI agent skill discovery. A Resolver advertises its endpoints at `/.well-known/hpp/metadata`; a Requester advertises its identity at `/.well-known/hpp/app-metadata`.

### Attester

The endpoint that collects the human's actual decision. Typically a phone app - it shows the request, verifies the human is present (biometrics, PIN), and produces a signed attestation that proves participation happened.

---

## The two ceremonies

### Registration

A one-time linking between a Requester and a user's Resolver. The app presents an `hpp://` link (or QR code encoding the same link). Tapping it opens the user's HPP Client App, which shows "Allow this app?" The user confirms, and the link is established. After registration, the Requester can send participation requests for that user.

### Participation

The core flow: Requester sends a request → Resolver routes to device → Human decides → Signed attestation flows back. The Requester verifies the signature and proceeds based on the human's decision.

---

## What makes it different

| | Traditional Auth | HPP |
|--|-----------------|-----|
| **Proves** | Identity | Participation |
| **When** | At login / session start | At decision points |
| **Channel** | Same channel as the action | Separate channel (the phone) |
| **After the fact** | Audit log says "user did X" | Cryptographic proof a human was involved |
| **Agent-proof** | No - agents can authenticate | Yes - agents can't unlock your phone |

---

## The email analogy

HPP's architecture mirrors email:

| Email | HPP |
|-------|-----|
| Sender | Requester (the app needing participation) |
| Sender's mail server | (not needed - Requester talks directly to Resolver) |
| Recipient's mail server | Resolver (routes to the user) |
| Recipient's email client | Attester (the phone app showing the request) |

Just like email:
- You choose your provider (Gmail, Outlook, self-hosted)
- Any sender can reach you regardless of your provider
- You can switch providers without telling every sender
- The protocol is open and interoperable

A company could build both the Resolver and the Attester app (like Gmail builds both server and client). Or they could be separate. The protocol doesn't care.

---

## The Google Authenticator analogy

The registration experience is similar to setting up a 2FA app:

1. You go to an app's security settings
2. It shows an `hpp://` link (and a QR code as a visual option)
3. You tap the link (or scan the QR from another device) — your HPP app opens
4. They're linked. Future requests route to your app.

The difference: instead of generating 6-digit codes, HPP delivers rich participation requests with descriptions, options, and context - and returns signed attestations.

---

## Next

- [Roles in Detail →](02-roles.md)
- [How It Works →](03-how-it-works.md)
- [Analogies →](04-analogies.md)

---

## References

- IETF, RFC 8615: "Well-Known Uniform Resource Identifiers (URIs)," May 2019. [ietf.org](https://datatracker.ietf.org/doc/html/rfc8615)
- Cloudflare, "Agent Skills Discovery RFC," 2025. [github.com](https://github.com/cloudflare/agent-skills-discovery-rfc)
