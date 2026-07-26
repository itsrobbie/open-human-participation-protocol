# FAQ

## General

### What is OHPP?

An open protocol that lets any application request human participation, route that request to the human's device, collect their decision, and return a cryptographically signed proof that the human was involved.

### How is this different from 2FA/MFA?

2FA proves identity at login. OHPP proves participation at decision points. 2FA happens once at session start. OHPP happens whenever an application decides human involvement is needed - during a transaction, before a deployment, when an agent wants to spend money.

Also: 2FA typically uses the same channel (SMS, email, authenticator app generating codes). OHPP uses a separate physical device with biometric verification, producing a signed attestation rather than a one-time code.

### Can't agents just bypass this?

No. The attestation is produced by the user's phone (private key in secure enclave) and requires biometric or PIN verification. An agent has no access to the physical device, no access to the biometric sensor, and no access to the private key. It's the same reason an agent can't unlock your phone.

### What if I don't have a phone?

The protocol defines the Attester role abstractly. Phone apps are the expected primary implementation, but a desktop app, hardware token, or any device with secure key storage and user verification could serve as an Attester.

### Is this open source?

Yes. The protocol specification is open. The reference implementation (Resolver, SDKs, demo) is open source. Anyone can build a Resolver, build a Client App, or integrate as a Requester.

---

## For developers

### How much work is it to integrate?

Five things:
1. Serve a static JSON file at `/.well-known/ohpp/app-metadata` (5 minutes)
2. Generate registration challenges and show an `ohpp://` link (a few hours)
3. Accept registration callbacks and store credentials (a few hours)
4. Send participation requests at the right moments (depends on your app)
5. Verify attestation signatures (one function call with the SDK)

With an SDK, steps 2-5 are mostly handled for you.

### Do I need to change my auth system?

No. OHPP sits alongside your existing auth. It doesn't replace login, sessions, or permissions. It adds a participation layer on top. A user is still authenticated normally. OHPP requests go to that user's registered Resolver.

### What happens if the Resolver is down?

Your app decides. Options:
- Block the action until participation is confirmed (safest)
- Allow the action after a timeout (if the action is low-risk)
- Queue the request and retry

The protocol doesn't mandate a specific failure mode. Your business logic determines what's appropriate.

### Do I need to run my own Resolver?

No. Your users choose their participation provider. You (the Requester) just talk to whatever Resolver they registered with. Just like you don't need to run a mail server to send emails.

### What about testing?

Use the `.test` TLD for appIds in development: `pizza.test`, `bank.test`. The demo simulation provides a local Resolver you can test against without any external dependencies.

---

## For users

### Do I have to approve every single thing?

No. You control when participation is required through:
1. **App choice**: platforms decide which actions need participation (you pick platforms that get it right)
2. **Auto-approve rules**: set rules like "auto-approve purchases under $20 from this app"
3. **Delegation**: delegate certain categories to family members or colleagues

If a platform sends too many requests, that's bad UX (just like an app that sends too many push notifications). You can revoke their registration.

### Can I switch providers?

Yes. Switch participation providers the same way you'd switch email providers. Your apps don't need to change anything - they discover your new Resolver during re-registration.

### What data does the Resolver see?

The Resolver sees the participation requests routed through it (the action summary, options, etc.). It does not see your activity on the Requester's platform beyond what's in the participation request itself.

Choose a provider you trust, the same way you'd choose an email provider. Self-hosting is an option if you want full control.

### What if I lose my phone?

Same as losing a phone with any authenticator app:
1. Use your Resolver provider's account recovery process
2. Register a new device
3. Existing registrations with apps continue to work (they talk to your Resolver, not your device directly)

Your Resolver is the stable anchor. Devices are registered with the Resolver and can be added or removed.

---

## Protocol design

### Why not just use OAuth/OIDC for this?

OAuth proves who you are. OHPP proves you participated. They answer different questions. OAuth can confirm "this token belongs to user X." It cannot confirm "user X was physically present and consciously approved this specific action at this specific time."

### Why a separate device?

Because the agent controls the primary device (browser, desktop). A separate physical device (phone) with biometric lock is outside the agent's reach. If the participation check lived in the same environment as the agent, the agent could interact with it.

### Why not blockchain/Web3?

OHPP is transport-agnostic and doesn't prescribe storage. Attestations could be stored on-chain if someone wanted to. But the protocol itself doesn't need distributed consensus - it needs cryptographic signatures, which are simpler, faster, and cheaper.

### How does this relate to W3C Verifiable Credentials?

Similar cryptographic foundation (signed claims, public key verification). Different purpose. VCs prove attributes about a subject ("this person has a degree"). OHPP attestations prove a participation event ("this person approved this action at this time"). OHPP is narrower in scope and optimised for real-time decision flows.

### What about proof-of-personhood (Worldcoin, BrightID)?

Proof-of-personhood proves "this entity is a unique human" (once, globally). OHPP proves "a human participated in this specific decision" (repeatedly, per action). Different layers. A proof-of-personhood system could be one signal a Resolver uses internally to verify its users, but OHPP doesn't require or depend on it.

### Why domain-based appIds?

Domains are globally unique, verifiable via TLS, and don't require a central registry. The Resolver verifies a Requester's identity by fetching their app-metadata from the claimed domain over HTTPS. If you control the DNS and TLS for `pizza.example.com`, you control that appId. No registration authority needed.

---

## Comparison with existing systems

### vs 3D Secure (card payments)

3D Secure is the closest existing analogue. It inserts a bank verification step during card payments. OHPP generalises this pattern: any app, any action, any provider. 3D Secure only works for card transactions, only through payment networks, and only with the issuing bank as the verifier.

### vs Apple/Google confirmation prompts

When Google or Apple show "Allow this app to..." prompts, those are proprietary, platform-specific, and only work within their ecosystem. OHPP is open, interoperable, and works across any platform, any device manufacturer, any operating system.

### vs Email-based approval links

Email approval ("click here to confirm") is phishable, not time-bound (the link sits in your inbox), and doesn't produce cryptographic proof. OHPP requests go to a dedicated app, require biometric verification, expire, and produce signed attestations.

---

## Next

- [Quick start →](01-quick-start.md)
- [Integrate as a Requester →](02-integrate-requester.md)
