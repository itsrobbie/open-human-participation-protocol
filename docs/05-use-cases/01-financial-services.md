# Financial services

## The problem in banking

Banks already send push notifications for transaction approval. What they don't have is a standardised, interoperable way to do it that works the same regardless of which bank, which app, or which agent is driving the session.

Today, each bank builds its own confirmation flow. If an AI agent manages your finances across three banks, you deal with three different notification systems, three different approval UIs, three different audit formats. None of them interoperate. None produce proofs that a third party can verify.

---

## Transfer approval

A user's AI agent initiates a bank transfer. The bank needs proof the human actually approved it.

**Request**:
```json
{
  "type": "select",
  "action": {
    "summary": "Approve transfer: $2,400 to James Morrison",
    "description": "**From**: Everyday Account (****4521)\n**To**: James Morrison (BSB 062-001, Acc ****8834)\n**Amount**: $2,400.00\n**Reference**: July rent",
    "category": "payments"
  },
  "options": [
    { "key": "approve", "label": "Approve transfer" },
    { "key": "deny", "label": "Deny" }
  ]
}
```

The human sees the full transfer details on their phone, authenticates with biometrics, and taps Approve. The bank gets a signed attestation proving a human approved this specific transfer.

---

## New payee registration

Adding a new payee is high-risk. Banks want to confirm the human intended it.

**Request (step 1 of transaction)**:
```json
{
  "type": "text",
  "action": {
    "summary": "Name this new payee",
    "description": "Account: BSB 062-001, Number ****8834",
    "category": "payees"
  },
  "placeholder": "Enter payee name",
  "validation": { "required": true, "max": 50 },
  "transaction": { "id": "txn-payee-abc", "label": "Add payee" }
}
```

**Request (step 2 of transaction)**:
```json
{
  "type": "select",
  "action": {
    "summary": "Set a daily transfer limit for James Morrison",
    "category": "payees"
  },
  "options": [
    { "key": "1000", "label": "$1,000" },
    { "key": "5000", "label": "$5,000" },
    { "key": "10000", "label": "$10,000" },
    { "key": "unlimited", "label": "No limit" }
  ],
  "transaction": { "id": "txn-payee-abc" }
}
```

The transaction groups both requests together in the Client App. The human sees them as part of one flow: "Add payee."

---

## Compliance evidence

Financial regulations (PSD2/SCA in Europe, MiFID II for investment decisions) require evidence that humans authorised certain actions. OHPP attestations serve as that evidence:

- Cryptographically signed (cannot be forged after the fact)
- Timestamped (prove when the decision was made)
- Independently verifiable (regulators can check without trusting the bank's own systems)
- Machine-readable (automated compliance checks can process them)

A bank's compliance team - or an external auditor - can verify any attestation against the Resolver's public keys without needing access to the bank's internal systems.

---

## Fraud detection signal

If an agent attempts a transfer and the user denies it via OHPP, that denial is a signal. The bank now knows:

- An agent tried to do something the human didn't want
- The human is actively monitoring (or their auto-rules caught it)
- This might be a compromised agent, a misconfigured rule, or an attack

Existing fraud systems can incorporate OHPP attestation data (approve/deny patterns, timing, delegation usage) into their models.

---

## Next

- [E-commerce →](02-ecommerce.md)
- [Healthcare →](03-healthcare.md)
