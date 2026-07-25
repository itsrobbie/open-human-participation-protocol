# The human participation problem

## The assumption that broke

For decades, digital trust has been built around one question: **Who performed this action?**

That question drove the development of passwords, multi-factor authentication, certificates, identity providers, passkeys, OAuth, OpenID Connect, FIDO2, WebAuthn, and Zero Trust architectures. These technologies work. They identify users, establish trust, and authorise access at global scale.

But a single assumption sits beneath every one of them:

> If a valid identity performed an action, a human must have been involved.

That assumption is becoming false.

---

## Agents are everywhere

AI agents now operate autonomously using legitimate human credentials. They can:

- Log in to applications
- Navigate interfaces
- Approve workflows
- Complete compliance training
- Acknowledge policies
- Sign transactions
- Consume information and generate responses

In every case, authentication succeeds. Authorisation succeeds. Audit logs succeed.

Yet the human may never have meaningfully participated.

This isn't theoretical. It's the present:

- **Google Gemini** can take over an Android device and perform multi-step tasks on the user's behalf (ordering food, booking rides, managing calendars), operating 24/7, even when the phone is off.
- **Anthropic's Claude** and **OpenAI's Operator** offer "computer use": vision-based GUI control that interacts with any software through a virtual mouse and keyboard, exactly as a human would.
- **Apple Intelligence** takes actions across apps using on-device models, with Siri operating as an autonomous agent within the Apple ecosystem.
- **Google's Gemini 3.5 Flash** (June 2026) introduced full desktop computer use. The model takes over your PC and performs actions on your behalf.

The numbers back this up. PwC reports 79% of US executives say their companies are already using AI agents (April 2025). Gartner forecasts 40% of enterprise applications will embed task-specific AI agents by end of 2026, up from fewer than 5% in 2025.

From the perspective of any application: the credentials are valid. The session is real. The actions are well-formed. The only difference is no human is actually there. The distinction between "a human did this" and "software did this using human credentials" has collapsed.

---

## Why existing solutions don't work

The most common approaches to this problem focus on identity:

- Give agents their own delegated identity
- Show external systems the agent is acting "on behalf of" the human
- Grant agents a subset of authorisations

This sounds reasonable, but it has multiple fatal problems:

**It doesn't scale.** Every SaaS provider would need to implement their own model for secondary identities, delegated auth, and "acting on behalf of" relationships. You can't expect every application in the world to implement different authentication types or identity models for agents. And you can't enforce it across the board.

**It costs money.** Identity platforms charge per identity. Okta Workforce Identity starts at $6–$17 per user per month. Microsoft Entra Suite runs $12 per user per month. Many platforms don't have the concept of machine identities at all. Meanwhile, non-human identities already outnumber human ones 45:1 in the average enterprise (Rubrik Zero Labs), rising to 144:1 in cloud-native environments (Entro Labs, H1 2025). Adding identity seats for every agent makes the economics prohibitive, and the burden falls on consumers to pay for what should be infrastructure.

**Device-level agents bypass it entirely.** The industry has moved to agents that operate your actual device. Google's Gemini on Android uses screen automation to complete tasks across apps. Apple Intelligence takes actions inside your apps using on-device models. Anthropic and OpenAI's computer-use agents drive any desktop application via screenshots and virtual inputs. None of them use separate credentials. They use YOUR browser, YOUR logged-in sessions, YOUR cookies and tokens. They literally control the device as you. Giving agents their own identity is irrelevant when the agent is clicking buttons in your already-authenticated browser. From the server's perspective, it IS you. There is no second identity to issue.

**It limits agents to a safe list.** Some platforms (like GitHub with API keys) offer a middle ground: the agent runs with a subset of the human's permissions. But the true power of agents comes from acting fully on a user's behalf - not being limited to a predefined safe list of actions. If you constrain an agent to only "safe" operations, you lose most of the value of autonomous agents.

**It requires every app to implement a new identity model.** Every SaaS provider would need to understand and implement "acting on behalf of" relationships. That's not realistic at internet scale.

**It doesn't prove the human agreed to the specific action.** Delegation says "this agent can act for me." It doesn't say "I specifically approved *this* action."

**It moves the trust problem, it doesn't solve it.** Now you need to trust that the delegation was set up correctly, that the scope is appropriate, and that the agent isn't exceeding its bounds. You've just shifted the question from "did the human do it?" to "did the human properly configure the agent?"

The industry is trying to solve an *identity* problem. But the real problem isn't identity.

---

## The real problem

The problem is **participation**.

Systems can prove who performed an action. They cannot prove a human was actually involved in it.

- A passkey proves a human was present at login (it requires a biometric gesture). But it proves nothing about what happens after. The FIDO Alliance spec confirms: passkeys require user verification at the moment of sign-in. "Every sign-in attempt requires that you're present to unlock the passkey." But presence is verified only at authentication time, not at the decision point three hours later. An agent can use the session that the passkey unlocked to perform any action without the human seeing it.
- OAuth proves delegation
- Certificates prove trust relationships
- Authentication proves identity

**None prove participation in a specific decision.**

Passkeys are the closest the industry has come - they prove human presence at a single moment. But that moment is login, not the decision point. A human unlocking a session at 9am doesn't prove they approved a $50,000 transfer at 3pm. The agent used the session. The passkey can't help.

An autonomous agent can satisfy every existing identity requirement while removing the human entirely from the decision-making process.

---

## What "participation" means

Participation isn't just "was a human present." It covers a spectrum:

- **Presence** - Was a human there at all?
- **Attention** - Was attention directed toward relevant information?
- **Engagement** - Did meaningful interaction occur?
- **Understanding** - Was information processed, not just displayed?
- **Intent** - Did the human intentionally proceed?
- **Approval** - Was a conscious decision made?

Reliable verification of human participation becomes the basis for a new layer of digital trust.

---

## A new scarcity

Technology has always reduced the cost of labour while increasing the value of what humans uniquely contribute. The Industrial Revolution automated physical effort. The Information Age automated information processing.

The Agentic Age is different. It automates participation itself. The tasks that previously required a human to look, read, decide, and act are now handled by software. What becomes scarce is the thing we've always taken for granted: **a human actually being involved.**

---

## Next

- [Identity Is Not Participation →](02-identity-is-not-participation.md)
- [The Participation Gap →](03-the-participation-gap.md)
- [Why This Matters →](04-why-this-matters.md)

---

## References

- PwC, "AI Agent Adoption Survey," April 2025. [aboutchromebooks.com](https://www.aboutchromebooks.com/ai-agent-adoption-statistics/)
- Gartner, "AI Agents Statistics 2026: Market Size, Adoption, and the Deployment Gap." [axis-intelligence.com](https://axis-intelligence.com/ai-agents-statistics/)
- Google, "Use Gemini Agent for multi-step tasks in Gemini Apps." [support.google.com](https://support.google.com/gemini/answer/16596215)
- Google, "Gemini Spark – Your 24/7 personal AI agent for productivity." [gemini.google](https://gemini.google/overview/agent/spark/)
- Google, "Computer Use tool," Gemini API documentation, July 2026. [ai.google.dev](https://ai.google.dev/gemini-api/docs/computer-use)
- WorkOS, "Anthropic's Computer Use versus OpenAI's Computer Using Agent (CUA)," July 2025. [workos.com](https://workos.com/blog/anthropics-computer-use-versus-openais-computer-using-agent-cua)
- Digital Applied, "Computer Use Agents 2026: Claude vs OpenAI vs Gemini." [digitalapplied.com](https://www.digitalapplied.com/blog/computer-use-agents-2026-claude-openai-gemini-matrix)
- Apple, "Introducing Apple Intelligence for iPhone, iPad, and Mac," June 2024. [apple.com](https://www.apple.com/newsroom/2024/06/introducing-apple-intelligence-for-iphone-ipad-and-mac/)
- FIDO Alliance, "FIDO Passkeys: Passwordless Authentication." [fidoalliance.org](https://fidoalliance.org/passkeys/)
- Microsoft, "Passkeys (FIDO2) authentication method in Microsoft Entra ID." [docs.microsoft.com](https://docs.microsoft.com/en-us/entra/identity/authentication/concept-authentication-passkeys-fido2)
- Ciphers Security, "Okta Pricing Breakdown 2026." [cipherssecurity.com](https://cipherssecurity.com/okta-pricing-breakdown-2026-plans-cost/)
- Microsoft, "Microsoft Entra Plans and Pricing." [azure.microsoft.com](https://azure.microsoft.com/en-us/pricing/details/multi-factor-authentication/)
- Rubrik Zero Labs, NHI-to-human identity ratio research, via The Hacker News, 2026. [thehackernews.com](https://thehackernews.com/expert-insights/2026/05/the-non-human-identity-crisis-why-your.html)
- IJRASET, "The Non-Human Identity Governance Crisis in Cloud Environments," 2025. [ijraset.com](https://www.ijraset.com/research-paper/the-non-human-identity-governance-crisis-in-cloud-environments)
