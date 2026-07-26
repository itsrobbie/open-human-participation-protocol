# Analogies

These comparisons explain OHPP by mapping it to systems people already understand.

---

## The email analogy

OHPP's architecture mirrors email at every level.

| Email | OHPP |
|-------|-----|
| Email address (you@gmail.com) | userId on your Resolver |
| Your mail server (Gmail) | Your Resolver (Participation Service) |
| Your email client (Gmail app) | Your Attester (Client App on phone) |
| Someone sending you an email | A Requester sending a participation request |
| SMTP protocol | OHPP protocol |
| You reading and replying | You reviewing and approving |

**Key parallels:**
- You choose your provider (Gmail, Outlook, self-hosted) - same with OHPP
- Any sender can reach you regardless of provider - same with OHPP
- You can switch providers without telling every sender - same with OHPP
- You can use any email client with any mail server - same with OHPP
- A provider can build both server and client (Gmail does) - same with OHPP

**The Gmail example:**
- Google builds both Gmail's mail server AND the Gmail app
- But you can use the Gmail app with a non-Google mail server
- And you can use a third-party app (Spark, Outlook) with Gmail's server

Same model for OHPP. A company might build both the Participation Service and the Client App. But a user could use any compatible client with any compatible service, and any app can send requests to any service.

---

## The Google Authenticator analogy

The registration ceremony is like setting up a 2FA app.

| Google Authenticator | OHPP Registration |
|---------------------|------------------|
| Go to app's security settings | Go to app's OHPP settings |
| App shows a QR code | App presents an `ohpp://` link (and optionally a QR code) |
| Scan with Authenticator | Tap the link — OHPP Client App opens |
| Linked - codes now generate | Linked - participation requests now route |

The difference: Authenticator generates time-based codes. OHPP delivers rich requests with descriptions and options, and returns cryptographically signed attestations with full resolution metadata.

---

## The permission slip analogy

Think of a school permission slip - but digital, instant, and cryptographically signed.

| Permission Slip | OHPP |
|----------------|-----|
| School sends slip home | App sends participation request to phone |
| Parent reads what the trip involves | Human reads the action summary and description |
| Parent signs and returns | Human authenticates and selects an option |
| School has proof of parental consent | App has a signed attestation of human participation |
| Years later, inspectors can verify the signature | Years later, auditors can verify the attestation |

The key difference: you can forge a paper signature. You can't forge a cryptographic attestation.

---

## The banking push notification (but standardised)

Banks already do something similar, and it's the closest existing pattern to OHPP:

1. You make a large transfer online
2. Your phone buzzes: "Approve $5,000 to John Smith?"
3. You tap Approve with biometrics
4. The transfer proceeds

This is formalised as **3D Secure 2.x** in the payments industry: a protocol that adds real-time identity verification between cardholder, issuing bank, and merchant. It transmits up to 150 data points and frictionlessly approves 80–85% of transactions, challenging only higher-risk payments with biometric verification or one-time codes. The EU and UK mandate it via Strong Customer Authentication (SCA) rules. It works.

OHPP is this idea, but generalised as an open, interoperable standard for *any* application, *any* decision, not just payments. Every bank does this differently today. 3D Secure only covers card transactions. With OHPP, the same protocol works for pizza orders, contract signatures, home alarm systems, expense approvals, and anything else that matters. Any client app works. The proof is standardised and independently verifiable.

---

## The delegation example

A user is on ProviderA for OHPP. Their spouse uses ProviderB.

The user sets a rule on their Resolver: "Delegate pizza orders to my spouse."

```
1. Pizza app sends request to ProviderA (user's Resolver)
   "Choose your pizza size: Small / Medium / Large"

2. ProviderA checks the user's rules
   Rule matches: "pizza orders → delegate to spouse on ProviderB"

3. ProviderA forwards to ProviderB (spouse's Resolver)
   Same protocol interface — Resolver-to-Resolver uses the federation endpoint

4. ProviderB routes to spouse's device
   Standard participation flow — spouse's phone buzzes

5. Spouse picks "Medium" on their phone

6. Attestation flows back: ProviderB → ProviderA → Pizza app
   ProviderA wraps the response with delegation metadata
```

The pizza app receives an attestation that says:
- **method**: `delegated`
- **delegatedTo**: the spouse's userId on ProviderB
- **inner attestation**: the spouse's signed response (independently verifiable against ProviderB's public keys)

The pizza app knows the request was delegated. It knows the delegate's decision. It can verify both the outer attestation (signed by ProviderA) and the inner attestation (signed by ProviderB). Full transparency, full verifiability.

This works because Resolver-to-Resolver communication uses the same standardised interface as Requester-to-Resolver. Federation is free — it falls out naturally from the interop design. No additional protocol machinery needed.

---

## Next

- [Specification →](../04-specification/)

---

## References

- Stripe, "How does 3D Secure authentication work?" [stripe.com](https://stripe.com/us/resources/more/3d-secure-101)
- PCI Proxy, "The Complete Guide to 3D Secure Authentication." [pci-proxy.com](https://www.pci-proxy.com/blog-posts/blog-3d-secure-authentication-guide)
- Glenbrook, "Two Decades of 3-D Secure: Can Strong Customer Authentication Succeed in the US?", 2024. [glenbrook.com](https://glenbrook.com/payments_on_fire/episode-249-3-d-secure-strong-customer-authentication-stripe-entersekt/)
