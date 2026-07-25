# Identity is not participation

## What trust systems were designed to answer

Modern trust systems answer questions like:

- Who are you?
- Are you authorised?
- What are you allowed to do?

They were never designed to answer:

- Did a human understand this action?
- Did a human review the information?
- Did a human exercise judgement?
- Did a human consciously approve this outcome?
- Was meaningful participation present?

These are different questions. The first set is about **identity and access**. The second is about **involvement and agency**.

---

## The gap

Every authentication and authorisation system in existence operates on the same principle: verify identity, then grant access. Once access is granted, the system assumes the entity using that access is making informed decisions.

That assumption worked when humans were the only entities capable of navigating software. It breaks when agents can do the same thing.

Consider a real scenario: an AI agent logs into a company's expense system using an employee's credentials. It submits a $10,000 expense report, attaches AI-generated receipts, and approves it through the workflow (the employee has self-approval rights under that threshold). The system records: "Employee X submitted and approved expense report #4521 at 14:32 on Tuesday."

Every security check passed. The credentials were valid. The permissions were correct. The audit trail is complete. But the employee was asleep. They never saw the expense report. They never reviewed the receipts. They never made a decision.

The system cannot distinguish this from a legitimate approval because it was never designed to ask: "Is the human actually here, right now, for this specific action?"

This gap is structural, not accidental. The FIDO Alliance's own specifications confirm: passkeys require "user verification," but only at the moment of sign-in. After authentication, the session is open. Nothing in OAuth, SAML, or any modern auth protocol verifies ongoing human presence during the session. The gap between "proved identity at login" and "proved participation at decision time" is invisible in every audit log.

---

## Why adding agent identity doesn't solve it

Some propose giving agents their own identity - a "delegated identity" that shows the agent is acting on behalf of a human. This is better than nothing, but it doesn't solve the participation problem:

1. **It requires every application to implement a new identity model.** Every SaaS provider would need to understand and implement "acting on behalf of" relationships. That's not realistic at internet scale.

2. **It doesn't prove the human agreed to the specific action.** Delegation says "this agent can act for me." It doesn't say "I specifically approved *this* action."

3. **It moves the trust problem, it doesn't solve it.** Now you need to trust that the delegation was set up correctly, that the scope is appropriate, and that the agent isn't exceeding its bounds. You've just shifted the question from "did the human do it?" to "did the human properly configure the agent?"

4. **It's opt-in and fragmented.** Some apps might support agent identity. Others won't. There's no universal standard, and no guarantee of coverage.

---

## What's actually needed

Instead of reinventing identity for agents, what if systems could request human participation when it matters - and prove it happened?

Not replacing authentication. Not rebuilding authorisation. Adding a new layer on top:

> Given that agents can authenticate and act autonomously, how do specific actions get escalated back to a human for genuine participation?

This is the question the Human Participation Protocol answers.

---

## Next

- [The Participation Gap →](03-the-participation-gap.md)
- [Why This Matters →](04-why-this-matters.md)

---

## References

- FIDO Alliance, "FIDO Passkeys: Passwordless Authentication." [fidoalliance.org](https://fidoalliance.org/passkeys/)
- Microsoft, "Passkeys (FIDO2) authentication method in Microsoft Entra ID." [docs.microsoft.com](https://docs.microsoft.com/en-us/entra/identity/authentication/concept-authentication-passkeys-fido2)
