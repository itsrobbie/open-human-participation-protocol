# Run a Resolver

A Resolver is the server-side component that routes participation requests between Requesters and users' devices. Running one makes you a participation service provider.

---

## Who would run a Resolver?

- A company building a participation service product (like building an email provider)
- An enterprise deploying OHPP internally (like running your own mail server)
- A developer building and testing OHPP integrations locally

For most Requesters (apps integrating OHPP), you don't need to run a Resolver. Your users choose their own provider, and you interact with it via the standard protocol. This guide is for people building or hosting the infrastructure.

---

## What a Resolver must do

### Required endpoints

| Endpoint | Purpose |
|----------|---------|
| `/.well-known/ohpp/metadata` | Discovery (advertise your endpoints and version) |
| `endpoints.participate` | Receive participation requests from Requesters |
| `endpoints.participate_status` | Status polling and cancellation |
| `endpoints.keys` | Publish JWKS (public keys for attestation verification) |

### Required capabilities

1. **Registration handling**: Receive challenges from Client Apps, fetch Requester app-metadata over TLS, verify domain ownership, issue Bearer tokens, call back to Requester's registration endpoint
2. **Request routing**: Accept participation requests, validate Bearer tokens + userId cross-check, deliver requests to the user's registered Client App
3. **Attestation relay**: Receive signed attestations from Client Apps, return them to Requesters
4. **Key publication**: Serve JWKS with current signing keys, support rotation

### Optional capabilities

- **Federation**: Accept forwarded requests from other Resolvers (set `endpoints.federation` in metadata)
- **Webhooks**: Push attestations to Requesters instead of requiring them to poll
- **Multiple devices**: Route to multiple registered Attesters per user

---

## ServiceMetadata format

Your `/.well-known/ohpp/metadata` endpoint must return:

```json
{
  "name": "My OHPP Resolver",
  "protocolVersion": {
    "min": "1.0",
    "max": "1.0"
  },
  "endpoints": {
    "participate": "https://resolver.example.com/api/participate",
    "participate_status": "https://resolver.example.com/api/participate/status",
    "keys": "https://resolver.example.com/.well-known/jwks.json",
    "federation": null
  }
}
```

---

## Security requirements

### Token issuance

During registration, generate an opaque Bearer token that:
- Uniquely identifies the app-user registration pair
- Cannot be guessed or enumerated
- Can be revoked by the user at any time

### Request validation

For every incoming participation request:
1. Validate Bearer token (present, not expired, not revoked)
2. Cross-check: token's associated userId must match `validation.userId` in the body
3. Validate schema (required fields, type/options consistency)
4. Check request hasn't expired
5. Verify app is registered for this user
6. Apply rate limits

Reject with appropriate HTTP status codes (401, 400, 403, 429).

### TLS

All endpoints must be served over HTTPS. During registration, the Resolver fetches Requester app-metadata over TLS - this is the domain verification step.

---

## Key management

### Generate signing keys

Generate an EC (P-256) or Ed25519 keypair. The private key signs attestations. The public key goes in your JWKS.

### JWKS format

```json
{
  "keys": [
    {
      "kty": "EC",
      "kid": "resolver-key-2026-07",
      "alg": "ES256",
      "use": "sig",
      "crv": "P-256",
      "x": "base64url-encoded-x",
      "y": "base64url-encoded-y"
    }
  ]
}
```

### Rotation

When rotating:
1. Generate new keypair
2. Add new public key to JWKS (with new `kid`)
3. Start signing new attestations with new key
4. Keep old public key in JWKS for at least 30 days
5. After overlap period, remove old key (optional)

Verifiers cache JWKS. Give them time to pick up the new key before removing the old one.

---

## Client App communication

The protocol does not define how a Resolver talks to its Client Apps. This is your internal implementation. Common approaches:

| Method | Pros | Cons |
|--------|------|------|
| Push notifications (APNs/FCM) | Battery-efficient, works when app is closed | Delivery not guaranteed, latency variable |
| WebSocket | Real-time, bidirectional | Requires persistent connection, battery cost |
| Polling | Simple, works everywhere | Latency, battery cost, server load |

Most production implementations use push notifications as the primary channel with WebSocket as a fallback for active sessions.

---

## Reference implementation (planned)

A reference Resolver implementation in .NET 10 is planned as part of this project. It will handle:

- ServiceMetadata serving
- Registration ceremony (including TLS-based domain verification)
- Token issuance and validation
- Request routing
- JWKS publication with key rotation support
- Status polling
- Request cancellation

Until the reference implementation is available, the protocol specification in [section 04](../04-specification/01-message-schemas.md) defines everything needed to build a Resolver from scratch.

---

## Next

- [FAQ →](04-faq.md)
- [Integrate as a Requester →](02-integrate-requester.md)
