# Proposals

Forward-looking additions under discussion. Nothing here is part of OHPP 1.0. Each proposal states its intended version, its compatibility impact, and a reference implementation path so it can be evaluated before it becomes normative.

---

## Resolution webhook (resolver to requester)

**Status:** proposed for 1.1. Optional, backward compatible (MINOR change).

### The gap

After a human answers a participation request, the request reaches a terminal state (`resolved`, `expired`, or `cancelled`) on the Resolver. Today the only way a Requester learns this is by **polling** `participate_status`. See [Ceremonies: polling and status](02-ceremonies.md#polling-and-status).

The protocol already has a resolver-to-requester push for exactly one event: **registration** (`registrationCallback`). There is no equivalent for **resolution**. That asymmetry is the gap: registration is event-driven, but resolution is poll-only.

Polling is fine as a baseline, but it has real costs:

- **Latency.** The Requester learns the outcome no sooner than its next poll. For an interactive experience this is visible lag.
- **Missed-while-away.** A Requester that is not actively polling at the moment of resolution (for example, because the relevant screen is closed, or the process was idle) does not find out until something else happens to poll. In practice this shows up as work that silently stalls.
- **Waste.** Every Requester polling every pending request is a lot of empty round-trips for events that are, individually, rare.

This surfaced concretely in the demo pizza app's multi-step ordering flow. Each step is an independent participation request; the app must send step N+1 only after step N resolves. With poll-only delivery, the flow only advanced while the user sat on the ordering screen (the only thing polling), so answering a step on the phone and navigating away froze the flow. See the reference alternative below.

### The proposal

Generalise the registration-callback pattern to resolution.

1. A Requester MAY publish an optional `resolutionCallback` relative path in its [`RequesterAppMetadata.endpoints`](01-message-schemas.md#requesterappmetadata). This is discovered by the Resolver at registration, exactly like `registrationCallback` - neither party needs build-time knowledge of the other; the link is a URL derived from published metadata plus the `appId` the Resolver already stores on every request.
2. When a request reaches a terminal state, the Resolver POSTs a small, signed [`ResolutionNotification`](01-message-schemas.md#resolutionnotification-proposed) to `https://{appId}{resolutionCallback}`.
3. On receipt, the Requester reads the outcome over its authenticated channel (`GET participate_status` / the attestation) and verifies the attestation against the JWKS - the same steps it does when polling.

```
Requester                              Resolver
    │  (request already PENDING)          │
    │                             human answers on device
    │                                     │  request -> RESOLVED
    │<── POST ResolutionNotification ─────│   (doorbell: requestId + status,
    │     (signed; no attestation)        │    NOT the attestation)
    │── GET participate_status ──────────>│
    │<── attestation ─────────────────────│
    │── verify signature (JWKS) ──────────│
```

### Design principles

- **Doorbell, not payload.** The notification carries only `requestId`, `status`, and optionally `transactionId`. It never carries the decision or attestation. The Requester always fetches and verifies the attestation over its authenticated channel, so the security model is identical to polling. A forged, replayed, or tampered notification can at most cause a redundant status fetch; it can never fabricate an outcome.
- **Signed.** The notification is signed with the Resolver's JWKS key (or an HMAC secret agreed at registration), and includes the `registrationId`, so a Requester can reject bogus calls cheaply before doing any work.
- **Complements polling; never replaces it.** Webhooks get lost. Delivery is best-effort: the Resolver retries with backoff, and the Requester keeps polling (or a periodic reconcile) as a backstop. A dropped notification self-heals on the next poll.
- **Idempotent by contract.** The same `requestId` may be delivered more than once, and may arrive after the Requester already learned the outcome by polling. Handlers must treat repeat deliveries as no-ops.
- **No lifecycle or sequencing change.** Each request stays independent. This proposal does not introduce multi-step, sequential, or conversational requests; any "flow" remains application-level orchestration layered on single request/attestation exchanges. The webhook only shortens the time between "human answered" and "Requester knows."

### Security considerations

- The callback endpoint is an unauthenticated inbound POST from the public internet. Treat every field as untrusted. The signature check plus the mandatory re-fetch-and-verify are what make it safe to act on.
- Requesters should rate-limit and de-duplicate by `requestId`/`notificationId` to blunt spam and replay.
- Resolvers must only notify the Requester that owns the request, and must not include any other user's or request's data.

### Compatibility and versioning

This is a MINOR change per [Versioning](04-versioning.md): it adds one optional metadata field and one optional message, and adds nothing required. A Resolver that does not implement it, or a Requester that does not publish `resolutionCallback`, behaves exactly as 1.0 (poll-only). Older clients ignore what they do not recognise.

### Reference alternative (available today, app-level)

Until/unless this is adopted, a Requester can achieve device-driven behaviour purely on its own side, within the current protocol, by running its own poll-and-advance loop server-side rather than depending on a user-facing screen to poll. The demo pizza app does this: a background sequencer periodically polls each in-progress flow's current step and, on resolution, sends the next request. This is the "Option A" pattern - fully spec-compliant (the Requester simply polls, as the protocol intends) and it does not require any resolver change.

Even if the resolution webhook is adopted, this app-side reconcile remains valuable as the backstop that covers missed notifications. The two compose: the webhook removes latency in the common case; the periodic reconcile guarantees eventual consistency when a notification is dropped.

---

## Next

- [Message Schemas](01-message-schemas.md)
- [Ceremonies](02-ceremonies.md)
- [Security](03-security.md)
- [Versioning](04-versioning.md)
