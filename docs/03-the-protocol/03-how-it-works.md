# How it works

## Registration (one-time setup)

Before a Requester can request participation from a user, they must be linked. This happens once per user-app pair.

```
1. Requester generates a challenge
   (just: appId + challengeId + expiry)

2. Challenge is presented as an ohpp:// link
   ohpp://register?challenge={base64url-encoded challenge JSON}
   (Also available as QR code for scanning from another device)

3. Client App receives the challenge
   (User taps the link, agent triggers it, or user scans the QR code)

4. Client App sends challenge to its Resolver

5. Resolver fetches Requester's metadata
   GET https://{appId}/.well-known/ohpp/app-metadata
   (Verifies domain ownership over TLS - anti-spoofing)

6. Resolver calls back to Requester
   POST https://{appId}{callbackPath}
   (Returns: resolverBaseUrl, userId, accessToken)

7. Requester stores credentials
   (resolverBaseUrl, userId, accessToken - ready for requests)
```

After this, the Requester can send participation requests for that user.

---

## Agent-driven registration

Realistically, most people won't visit each of their apps one by one and manually sign up for OHPP. The more likely path: you tell your agent "sign me up for OHPP across all my apps" and it handles the legwork.

This is a first-class use case. Here's how it works:

```
1. User tells agent: "Register me for OHPP on all my accounts"

2. Agent navigates to each app's OHPP settings page
   (Same way it navigates any web page - using your credentials)

3. App generates a RegistrationChallenge and presents it as an ohpp:// link
   ohpp://register?challenge=eyJjaGFsbGVuZ2VJZCI6IjU1MGU4NDAwLi4uIn0
   (Also shows a QR code, but the agent ignores that)

4. Agent reads the ohpp:// link from the page DOM

5. Agent triggers the link
   The OS routes ohpp:// to the user's installed OHPP Client App

6. Client App receives the challenge
   Shows: "Pizza Palace wants to register for OHPP. Allow?"

7. User confirms on their device
   (This is the one human moment - the agent can't do this part)

8. Normal ceremony completes
   Client App → Resolver → callback to app → done
```

The agent does the boring part (navigating to 15 different apps, finding the OHPP registration page, triggering the link). The human does the meaningful part (confirming "yes, link this app" on their phone). One tap per app. No hunting through settings menus.

**What Requesters must do**: When presenting a registration challenge, always include an `ohpp://` link on the page. The link contains the full base64url-encoded challenge payload. QR codes are a visual convenience for cross-device registration — the `ohpp://` link is the machine-readable path that agents (and accessibility tools) depend on.

**What this looks like for "your mum"**: She tells her agent "set up OHPP for me." Her phone buzzes a few times over the next minute. Each buzz says "[App name] wants to connect. Allow?" She taps Allow on each one. Done. She didn't need to know what a Resolver is, what a challenge payload looks like, or where the settings page lives.

---

## Participation (the core flow)

When an application reaches a decision point that requires human involvement:

```
1. Requester sends ParticipationRequest
   POST {resolver's participate endpoint}
   Header: Authorization: Bearer {accessToken}
   Body: { type, action, options, validation.userId, ... }

2. Resolver validates
   - Token valid?
   - Token matches validation.userId?
   - Schema valid?
   - Not expired?

3. Resolver routes to user's device(s)
   (Push notification, WebSocket - provider's choice)

4. Client App presents to human
   - Shows: app name, summary, description, options
   - Requires biometric/PIN before responding

5. Human participates
   - Selects an option (or provides input)

6. Client App signs attestation
   - Signs with private key in secure enclave
   - Includes: decision, timestamp, endpoint info, resolution method

7. Attestation flows back
   Attester → Resolver → Requester

8. Requester verifies and proceeds
   - Checks signature against Resolver's public keys (JWKS)
   - Reads the decision
   - Acts accordingly
```

---

## Verification (any time later)

Anyone holding an attestation can verify it independently:

```
1. Obtain the attestation
   (From the Requester's records, an audit trail, a compliance report)

2. Get the Resolver's public keys
   GET {resolverBaseUrl}/.well-known/ohpp/metadata → endpoints.keys

3. Find the matching key
   Match attestation.signature.keyId to keys[].kid

4. Verify the signature
   Run the cryptographic check (ES256 or EdDSA)

5. Result
   Valid → a device holding that private key signed this attestation
   Invalid → tampered or forged
```

No service needs to be online. No API calls needed beyond fetching the public keys (which can be cached). The proof is self-contained.

---

## Federation (cross-provider delegation)

When a user delegates to someone on a different provider:

```
1. Requester → Resolver A (user's provider)
   "I need participation from this user"

2. Resolver A checks delegation rules
   "This user delegates pizza orders to their spouse on Provider B"

3. Resolver A → Resolver B (spouse's provider)
   Forwards the request using the same protocol interface

4. Resolver B routes to spouse's device
   Standard participation flow

5. Spouse participates

6. Attestation flows back: Resolver B → Resolver A → Requester
   Wrapped with delegation metadata showing the full chain
```

The Requester sees: delegation method, who it was delegated to, and the delegate's signed decision. Full transparency. Both attestations (inner from the delegate's Resolver, outer from the user's Resolver) are independently verifiable.

---

## What the Requester stores (per user)

After registration, the Requester stores three values per user:

| Value | What it is | Used for |
|-------|-----------|----------|
| `resolverBaseUrl` | The user's Resolver URL | Discovering endpoints |
| `userId` | Opaque user identifier on the Resolver | Cross-checking in requests |
| `accessToken` | Bearer token issued during registration | Authenticating requests |

That's it. Three values. The Requester doesn't store device info, provider details, or anything about the user's client app.

---

## Next

- [Analogies →](04-analogies.md)
- [Specification →](../04-specification/)
