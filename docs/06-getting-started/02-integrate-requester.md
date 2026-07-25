# Integrate as a Requester

This guide covers adding HPP to an existing application. Your app becomes a Requester: it can request human participation and receive signed attestations.

---

## What you need to implement

1. Serve app-metadata at `/.well-known/hpp/app-metadata`
2. Generate registration challenges and present them as `hpp://` links
3. Accept registration callbacks (receive Resolver credentials)
4. Send participation requests (when your app needs human input)
5. Verify attestation signatures

---

## Step 1: Serve app-metadata

Create a JSON endpoint at `/.well-known/hpp/app-metadata` on your domain:

```json
{
  "appId": "pizza.example.com",
  "name": "Pizza Palace",
  "icon": "https://pizza.example.com/icon.png",
  "endpoints": {
    "registrationCallback": "/hpp/registration-callback"
  },
  "version": "1.0"
}
```

Rules:
- Must be served over HTTPS
- `appId` must match your actual domain
- `registrationCallback` is relative to your domain root

---

## Step 2: Generate registration challenges

When a user wants to connect their HPP account, generate a RegistrationChallenge:

```json
{
  "challengeId": "550e8400-e29b-41d4-a716-446655440000",
  "requesterAppId": "pizza.example.com",
  "expiresAt": "2026-07-15T10:35:00Z",
  "createdAt": "2026-07-15T10:30:00Z"
}
```

Base64url-encode it and present as a link:

```html
<a href="hpp://register?challenge=eyJjaGFsbGVuZ2VJZCI6IjU1MGU4NDAwLi4uIn0">
  Connect HPP
</a>
```

Also show a QR code encoding the same `hpp://` URI for cross-device scanning.

Store the `challengeId` so you can match the incoming callback.

---

## Step 3: Accept registration callbacks

Implement a POST endpoint at your `registrationCallback` path. The Resolver will call it with:

```json
{
  "challengeId": "550e8400-e29b-41d4-a716-446655440000",
  "resolverBaseUrl": "https://participate.example.net",
  "userId": "user-abc-123",
  "accessToken": "opaque-token-xyz",
  "registrationId": "reg-550e8400",
  "createdAt": "2026-07-15T10:30:30Z"
}
```

Store per user:
- `resolverBaseUrl` - for endpoint discovery
- `userId` - for `validation.userId` in future requests
- `accessToken` - for Bearer authentication

Then discover the Resolver's endpoints:

```
GET https://participate.example.net/.well-known/hpp/metadata
```

Cache the response. You'll need `endpoints.participate` and `endpoints.keys`.

---

## Step 4: Send participation requests

When your app reaches a decision point:

```http
POST https://participate.example.net/api/participate
Authorization: Bearer opaque-token-xyz
Content-Type: application/json

{
  "id": "req-uuid-here",
  "version": "1.0",
  "requester": { "appId": "pizza.example.com" },
  "validation": { "userId": "user-abc-123" },
  "type": "select",
  "action": {
    "summary": "Confirm your pizza order ($23.00)?",
    "category": "orders"
  },
  "options": [
    { "key": "confirm", "label": "Confirm order" },
    { "key": "cancel", "label": "Cancel" }
  ],
  "createdAt": "2026-07-15T10:40:00Z"
}
```

Response: `{ "requestId": "req-uuid-here", "status": "pending" }`

Then poll `endpoints.participate_status` (or use webhooks if the Resolver supports them) until the status changes to `resolved`, `expired`, or `cancelled`.

---

## Step 5: Verify attestations

When you receive a ParticipationAttestation:

1. Fetch the Resolver's JWKS: `GET {endpoints.keys}`
2. Find the key where `kid` matches `attestation.signature.keyId`
3. Verify the signature over the attestation payload (minus the `signature` field)
4. Read `decision.selectedOption` (or `decision.value` for input types)
5. Act on the decision

If verification fails, treat the attestation as invalid. Do not proceed with the action.

---

## Integration patterns

### Selective participation

Don't ask for participation on everything. Choose the moments that matter:

```
IF amount > $50 → request participation
IF new recipient → request participation
IF repeat order, same address, under $30 → let the agent through
```

The protocol doesn't mandate when to ask. Your app decides based on business logic, risk assessment, and UX goals.

### Graceful fallback

Not all users will have HPP set up. Handle both paths:

```
IF user has HPP registration → send participation request, wait for attestation
ELSE → use existing flow (whatever you do today)
```

HPP is additive. It doesn't break existing flows.

### Timeout handling

Set `expiry` on time-sensitive requests. If the human doesn't respond in time:

```
IF request expired → fall back to denial (safest default)
OR → retry with a new request
OR → proceed without attestation (if the action is low-risk)
```

Your business logic decides.

---

## SDK support (planned)

HPP SDKs will handle the protocol mechanics (challenge generation, signature verification, endpoint discovery) so integrators can focus on business logic. Planned SDKs:

- **.NET** (reference implementation)
- **TypeScript/Node**
- **Python**
- **Go**

Until SDKs are available, implement directly against the protocol specification in [section 04](../04-specification/01-message-schemas.md). The protocol surface is small: a few JSON schemas, standard HTTPS calls, and JWKS-based signature verification.

---

## Next

- [Run a Resolver →](03-run-resolver.md)
- [FAQ →](04-faq.md)
