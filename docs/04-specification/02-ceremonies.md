# Ceremonies

OHPP defines four ceremonies. Two are core (Registration, Participation), one enables verification after the fact, and one enables cross-provider delegation.

---

## Registration

Links a Requester to a user's Resolver. Happens once per user-app pair.

### Sequence

```
Requester                     Client App                    Resolver
    │                              │                           │
    │── 1. Generate challenge ─────│                           │
    │                              │                           │
    │── 2. Present ohpp:// link ───>│                           │
    │                              │                           │
    │                              │── 3. Forward challenge ──>│
    │                              │                           │
    │                              │                   4. Fetch app-metadata
    │                              │                      GET https://{appId}/.well-known/ohpp/app-metadata
    │                              │                           │
    │<───── 5. POST RegistrationResponse to callback ─────────│
    │                              │                           │
    │── 6. Discover endpoints ────────────────────────────────>│
    │      GET {resolverBaseUrl}/.well-known/ohpp/metadata      │
    │                              │                           │
    │── 7. Store credentials ──────│                           │
    │      (resolverBaseUrl, userId, accessToken)              │
```

### Step details

**Step 1** - Requester generates a RegistrationChallenge containing only: `challengeId`, `requesterAppId`, `expiresAt`, `createdAt`. No Resolver URL is needed at this point.

**Step 2** - The challenge is base64url-encoded into an `ohpp://` URI and presented as a clickable link. The OS routes it to the user's installed Client App. QR codes are an optional visual convenience encoding the same URI.

**Step 3** - The Client App receives the challenge and forwards it to its own Resolver. This is an internal call (provider-specific, not protocol-standardised).

**Step 4** - The Resolver fetches `https://{requesterAppId}/.well-known/ohpp/app-metadata` over TLS. This is the anti-spoofing check: only the real domain owner can serve content at that URL. The Resolver reads the app name, icon, and callback path from this metadata.

**Step 5** - The Resolver constructs the callback URL as `https://{requesterAppId}{registrationCallback}` and POSTs a RegistrationResponse containing: `challengeId`, `resolverBaseUrl`, `userId`, `accessToken`, `registrationId`, `createdAt`.

**Step 6** - The Requester now knows the Resolver URL for the first time. It fetches `/.well-known/ohpp/metadata` to discover all endpoints.

**Step 7** - The Requester stores three values for this user: `resolverBaseUrl`, `userId`, `accessToken`. Registration is complete.

### Error handling

| Condition | Behaviour |
|-----------|-----------|
| Challenge expired | Resolver rejects. No callback sent. |
| App-metadata unreachable | Resolver rejects registration (cannot verify Requester). |
| App-metadata `appId` doesn't match serving domain | Resolver rejects (possible spoofing). |
| Callback endpoint unreachable | Resolver retries (implementer defines retry policy). |
| User already registered with this app | Return existing registration or error (implementer choice). |

### Security properties

- The Requester never needs to know the Resolver URL beforehand
- The Resolver verifies Requester identity by fetching metadata from the claimed domain over TLS
- The callback URL is always constructed from the appId domain, so it cannot be redirected by an attacker
- Challenge expiry limits the window for interception

---

## Participation

The core protocol flow. Produces a signed attestation proving human participation.

### Sequence

```
Requester                         Resolver                      Attester (Client App)
    │                                │                               │
    │── 1. POST ParticipationRequest ──>│                            │
    │   (Bearer token + validation.userId)                           │
    │                                │                               │
    │                        2. Validate request                     │
    │                           - token valid?                       │
    │                           - userId matches token?              │
    │                           - schema valid?                      │
    │                           - not expired?                       │
    │                                │                               │
    │                                │── 3. Route to device(s) ─────>│
    │                                │                               │
    │                                │                       4. Present to human
    │                                │                          (summary, options)
    │                                │                               │
    │                                │                       5. Human participates
    │                                │                          (biometric/PIN + decision)
    │                                │                               │
    │                                │<── 6. Signed attestation ─────│
    │                                │                               │
    │<── 7. Return ParticipationAttestation ─│                       │
    │                                │                               │
    │── 8. Verify signature ─────────│                               │
    │      (fetch JWKS from endpoints.keys)                          │
```

### Step details

**Step 1** - Requester sends a ParticipationRequest to the `endpoints.participate` URL (discovered from metadata). Includes `Authorization: Bearer {accessToken}` header and `validation.userId` in the body.

**Step 2** - Resolver validates: Bearer token is valid, token matches the userId in the body, request schema is correct, request hasn't expired, app is registered for this user, rate limits not exceeded.

**Step 3** - Resolver delivers the request to the user's registered device(s). How this happens (push notification, WebSocket, polling) is internal to the provider.

**Step 4** - Client App shows the request: app name, action summary, description (if provided), and options or input field based on the type.

**Step 5** - Human authenticates (biometric, PIN, or other method chosen by the provider) and makes their decision.

**Step 6** - Client App constructs a ParticipationAttestation containing the decision, timestamps, resolution metadata, and signs it with the device's private key (typically stored in the secure enclave).

**Step 7** - Attestation flows back through the Resolver to the Requester. The delivery method (held connection, polling, callback) is an implementation decision.

**Step 8** - Requester fetches the Resolver's JWKS (from `endpoints.keys`), finds the key matching `signature.keyId`, and verifies the signature. Then acts on the decision.

### Polling and status

Requesters can check request status via `endpoints.participate_status`:

- `pending` - waiting for human response
- `resolved` - attestation available
- `expired` - request timed out (if `expiry` was set)
- `cancelled` - Requester cancelled the request

Requesters can cancel pending requests via the same endpoint.

### Error handling

| Condition | HTTP Response |
|-----------|--------------|
| App not registered for user | 403 Forbidden |
| Invalid request schema | 400 Bad Request |
| Request already expired at submission | 400 Bad Request |
| User has no registered devices | 503 Service Unavailable |
| Bearer token invalid or missing | 401 Unauthorized |
| Token/userId mismatch | 401 Unauthorized |

---

## Verification

Any party holding an attestation can verify it independently. No live service calls are required beyond fetching the public keys (which can be cached).

### Sequence

```
Verifier                          Resolver (JWKS endpoint only)
    │                                │
    │── 1. Obtain attestation ───────│  (from Requester records, audit trail, etc.)
    │                                │
    │── 2. GET /.well-known/ohpp/metadata ──>│
    │<── endpoints.keys URL ─────────│
    │                                │
    │── 3. GET {endpoints.keys} ────>│
    │<── JWKS (public keys) ─────────│
    │                                │
    │── 4. Match keyId to kid ───────│
    │                                │
    │── 5. Verify signature ─────────│
    │      (ES256 or EdDSA)          │
    │                                │
    │── 6. Result: valid or invalid ─│
```

### What "valid" means

A valid signature proves: the attestation was produced by a device holding the private key corresponding to the public key published by that Resolver. It has not been tampered with since signing.

It does not prove the identity of the human (that's the provider's responsibility) or that the human carefully considered their decision (that's a UX concern, not a cryptographic one).

### Offline verification

If a verifier has previously fetched and cached the JWKS, verification is fully offline. No network calls needed. This makes attestations useful in disconnected environments, legal proceedings, and long-term audit trails.

---

## Federation (cross-provider delegation)

Allows a Resolver to forward a request to another Resolver when a user has delegation rules configured. The mechanism works automatically because both Resolvers speak the same protocol.

### Sequence

```
Requester            Resolver A (user's)          Resolver B (delegate's)       Delegate's Attester
    │                      │                            │                              │
    │── 1. Request ───────>│                            │                              │
    │                      │                            │                              │
    │              2. Check delegation rules             │                              │
    │                 (matches - forward to B)           │                              │
    │                      │                            │                              │
    │                      │── 3. POST to federation ──>│                              │
    │                      │   endpoint on Resolver B   │                              │
    │                      │                            │── 4. Route to delegate ──────>│
    │                      │                            │                              │
    │                      │                            │                    5. Delegate participates
    │                      │                            │                              │
    │                      │                            │<── 6. Inner attestation ──────│
    │                      │                            │                              │
    │                      │<── 7. Return inner ────────│                              │
    │                      │       attestation          │                              │
    │                      │                            │                              │
    │              8. Wrap: outer attestation            │                              │
    │                 method=delegated                   │                              │
    │                 delegatedAttestation=inner         │                              │
    │                      │                            │                              │
    │<── 9. Wrapped attestation ──│                     │                              │
```

### What the Requester sees

The Requester receives an attestation where:
- `resolution.method` = `"delegated"`
- `resolution.delegatedTo` identifies the delegate
- `resolution.delegatedAttestation` contains the full inner attestation from the delegate's Resolver

Both the inner and outer attestations are independently verifiable using their respective Resolver's JWKS.

### Delegation is a Resolver feature

The protocol does not define how delegation rules are configured. That's up to the Resolver/Client App implementation. The protocol only defines the federation endpoint that makes forwarding possible. Resolvers may choose not to support federation at all (set `endpoints.federation` to null in their metadata).

---

## Request lifecycle (state machine)

```
                    +----------+
                    | CREATED  |
                    +----+-----+
                         | submit to Resolver
                         v
                    +----------+
              +-----| PENDING  |-----+
              |     +----+-----+     |
              |          |           | expiry reached
              |          |           v
              |          |     +----------+
              |          |     | EXPIRED  |
              |          |     +----------+
              |          |
              |          | human responds
              |          v
              |     +----------+
              |     | RESOLVED |
              |     +----------+
              |
              | cancelled by Requester
              v
         +----------+
         |CANCELLED |
         +----------+
```

Terminal states: RESOLVED, EXPIRED, CANCELLED. No transitions out of terminal states.

---

## Next

- [Security →](03-security.md)
- [Versioning →](04-versioning.md)
