# Security

## Transport security

All communication between Requester and Resolver must use TLS 1.2 or higher. The protocol does not define transport between Resolver and Attester (that's provider-internal), but TLS is strongly recommended there too.

---

## Authentication model

### Bearer tokens

During registration, the Resolver issues an opaque Bearer token to the Requester. Every subsequent request includes this token in the `Authorization` header:

```
Authorization: Bearer {accessToken}
```

The token identifies both the app and the user-registration pair. The Requester does not need to understand the token's structure.

### Cross-check: validation.userId

Every ParticipationRequest includes `validation.userId` in the body. The Resolver checks that the Bearer token and the userId refer to the same registration. If they don't match, the request is rejected with 401.

This prevents a compromised token from being used to impersonate a different user.

### Token lifecycle

- Issued during registration
- Valid until revoked or rotated
- If a Resolver returns 401, the Requester must re-register
- Token rotation is a Resolver implementation choice (not protocol-defined)

---

## Anti-spoofing: registration verification

The registration ceremony includes a built-in anti-spoofing mechanism:

1. The RegistrationChallenge contains only `requesterAppId` (a domain)
2. The Resolver fetches `https://{requesterAppId}/.well-known/ohpp/app-metadata` over TLS
3. Only the real domain owner can serve content at that URL
4. The callback path is read from this metadata and appended to the appId domain
5. The callback URL is always `https://{requesterAppId}{callbackPath}` - it cannot be redirected

An attacker would need to control the DNS and TLS certificate for the target domain to spoof a registration. This is the same trust model used by ACME (Let's Encrypt) certificate validation.

---

## Attestation integrity

### Signing

Attestations are signed using the device's private key (stored in the secure enclave on mobile devices). The signature covers the full attestation payload minus the `signature` field.

### Approved algorithms

| Algorithm | Key type | Curve | Notes |
|-----------|----------|-------|-------|
| ES256 | EC | P-256 | Default. Wide hardware and library support. |
| EdDSA | OKP | Ed25519 | Faster, smaller signatures. Growing support. |

No other algorithms are permitted. This keeps the verification surface small and auditable.

### Verification

Any party can verify an attestation by:
1. Fetching the Resolver's JWKS from `endpoints.keys`
2. Matching `signature.keyId` to a `kid` in the key set
3. Running the cryptographic verification

No live connection to the signing device is needed. No service calls beyond the JWKS fetch (which can be cached).

---

## Key management

### Key publication

Resolvers publish their public keys at the URL specified in `endpoints.keys` (from `/.well-known/ohpp/metadata`). Keys are in JWKS format (RFC 7517).

### Key rotation

When rotating keys:
- New key is added to the JWKS
- Old key remains for a overlap period (recommended: 30 days minimum)
- Attestations signed with old keys remain verifiable during overlap
- After overlap, old keys may be removed (existing attestations become unverifiable by external parties without cached keys)

### Private key storage

The protocol recommends (but does not mandate) that private keys are stored in device secure enclaves (iOS Secure Enclave, Android StrongBox/TEE). This is a provider implementation decision.

---

## Replay protection

Each ParticipationRequest has a unique `id` (UUID v4). Resolvers must reject duplicate request IDs from the same Requester. Combined with the `createdAt` timestamp and optional `expiry`, this prevents replay attacks.

Attestations also carry unique IDs and reference the original request ID, making it impossible to reuse an attestation for a different request.

---

## Markdown content security

The `action.description` and `action.rationale` fields support Markdown. Client Apps that render Markdown must:

1. **Not load external resources** - images, iframes, and links to external URLs must not be fetched without explicit user action. This prevents tracking pixels, beacon images, and data exfiltration.
2. **Sanitize output** - rendered HTML must be sanitized to prevent XSS and script injection.
3. **Fall back gracefully** - if a Client App cannot render Markdown safely, it must display the raw text.

The `action.summary` field is plain text only. No Markdown allowed.

---

## Rate limiting

The protocol does not define rate limiting rules. Resolvers should implement rate limiting as appropriate for their infrastructure. Recommended considerations:

- Per-app limits (prevent a single Requester from flooding a user)
- Per-user limits (prevent abuse via many registered apps)
- Global limits (infrastructure protection)

Rate limit responses should use standard HTTP 429 with `Retry-After` header.

---

## Revocation

Users can revoke any app registration at any time through their Client App or Resolver's interface. Revocation must be immediate:

- No new requests accepted from the revoked app
- Pending requests from the revoked app are cancelled
- The Bearer token becomes invalid
- Existing attestations remain verifiable (they were valid at time of issuance)

---

## What the protocol does not cover

The protocol intentionally leaves these to the provider implementation:

| Concern | Why it's not in the protocol |
|---------|------------------------------|
| Biometric verification method | Provider differentiator. iOS Face ID, Android fingerprint, PIN - all valid. |
| User identity verification | How the Resolver knows the user is who they claim to be. Out of scope. |
| Device attestation | Whether the device itself is genuine hardware. Platform-level concern. |
| Client App distribution | How users get the app. App stores, sideloading - not protocol business. |
| Resolver ↔ Attester transport | Internal to provider. Push, WebSocket, carrier pigeon. |

---

## Next

- [Versioning →](04-versioning.md)
- [Message Schemas →](01-message-schemas.md)
