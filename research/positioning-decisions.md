# Positioning decisions

Raw reasoning behind HPP's position on common objections. These will be distilled into public-facing documentation later.

---

## 1. "Won't users just rubber-stamp approvals due to automation bias?"

**The concern**: If users get bombarded with participation requests, they'll tap "approve" without reading  - meaning the biometric proves presence but not genuine engagement.

**Our position**:

This is a UX responsibility, not a protocol failure. It's up to software providers to be intentional about when they do and don't ask for human participation. If a pizza app sends 30 separate participation requests for a single order, that's bad UX  - the same way requiring 30 taps to order a pizza today is bad UX. The best providers will design sleek, minimal participation flows. The market will reward good implementations the same way it rewards good UX today.

Also consider the practicality of this "problem." If a user is overwhelmed by the volume of requests, that itself is revealing  - it shows them exactly how much autonomy agents have been taking away. Each request represents a decision that would otherwise have been made without the human's knowledge. Visibility is a feature, not a bug.

Critically, the protocol does not mandate biometric confirmation for every request. The human is in charge of how requests are handled. A user might define a rule in their client app: "auto-approve any purchase requests from my local pizza place under $50." That's their choice. The protocol gives humans the power to decide  - however that decision is made, including deciding to delegate. And it keeps an audit trail of all decisions regardless, whether actively approved, auto-approved by rule, or delegated.

The spectrum is: full manual approval ↔ rule-based auto-approval ↔ full delegation. The human chooses where each type of request sits on that spectrum. That's the whole point.

---

## 2. "Google/Apple already build confirmation into their agents. Why an open protocol?"

**The concern**: Trillion-dollar companies already require user confirmation before consequential agent actions. Their proprietary approach might be "good enough."

**Our position**:

Those confirmations are built into the agents. That's the entire problem. The ownership of whether a decision requires human participation should not be decided by agents  - it should be decided by the platforms (software providers).

If my pizza place wants to prompt me and ask "do you want to add garlic bread for an extra $3?"  - that's the platform's choice. It makes me, the consumer, aware they're trying to upsell me, which may affect my future choice of provider. The relationship is between me and the platform, not me and whatever agent I happen to be using.

This protocol elevates the relationship between software providers and humans. It moves away from agents abstracting the internet away from us. When the agent decides what to confirm and what to just do  - the agent is in control of the human's experience. HPP puts that control back with the provider and the human.

Google's confirmation is Google deciding what's consequential. HPP is the pizza shop deciding what's consequential for their service, and the human deciding what they personally care about.

---

## 3. "A2A is adding SCA and multi-transaction approval. Will HPP be absorbed?"

**The concern**: Researchers are proposing human authentication extensions to agent-to-agent protocols. If A2A absorbs this natively, HPP may be redundant.

**Our position**:

A2A is an agent protocol. HPP is not an agent protocol. This is proof that a human participated  - not in the agent's workflow, but inside the provider's workflow.

A2A adding SCA means the agent pauses to confirm. HPP means the provider independently verifies human involvement through a channel the agent doesn't control. These are fundamentally different trust models:

- A2A SCA: "The agent asked the human and says they confirmed" (trust the agent's claim)
- HPP: "The provider independently received cryptographic proof from the human's device" (trust the attestation)

HPP works regardless of whether an agent is involved. A human using a browser directly could trigger an HPP request too. It's not about agents  - it's about human participation in any workflow.

---

## 4. "Federation tends toward centralisation (a few big Resolvers will dominate)"

**The concern**: ActivityPub research shows federated protocols concentrate around a few large instances. Won't the same happen with HPP Resolvers?

**Our position**:

It's a relatively simple protocol, and people could spin up Resolvers themselves if they want. This could easily be an open-source project that anyone deploys. But at the end of the day, it's up to the consumer to choose their provider  - no different to passkeys, email, or any other federated service.

If a few providers become dominant, that's market dynamics, not a protocol failure. Email is "dominated" by Gmail, Outlook, and a handful of others  - but it still works, anyone can still run their own mail server, and there's no lock-in. The protocol guarantees interoperability regardless of provider distribution.

The key is: switching providers doesn't break anything. If Resolver A becomes bad, I switch to Resolver B. All my apps still work because they speak the same protocol. That's the guarantee.

---

## 5. "HPP is positioned in the NHI/identity space and could be absorbed by that narrative"

**The concern**: The non-human identity market is massive and well-funded. HPP could be miscategorised as "identity adjacent" and lost in that conversation.

**Our position**:

To be clear  - we love agents. We want them used to their utmost potential. HPP is a way to help push agents forward, not hold them back.

Right now, people are trying to restrain agents by limiting their access or forcing controls. Where agents really thrive is when you let them run and take over. They SHOULD just use your credentials and do what they do best. This protocol encourages that end state, and adds human controls only where the provider or the human deems it necessary  - not by limiting agent access.

HPP is a win-win-win across all three parties:

1. **The human**  - gets ownership of any decisions they should be a part of. Gets visibility into what's happening on their behalf. Gets to choose their level of involvement.

2. **The software providers**  - get to take ownership back of their platforms, and gain a better relationship with their customers. Right now, they're losing that relationship as agents abstract them away from their users. With HPP, the provider has a direct channel to the human for moments that matter.

3. **The agent providers**  - get protection. If an agent orders 100 pizzas for someone autonomously, most people would blame the agent and never use that provider again. HPP gives that last check back to the human, which protects the agent provider's reputation. The agent can say "I tried, but the human confirmed it"  - or the human catches the mistake before it happens.

The framing is: NHI governance asks "which machine did this?" HPP asks "did a human approve it?" They're complementary layers, not competitors. HPP sits above identity entirely.

---

## Summary of positioning

HPP is not:
- An anti-agent protocol
- An identity protocol
- An agent communication protocol
- A replacement for existing auth

HPP is:
- A provider-to-human protocol
- A way for platforms to maintain direct relationships with users in an agent-mediated world
- A way for humans to stay in control without limiting agent capability
- A cryptographic proof layer that sits above identity and below application logic

---

*Captured July 2026. To be distilled into public docs/02-concepts/05-hard-questions.md during code generation.*
