# Message schemas

This section defines the JSON message formats exchanged between protocol participants. All messages use JSON (RFC 8259) and are transmitted over HTTPS.

---

## ParticipationRequest

Sent by a Requester to a Resolver when human participation is needed.

```json
{
  "id": "string (UUID v4)",
  "version": "string (protocol version, e.g. '1.0')",
  "requester": {
    "appId": "string (domain-based identifier, e.g. 'pizza.example.com')"
  },
  "validation": {
    "userId": "string (must match the userId from registration)"
  },
  "action": {
    "summary": "string (plain text, max 200 chars)",
    "description": "string | null (Markdown, max 2000 chars)",
    "rationale": "string | null (Markdown, max 500 chars)",
    "category": "string | null (Requester-defined tag, max 50 chars)"
  },
  "type": "string (one of: select, multiselect, text, number, date, datetime, signature)",
  "options": [
    {
      "key": "string (machine-readable, unique within request)",
      "label": "string (human-readable, max 100 chars)",
      "freeText": "boolean | null (default false)",
      "placeholder": "string | null",
      "validation": {
        "required": "boolean (default true)",
        "min": "number | null",
        "max": "number | null",
        "pattern": "string | null (ECMAScript regex)"
      }
    }
  ],
  "placeholder": "string | null",
  "masked": "boolean | null (default false)",
  "keyboard": "string | null (one of: default, email, phone, url, number)",
  "validation": {
    "required": "boolean (default true)",
    "min": "number | null",
    "max": "number | null",
    "pattern": "string | null (ECMAScript regex)"
  },
  "expiry": "string | null (ISO 8601 timestamp)",
  "transaction": {
    "id": "string (UUID v4, same across related requests)",
    "label": "string | null (human-readable, max 100 chars)"
  },
  "createdAt": "string (ISO 8601 timestamp)"
}
```

### Required fields

- `id` - UUID v4, globally unique
- `version` - protocol version the Requester is speaking
- `requester.appId` - the Requester's domain-based identifier
- `validation.userId` - must match the userId obtained during registration
- `action.summary` - plain text, non-empty, max 200 characters
- `type` - one of the defined input types
- `createdAt` - ISO 8601 timestamp

### Conditionally required

- `options` - required when `type` is `select` or `multiselect`. Must contain at least 2 entries. Must be null or omitted for all other types.

### Optional fields

- `action.description` - longer detail, Markdown allowed
- `action.rationale` - why participation is needed, Markdown allowed
- `action.category` - Requester-defined grouping tag (not a global enum)
- `expiry` - must be in the future at submission time
- `transaction` - groups related requests for display purposes
- `placeholder` - hint text for input types
- `masked` - hides input characters (like a password field)
- `keyboard` - mobile keyboard layout hint
- `validation` - constraints on the input value

---

## Input types

| Type | User interaction | `options` array | Attestation value |
|------|-----------------|----------------|-------------------|
| `select` | Pick one from a list | Required (min 2) | `selectedOption` = key |
| `multiselect` | Pick multiple | Required (min 2) | `selectedOptions` = [keys] |
| `text` | Free text field | Not used | `value` = string |
| `number` | Number field | Not used | `value` = string |
| `date` | Date picker | Not used | `value` = ISO 8601 date |
| `datetime` | DateTime picker | Not used | `value` = ISO 8601 datetime |
| `signature` | Signature pad / drawing | Not used | `value` = base64 image |

### Free text on select options

Any option in a `select` or `multiselect` request can set `freeText: true`. When the user picks that option, the Client App shows a text input field. The attestation returns the option's key in `selectedOption`, with the typed input in `value`.

### Validation interpretation by type

| Type | `min` means | `max` means |
|------|------------|------------|
| `text` | Minimum character length | Maximum character length |
| `number` | Minimum numeric value | Maximum numeric value |
| `date` | Earliest allowed (ISO 8601) | Latest allowed (ISO 8601) |
| `datetime` | Earliest allowed (ISO 8601) | Latest allowed (ISO 8601) |
| `multiselect` | Minimum selections | Maximum selections |
| `signature` | N/A | N/A |
| `freeText` option | Minimum character length | Maximum character length |

All validation is client-side UX guidance. Requesters must validate returned values independently. `pattern` uses ECMAScript regex flavour for cross-platform compatibility.

---

## ParticipationAttestation

The signed response returned after a human participates.

```json
{
  "id": "string (UUID v4)",
  "requestId": "string (references the ParticipationRequest.id)",
  "version": "string (protocol version)",
  "decision": {
    "selectedOption": "string | null (key of selected option - select type)",
    "selectedOptions": ["string"] | null (selected keys - multiselect type)",
    "value": "string | null (user input - input types and freeText)",
    "timestamp": "string (ISO 8601, when the human decided)"
  },
  "resolution": {
    "method": "string (one of: direct, auto-approved, delegated)",
    "endpoint": {
      "type": "string (e.g. iphone, android, watch, desktop)",
      "id": "string (opaque device identifier)"
    },
    "autoApproveRule": "string | null (rule description if auto-approved)",
    "delegatedTo": "string | null (delegate userId if delegated)",
    "delegatedAttestation": "ParticipationAttestation | null (nested)"
  },
  "signature": {
    "algorithm": "string (ES256 or EdDSA)",
    "value": "string (base64url-encoded)",
    "keyId": "string (references kid in Resolver's JWKS)"
  },
  "issuedAt": "string (ISO 8601 timestamp)"
}
```

### Required fields

All fields are required except:
- `resolution.autoApproveRule` - only present when method is `auto-approved`
- `resolution.delegatedTo` - required when method is `delegated`
- `resolution.delegatedAttestation` - should be present when delegated, for chain verification

### Decision field rules

- For `select`: `selectedOption` must match one of the request's `options[].key`
- For `multiselect`: `selectedOptions` must be a non-empty array of valid keys
- For input types (`text`, `number`, `date`, `datetime`, `signature`): `value` must be present
- If the selected option had `freeText: true`: `value` contains what the user typed
- `timestamp` must be after the request's `createdAt` and before `expiry` (if set)

### Signature

The signature covers the entire attestation payload minus the `signature` field itself. `keyId` references a key in the Resolver's JWKS endpoint. Only ES256 and EdDSA are permitted.

### Resolution methods

| Method | Meaning | Required fields |
|--------|---------|-----------------|
| `direct` | Human responded on their device | `endpoint` |
| `auto-approved` | Matched a user-defined auto-approve rule | `endpoint`, `autoApproveRule` |
| `delegated` | Forwarded to another user | `endpoint`, `delegatedTo`, `delegatedAttestation` |

---

## RegistrationChallenge

Generated by the Requester to initiate registration. Deliberately minimal - the Resolver derives everything else from the Requester's published app-metadata.

```json
{
  "challengeId": "string (UUID v4)",
  "requesterAppId": "string (domain-based, e.g. 'pizza.example.com')",
  "expiresAt": "string (ISO 8601, short-lived - recommended 5 minutes)",
  "createdAt": "string (ISO 8601)"
}
```

All fields are required.

### Delivery

The challenge is encoded as a base64url JSON string and delivered via an `ohpp://` URI:

```
ohpp://register?challenge={base64url-encoded challenge JSON}
```

This URI must be presented as a tappable/clickable link. The user's OS routes it to their installed OHPP Client App. Additional delivery methods (QR code, NFC, copyable text) encode the same URI.

---

## RequesterAppMetadata

Published by every Requester at `https://{appId}/.well-known/ohpp/app-metadata`.

```json
{
  "appId": "string (must match the domain serving this file)",
  "name": "string (human-readable app name)",
  "icon": "string | null (URL to app icon)",
  "endpoints": {
    "registrationCallback": "string (relative path, e.g. '/ohpp/callback')",
    "resolutionCallback": "string | null (proposed, relative path, e.g. '/ohpp/resolution')"
  },
  "version": "string (protocol version supported)"
}
```

### Rules

- Must be served over HTTPS at exactly `/.well-known/ohpp/app-metadata`
- `appId` must match the serving domain (prevents hosting someone else's metadata)
- `registrationCallback` is a relative path - the Resolver constructs `https://{appId}{registrationCallback}`
- `resolutionCallback` (proposed for 1.1, optional) is a relative path the Resolver uses to notify the Requester the moment a request reaches a terminal state, so the Requester does not have to rely solely on polling. When absent, the Requester polls `participate_status` as today. See [Proposals: resolution webhook](05-proposals.md).
- Resolvers should cache with appropriate TTL (recommended 24 hours)

---

## RegistrationResponse

Sent by the Resolver to the Requester's registration callback.

```json
{
  "challengeId": "string (references the original challenge)",
  "resolverBaseUrl": "string (Resolver's base URL for discovery)",
  "userId": "string (opaque user identifier on this Resolver)",
  "accessToken": "string (opaque Bearer token for future requests)",
  "registrationId": "string (UUID v4)",
  "createdAt": "string (ISO 8601)"
}
```

All fields are required.

After receiving this, the Requester stores `resolverBaseUrl`, `userId`, and `accessToken` per user. If the Resolver returns 401 on a future request, the Requester must re-register.

---

## ResolutionNotification (proposed)

> Status: proposed for 1.1, optional. See [Proposals: resolution webhook](05-proposals.md). Not part of 1.0. Requesters and Resolvers that do not implement it fall back to polling `participate_status`, which remains the baseline mechanism.

Sent by the Resolver to the Requester's `resolutionCallback` (when the Requester published one) the moment a participation request reaches a terminal state. It is a lightweight signal - a doorbell that says "this request changed, go read it" - NOT the attestation itself.

```json
{
  "notificationId": "string (UUID v4, unique per delivery attempt group)",
  "registrationId": "string (the Requester's registration id on this Resolver)",
  "requestId": "string (the ParticipationRequest.id that changed)",
  "status": "string (one of: resolved, expired, cancelled)",
  "transactionId": "string | null (the request's transaction.id, if any)",
  "occurredAt": "string (ISO 8601, when the terminal transition happened)",
  "signature": {
    "algorithm": "string (ES256 or EdDSA)",
    "value": "string (base64url, over the payload minus this field)",
    "keyId": "string (references kid in the Resolver's JWKS)"
  }
}
```

### Rules

- The Resolver POSTs this to `https://{appId}{resolutionCallback}` for the owning Requester when a request it owns transitions to `resolved`, `expired`, or `cancelled`.
- The body carries NO decision, attestation, or personal data. On receipt the Requester fetches the outcome over its authenticated channel (`GET participate_status` / the attestation) and verifies the attestation signature against the JWKS, exactly as in the polling flow. The notification only removes the polling delay; it never becomes a source of truth.
- `signature` lets the Requester cheaply reject forged notifications before doing any work. It is verified against the Resolver's JWKS (the same keys used for attestations). A Resolver MAY instead use an HMAC established at registration; the field's `algorithm`/`keyId` identify which.
- Delivery is best-effort. The Resolver SHOULD retry with backoff and the Requester MUST NOT depend on it for correctness - polling remains the backstop. Handlers MUST be idempotent: the same `requestId` may be delivered more than once, and may arrive after the Requester already learned the outcome by polling.

---

## ServiceMetadata

Published by every Resolver at `/.well-known/ohpp/metadata`. This is one of the two fixed endpoints in the protocol.

```json
{
  "name": "string (service name)",
  "protocolVersion": {
    "min": "string (e.g. '1.0')",
    "max": "string (e.g. '1.3')"
  },
  "endpoints": {
    "participate": "string (URL for submitting requests)",
    "participate_status": "string (URL for polling/cancelling)",
    "keys": "string (URL to JWKS public keys)",
    "federation": "string | null (URL for forwarded requests, null if unsupported)"
  }
}
```

### Rules

- `/.well-known/ohpp/metadata` is fixed - all other URLs come from this document
- Requesters must perform discovery before any operation
- Requesters should cache with appropriate TTL
- `protocolVersion` defines the supported range - Requesters pick a version within it
- If the desired version falls outside the range: downgrade to max, or fail with a version mismatch error

---

## PublicKeySet (JWKS)

Served at the URL from `endpoints.keys`.

```json
{
  "keys": [
    {
      "kty": "string (EC or OKP)",
      "kid": "string (matches attestation signature.keyId)",
      "alg": "string (ES256 or EdDSA)",
      "use": "sig",
      "crv": "string (P-256 or Ed25519)",
      "x": "string (base64url)",
      "y": "string | null (base64url, EC only)"
    }
  ]
}
```

Follows RFC 7517 (JSON Web Key Set). Multiple keys supported for rotation. Old keys are retained during rotation for verifying existing attestations.

---

## Next

- [Ceremonies →](02-ceremonies.md)
- [Security →](03-security.md)
- [Versioning →](04-versioning.md)
