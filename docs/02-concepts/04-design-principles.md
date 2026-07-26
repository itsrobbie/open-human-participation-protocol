# Design principles

Any solution to the Human Participation Problem must satisfy these principles. They are non-negotiable constraints that guided OHPP's design.

---

## 1. Full interoperability

Any compliant client app must work with any compliant application, via any compliant participation service.

This is the email model. You choose your email provider. You choose your email client. Any combination works with any sender. No vendor lock-in.

This principle is non-negotiable because proprietary alternatives already exist, and they don't scale. Google's Gemini "requires user confirmation before making purchases" but only within Google's ecosystem. Apple Intelligence asks before consequential actions but only on Apple devices. Banks send push notifications for transactions but each implements it differently. These are walled gardens. If participation verification requires per-application, per-platform custom work, it won't reach the scale needed to matter.

---

## 2. Transport agnostic (where it can be)

The protocol defines messages and ceremonies. Where those messages cross the interoperability boundary (Requester ↔ Resolver), the transport is HTTPS — because both sides need to agree on a wire format for principle 1 to hold. Discovery happens via `.well-known` endpoints over HTTP. Participation requests are POSTed over HTTPS. That's the common ground.

Where the protocol has no interoperability requirement — between a Resolver and its own Client Apps — transport is genuinely the provider's choice. Push notifications, WebSocket, long-polling, gRPC, carrier pigeon. The protocol doesn't care how a provider delivers requests to its users' devices, because both sides are controlled by the same provider.

---

## 3. Protocol doesn't block agents

This is not an anti-agent protocol. Agents are valuable. They should handle routine tasks autonomously, and OHPP exists to help them thrive, not hold them back.

Right now, people are trying to restrain agents by limiting their access or forcing controls. Where agents really excel is when you let them run freely, using your credentials to do what they do best. OHPP encourages that end state. It adds human controls only where the provider or the human deems it necessary, not by limiting agent access across the board.

OHPP is a win for agents too. If an agent orders 100 pizzas autonomously without a check, most people would blame the agent provider and never use them again. OHPP gives that last verification back to the human, protecting the agent provider's reputation. The agent can point to the attestation: the human confirmed it.

OHPP adds a "hook out" for moments that matter. The goal is not to stop automation. It's to identify when a human should be involved and give them the choice.

---

## 4. User choice of provider

Users choose their participation service provider the same way they choose an email provider.

Different providers compete on features, privacy, UX, and trust. Users switch providers without breaking any application integration. Requesting applications don't know or care which provider the user chose.

---

## 5. Honest attestation

When participation occurs, the attestation truthfully reports how it happened:

- Which device was used
- Whether it was directly approved, auto-approved by a rule, or delegated
- If delegated, to whom

The requesting application always knows the full story of how its request was resolved. No black boxes.

---

## 6. Self-contained proof

Participation attestations must be independently verifiable without contacting any live service.

Given an attestation and publicly available keys, any party - years later, offline, in a different jurisdiction - can verify that participation genuinely occurred. The proof doesn't depend on a service being available.

This follows the model established by W3C Verifiable Credentials (published as a W3C Recommendation in May 2025), which provides "a mechanism to express digital credentials that are cryptographically secure, privacy respecting, and machine-verifiable." OHPP attestations use the same pattern: signed with ES256 or EdDSA, verifiable via JWKS endpoints, no live service contact required.

---

## 7. Factual data only

The protocol carries facts. What was requested, what the human decided, when, and how. It does not carry opinions.

No "priority levels" - who decides what's high priority? The pizza shop? The bank? No "risk scores" - who defines risk? Those judgements belong to the requesting application. The protocol just moves the question to the human and brings back their answer.

---

## 8. Minimal attack surface

Every design decision in the protocol is made with an attacker in mind.

Registration challenges carry the bare minimum (just appId + challengeId + expiry). Domain ownership is verified over TLS. Callback URLs are derived from the appId domain, never provided by the caller. Bearer tokens are cross-checked against the userId in every request body. There's nothing to spoof, nowhere to redirect, and no extra data to exploit.

---

## 9. The channel exists above the agent layer

The participation channel *can* exist above the layer an agent controls. An agent can control a browser. An agent can control a desktop. An agent can make API calls. An agent cannot unlock your phone with your face or press your thumb on a fingerprint sensor.

But this is not a protocol requirement. The protocol cannot enforce what happens on the device — that's a client implementation decision. A security-conscious user will choose a client app that requires biometrics for every response. Someone who cares less might disable Face ID and let their agent answer participation requests on their behalf. That's their choice.

The point is: the choice exists. The human decides how much friction sits between the request and the response. The protocol gives them the channel. What they do with it — lock it behind biometrics, require a PIN, or leave it wide open — is up to them.

---

## 10. Don't reinvent identity

The world has spent 40 years building identity, authentication, and authorisation infrastructure. OHPP doesn't replace any of it.

OHPP adds a new question to the stack: beyond "who are you?" and "what can you do?" - it asks "is a human actually here, right now, for this specific decision?"

This is also what distinguishes OHPP from "proof of personhood" projects like Worldcoin, BrightID, and Gitcoin Passport. Those projects answer: "Is this a unique human?" Once, at identity level. OHPP answers: "Did a human participate in THIS specific decision, at THIS moment?" Per-action, every time it matters. They solve different problems at different granularities.

---

## Next

- [The Protocol: Overview →](../03-the-protocol/01-overview.md)

---

## References

- Google, "Building Gemini Intelligence on a Foundation of Security & Privacy," 2025. [blog.google](https://blog.google/security/android-gemini-intelligence-security-privacy/)
- W3C, "Verifiable Credentials Data Model v2.0," W3C Recommendation, May 2025. [w3.org](https://www.w3.org/press-releases/2025/verifiable-credentials-2-0/)
- W3C, "Verifiable Credential Data Integrity 1.0." [w3.org](https://www.w3.org/TR/vc-data-integrity/)
- Worldcoin, "Proof of Personhood: What it is and why it's needed." [worldcoin.org](https://worldcoin.org/blog/worldcoin/proof-of-personhood-what-it-is-why-its-needed)
- Worldcoin, "Introducing World ID 2.0." [worldcoin.org](https://worldcoin.org/blog/announcements/introducing-world-id-2.0)
- Gitcoin Passport / BrightID / Proof of Humanity overview. [gate.com](https://miniapp.gate.com/learn/articles/what-do-i-think-about-biometric-proof-of-personhood/1894)
