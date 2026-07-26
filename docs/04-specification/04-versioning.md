# Versioning

## Version format

Protocol versions follow MAJOR.MINOR format (e.g., `1.0`, `1.2`, `2.0`).

---

## What each part means

**MAJOR** (breaking): New ceremony steps, removed fields, changed semantics, altered security model. Existing clients cannot operate without code changes.

**MINOR** (compatible): New optional fields, new input types, new resolution methods. Existing clients continue to work - they just ignore what they don't recognise.

---

## How version negotiation works

### Resolver advertises its range

Every Resolver publishes a supported version range in `/.well-known/ohpp/metadata`:

```json
{
  "protocolVersion": {
    "min": "1.0",
    "max": "1.3"
  }
}
```

This Resolver supports versions 1.0 through 1.3.

### Requester picks a version

The Requester includes a `version` field in every ParticipationRequest. It must choose a version within the Resolver's advertised range.

If the Requester wants to use 1.2 features and the Resolver supports 1.0-1.3: use version 1.2.

If the Requester wants to use 2.0 features and the Resolver supports 1.0-1.3: the Requester must either fall back to 1.3, or fail with a clear error.

### Resolver validates

The Resolver checks the `version` field. If it falls outside the supported range, the request is rejected with an error indicating version mismatch.

---

## Forward compatibility rules

### Minor version differences

Both sides must ignore unknown fields. If a Requester sends a 1.2 request to a 1.0 Resolver, the 1.0 Resolver processes the fields it knows and ignores the rest. If a 1.0 Requester receives an attestation with fields from 1.2, it ignores what it doesn't recognise.

This means:
- New optional fields on ParticipationRequest are safe to add in minor versions
- New optional fields on ParticipationAttestation are safe to add in minor versions
- Older clients won't break, they just won't use the new fields

### Major version differences

No forward compatibility. A 1.x Resolver cannot process a 2.x request, and vice versa. Hard fail with a version mismatch error.

---

## What triggers a major version

- Removing a required field
- Changing the meaning of an existing field
- Adding a required field with no default
- Changing ceremony flow (new mandatory steps)
- Changing the signature scheme requirements
- Altering the discovery mechanism

---

## What fits in a minor version

- Adding a new optional field to any message
- Adding a new input type (e.g., `range`, `file`)
- Adding a new resolution method
- Adding a new endpoint to ServiceMetadata
- Extending validation options
- Adding new keyboard hints

---

## Client App type fallback

If a Client App receives a request with a `type` it doesn't recognise (e.g., a 1.0 Client App gets a request using a 1.2 type):

- It should fall back to `text` input
- It must not reject the request
- It should indicate to the user that the display may be simplified

This allows new types to be deployed without requiring all Client Apps to update simultaneously.

---

## Practical version strategy

For OHPP 1.0:
- All types defined in this spec (`select`, `multiselect`, `text`, `number`, `date`, `datetime`, `signature`) are part of 1.0
- Future minor versions (1.1, 1.2) will add new optional fields and types
- Major version 2.0 will only happen if the ceremony structure or security model needs breaking changes

---

## Next

- [Message Schemas →](01-message-schemas.md)
- [Ceremonies →](02-ceremonies.md)
- [Security →](03-security.md)
