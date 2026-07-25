# Background research: Human Participation Protocol

This document collects sourced research backing the core claims of the Human Participation Protocol (HPP). It covers AI agent adoption, the identity-participation gap, regulatory drivers, cryptographic precedents, analogous architectures, and market signals.

---

## 1. The rise of autonomous AI agents

### Adoption statistics

- **Gartner (2025–2026)**: Forecasts that 40% of enterprise applications will embed task-specific AI agents by end of 2026, up from fewer than 5% in 2025. AI agent software spending forecast to hit $206.5 billion in 2026, a 139% YoY increase. ([source](https://axis-intelligence.com/ai-agents-statistics/))
- **PwC (April 2025)**: 79% of US executives report their companies are using AI agents in some form. ([source](https://www.aboutchromebooks.com/ai-agent-adoption-statistics/))
- **McKinsey State of AI 2025**: 23% of organisations actively scaling agentic AI in at least one business function; another 39% experimenting. 88% of organisations now use AI in at least one function, up from 78% in 2024. ([source](https://www.forbes.com/sites/josipamajic/2026/03/22/10-of-enterprise-functions-use-ai-agents-mckinsey-finds/))
- **Gartner (May 2026)**: Predicts by 2027, 40% of enterprises will demote or decommission autonomous AI agents due to governance gaps identified only after production incidents. ([source](https://www.gartner.com/en/newsroom/press-releases/2026-05-26-gartner-says-applying-uniform-governance-across-ai-agents-will-lead-to-enterprise-ai-agent-failure))

### Computer-use agents (devices acting as humans)

- **Anthropic Computer Use (October 2024)**: Coined the term "computer use" for vision-based GUI control. Claude can see screens via screenshots and interact with any software through virtual mouse and keyboard, without requiring APIs or integrations. ([source](https://workos.com/blog/anthropics-computer-use-versus-openais-computer-using-agent-cua))
- **OpenAI Operator / Computer Using Agent (January 2025)**: OpenAI's CUA navigates web applications through the browser. By April 2026 expanded to "Background Computer Use" for desktop. ([source](https://www.digitalapplied.com/blog/computer-use-agents-2026-claude-openai-gemini-matrix))
- **Google Gemini Computer Use (June 2026)**: Gemini 3.5 Flash allows the model to take over a device and perform actions on the user's behalf. Grew out of Project Mariner browser automation. ([source](https://ai.google.dev/gemini-api/docs/computer-use))
- **Google Gemini Agent on Android**: Can orchestrate multi-step tasks on user's behalf across apps including managing calendar events, ordering food, booking rides using screen automation. Operates 24/7 in background, even when phone is off. ([source](https://support.google.com/gemini/answer/16596215), [source](https://gemini.google/overview/agent/spark/))
- **Apple Intelligence (2024–2026)**: Siri can take action in apps, with on-device foundational models. Developers can access on-device LLM to build intelligent features. Actions include in-app operations across the Apple ecosystem. ([source](https://www.apple.com/newsroom/2024/06/introducing-apple-intelligence-for-iphone-ipad-and-mac/))

**What this means for HPP**: These agents use the human's existing authenticated sessions. From the server's perspective, the agent IS the user. There is no separate identity to issue. The agent controls the same browser, same cookies, same device.

---

## 2. The identity-participation gap

### Passkeys and FIDO2 limitations

- **FIDO Alliance / FIDO2 spec**: Passkeys require user verification (biometric or PIN) at the moment of sign-in. This proves human presence at authentication time, but says nothing about what happens during the session afterwards. ([source](https://fidoalliance.org/passkeys/))
- **Microsoft Entra FIDO2**: "Every sign-in attempt requires that you're present to unlock the passkey on the device that you use for sign in." But presence is only verified at login, not per-action. ([source](https://docs.microsoft.com/en-us/entra/identity/authentication/concept-authentication-passkeys-fido2))
- **USENIX Security 2024 (Lassak et al.)**: "Why Aren't We Using Passkeys?"  - 28 interviews with CISOs revealing deployment barriers. The paper confirms passkeys solve authentication but does not address post-login participation. ([source](https://www.usenix.org/system/files/sec24summer-prepub-618-lassak.pdf))

**What this means for HPP**: Passkeys prove "a human was here at login." They do not prove "a human approved this specific action 3 hours later." The session the passkey unlocked can be used by an agent indefinitely.

### The non-human identity explosion

- **Rubrik Zero Labs**: NHI-to-human identity ratio is 45:1 in the modern enterprise. ([source](https://thehackernews.com/expert-insights/2026/05/the-non-human-identity-crisis-why-your.html))
- **Entro Labs H1 2025**: In cloud-native/DevOps environments the ratio is 144:1, growing at 56% annually. ([source](https://www.ijraset.com/research-paper/the-non-human-identity-governance-crisis-in-cloud-environments))
- **OWASP Top 10 NHI Risks (2025)**: First mainstream framework to acknowledge machine identities as the primary attack surface. ([source](https://cloudsecurityalliance.org/blog/2026/04/23/we-are-fixing-the-wrong-problem-in-non-human-identity-security))
- **SpyCloud 2026 Identity Exposure Report**: 18.1 million exposed API keys and tokens recaptured in 2025, spanning payment platforms, cloud infrastructure, AI services. ([source](https://www.prnewswire.com/news-releases/spyclouds-2026-identity-exposure-report-reveals-explosion-of-non-human-identity-theft-302717811.html))
- **NHI Market**: Hit $11.3 billion in 2025, projected $38.8 billion by 2036. Two-thirds of enterprises have suffered a breach involving a compromised NHI. ([source](https://axis-intelligence.com/non-human-identity-statistics/))

**What this means for HPP**: The industry is drowning in machine identities but still can't answer "was a human involved in this decision?" More identities don't equal more human oversight.

---

## 3. Regulatory and governance drivers

### EU AI Act  - human oversight (Article 14)

- **Article 14(1)**: "High-risk AI systems shall be designed and developed in such a way, including with appropriate human-machine interface tools, that they can be effectively overseen by natural persons during the period in which they are in use." ([source](https://www.activemind.legal/legislation/ai-act/article-14/))
- **Article 14(2)**: The aim of human oversight is to "prevent or minimise the risks to health, safety or fundamental rights" that may emerge from high-risk AI use. ([source](https://www.euaiact.com/key-issue/4))
- **Article 14(3)**: Oversight measures must be "commensurate with the risks, level of autonomy and context of use." ([source](https://rgpd.com/ai-act/chapter-3-high-risk-ai-systems/article-14-human-oversight/))
- **Article 26**: Deployers must "assign human oversight to natural persons who have the necessary competence, training and authority." ([source](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-26))
- **EU Futurium (2025)**: "Article 14 obliges deployers to enable effective oversight while the system is in use. For agents, that obligation only bites at the granularity of the action." This argues oversight must be per-action, not per-model. ([source](https://futurium.ec.europa.eu/it/apply-ai-alliance/community-content/article-14-runtime-why-oversight-agentic-ai-has-be-evidenced-action-not-model))

### US Executive Order on AI (October 2023)

- **EO 14110  - "Safe, Secure, and Trustworthy Development and Use of AI"**: Signed October 30, 2023. Establishes society-wide approach to AI governance, emphasising safety, security, and trustworthiness. References human oversight as a guiding principle. ([source](https://www.federalregister.gov/documents/2023/11/01/2023-24283/safe-secure-andtrustworthy-development-and-use-of-artificial-intelligence))
- **Brookings analysis**: The EO and accompanying OMB memo "introduce accountability for artificial intelligence" including "the right to human oversight" as one of five key principles. ([source](https://www.brookings.edu/articles/how-the-ai-executive-order-and-omb-memo-introduce-accountability-for-artificial-intelligence/))

### NIST AI Risk Management Framework

- **NIST AI RMF 1.0**: Structured around Govern, Map, Measure, Manage. Human oversight is a "recurring property rather than a one-time check." ([source](https://www.metacto.com/blogs/human-oversight-of-ai-agents-production))
- **NIST AI RMF Playbook**: Asks whether organisations have "defined roles, responsibilities, and oversight processes that ensure a human remains accountable for every AI-assisted output." ([source](https://stell-engineering.com/blog/nist-ai-risk-management-framework-playbook))

### Financial services

- **MiFID II (EU)**: Requires suitability assessments for investment advice and portfolio management. Firms must make "suitable investment decisions on behalf of their clients," implying human judgement in recommendations. Algorithmic trading requires governance frameworks, testing controls, and risk measurement (RTS 6). ([source](https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mifid-ii/article-17-algorithmic-trading))
- **ESMA/EBA (February 2026)**: Joint consultation on revised suitability assessment requirements for banks and investment firms, updating for the AI era. ([source](https://www.mfsa.mt/wp-content/uploads/2026/03/Circular-on-Markets-in-Financial-Instruments-Directive-MiFID-II-and-Markets-in-Financial-Instruments-Regulation-MiFIR.pdf))

**What this means for HPP**: Regulators are mandating human oversight, but no protocol exists to prove it happened. HPP provides cryptographic evidence of human participation at the decision point.

---

## 4. The cost and scaling problem of agent identity

### Identity platform pricing

- **Okta Workforce Identity (2026)**: Starts at $6/user/month (Starter) to $17/user/month (Essentials), with $1,500 minimum annual contract. Each identity is a paid seat. ([source](https://cipherssecurity.com/okta-pricing-breakdown-2026-plans-cost/))
- **Microsoft Entra Suite**: $12/user/month. Effectively free for orgs already on M365 E3/E5 as identity is bundled. ([source](https://azure.microsoft.com/en-us/pricing/details/multi-factor-authentication/))
- **General market**: Workforce IAM tools run $1.80–$9/user/month for SSO + MFA; CIAM bills per monthly active user. ([source](https://hideez.com/blogs/news/identity-service-pricing-comparison))

**What this means for HPP**: If every agent needs its own identity seat, costs multiply dramatically. With NHI ratios of 45:1 to 144:1, the economics are prohibitive. HPP doesn't require new identities; it verifies participation through a separate channel.

### Agent identity in emerging protocols

- **Google A2A (Agent-to-Agent)**: Announced April 2025, now 150+ organisations, donated to Linux Foundation. Provides discovery, authentication, and task delegation between agents. But an arxiv paper found "critical limitations when handling sensitive information" and proposed enhancements including customer authentication (SCA) and multi-transaction approval. ([source](https://arxiv.org/abs/2505.12490), [source](https://eco.com/support/en/articles/14845481-a2a-agent-to-agent-protocol-explained))
- **Anthropic MCP (Model Context Protocol)**: Introduced late 2024 as open protocol for AI agents to communicate with servers. Has no native identity or authorization layer. "A server receiving an MCP request cannot determine which agent sent it, who authorized the call, or what permissions the caller holds." A scan of ~2,000 MCP servers found all lacked authentication. ([source](https://arxiv.org/abs/2603.24775), [source](https://www.vouched.id/learn/blog/model-context-protocol-mcp-i-security-guide))
- **Cloud Security Alliance (2026)**: "Agentic AI, MCP, and the Identity Explosion"  - identifies the challenge of AI agents interfacing with external systems at scale without proper identity governance. ([source](https://cloudsecurityalliance.org/articles/agentic-ai-mcp-and-the-identity-explosion-you-can-t-ignore))

**What this means for HPP**: Even the latest agent protocols (A2A, MCP) don't solve human participation. They handle agent-to-agent communication and tool access, but cannot verify a human was involved in a specific decision. HPP operates at a different layer.

---

## 5. Cryptographic attestation and verifiable proofs

### W3C Verifiable Credentials

- **Verifiable Credentials Data Model v2.0**: Published as W3C Recommendation (May 2025). Provides a mechanism to express digital credentials that are "cryptographically secure, privacy respecting, and machine-verifiable." Seven specifications published simultaneously covering data integrity, JSON Web Token proofs, and status lists. ([source](https://www.w3.org/press-releases/2025/verifiable-credentials-2-0/))
- **VC Data Integrity 1.0**: Describes mechanisms for ensuring authenticity and integrity using digital signatures and mathematical proofs. ([source](https://www.w3.org/TR/vc-data-integrity/))
- **VC Use Cases (W3C)**: Covers identity credentials, university credentials, employment verification. Establishes the pattern of issuer-holder-verifier that HPP's Requester-Resolver-Attester mirrors. ([source](https://www.w3.org/TR/vc-use-cases/))

**What this means for HPP**: W3C VCs establish the precedent for cryptographically signed, independently verifiable claims. HPP attestations follow the same pattern: signed by the Resolver, verifiable via JWKS without contacting any live service.

### Proof-of-personhood projects

- **Worldcoin / World ID**: Uses iris biometrics to establish "proof of human," proving an individual is both human and unique without revealing identity. World ID 2.0 supports multiple verification types. ([source](https://whitepaper.worldcoin.org/proof-of-personhood), [source](https://worldcoin.org/blog/announcements/introducing-world-id-2.0))
- **Gitcoin Passport / BrightID / Proof of Humanity**: Various approaches to Sybil resistance, proving account uniqueness for quadratic voting and UBI distribution. ([source](https://miniapp.gate.com/learn/articles/what-do-i-think-about-biometric-proof-of-personhood/1894))
- **Worldcoin on purpose**: "Proof of personhood provides natural rate limiting through account verification, essentially eliminating sybil attacks at any notable scale." ([source](https://worldcoin.org/blog/worldcoin/proof-of-personhood-what-it-is-why-its-needed))

**How HPP differs**: Proof-of-personhood proves "you are a unique human." Once. HPP proves "a human participated in THIS specific decision at THIS moment." Worldcoin answers "are you human?" HPP answers "did a human approve this $50,000 transfer at 3:14pm?" They operate at different granularities:

| | Proof of Personhood | HPP |
|---|---|---|
| Question answered | "Is this a unique human?" | "Did a human participate in this decision?" |
| Frequency | Once (or periodically) | Per-decision |
| Granularity | Identity-level | Action-level |
| What's proven | Humanness + uniqueness | Participation + decision + timing |
| Cryptographic output | Identity credential | Decision attestation |

---

## 6. Analogous protocol architectures

### RFC 8615  - well-known URIs

- **RFC 8615 (May 2019)**: Defines the `/.well-known/` path prefix for well-known locations in URI schemes. Obsoletes RFC 5785. Provides a predictable, standardised location for service discovery. ([source](https://datatracker.ietf.org/doc/html/rfc8615))
- **Cloudflare Agent Skills Discovery RFC (2025)**: Proposes using `.well-known` for AI agent skill discovery, showing the pattern's continued relevance in the agentic era. ([source](https://github.com/cloudflare/agent-skills-discovery-rfc))

**What this means for HPP**: HPP uses `/.well-known/hpp/metadata` (Resolver) and `/.well-known/hpp/app-metadata` (Requester) following this established internet pattern for service discovery.

### ActivityPub and federation

- **ActivityPub (W3C Recommendation, 2018)**: Decentralised social networking protocol. Provides client-to-server and federated server-to-server APIs. Powers Mastodon, now adopted by Meta's Threads. ([source](https://www.w3.org/TR/activitypub/))
- **Federation challenges (arxiv, 2024)**: Research suggests the Fediverse "will face significant challenges in fulfilling its decentralization promises," particularly around power concentration in large instances. ([source](https://arxiv.org/html/2408.15383))
- **Threads federation (Meta, 2024)**: Meta joined ActivityPub, sharing posts to other compliant servers. This shows that major platforms can participate in federated protocols. ([source](https://engineering.fb.com/2024/03/21/networking-traffic/threads-has-entered-the-fediverse/))

**What this means for HPP**: ActivityPub proves federated protocols can achieve critical mass, but also shows the challenge of maintaining true decentralisation. HPP's simpler scope (request → decision → attestation) reduces the complexity that plagues social federation.

### Email as the model

Email remains the canonical example of a federated, interoperable protocol:
- Any client works with any server (IMAP/SMTP)
- Users choose their provider independently
- Providers compete on features, not lock-in
- The protocol is standardised; implementations vary

HPP explicitly follows this model: any client app works with any Resolver, via any Requester. The interop boundary is rigid at the protocol level; implementation details are flexible within providers.

---

## 7. Human-in-the-loop: the rubber-stamping problem

### Automation bias

- **Springer (2026)  - "What is Wrong With Automation Bias?"**: Distinguishes "weak automation bias" (complacency/negligence) from "strong automation bias" (excessive and unwarranted transfer of trust resulting in epistemic deference to automated systems). Documented across aviation, radiology, criminal justice, and hiring. ([source](https://link.springer.com/10.1007/s13347-026-01090-9))
- **BCG (2025)  - "You Won't Get GenAI Right if Human Oversight is Wrong"**: Human review is "often undermined by automation bias, escalation roadblocks and disincentives, and evaluations steered by vibes rather than guidelines." ([source](https://www.bcg.com/publications/2025/wont-get-gen-ai-right-if-human-oversight-wrong))
- **MIT Sloan Management Review (2025)**: "How to Avoid Rubber-Stamping Recommendations"  - argues AI explainability is needed to prevent humans from blindly deferring to AI outputs. ([source](https://sloanreview.mit.edu/article/ai-explainability-how-to-avoid-rubber-stamping-recommendations/))
- **IBM (2026)  - "Why 'human in the loop' alone is not a governance strategy"**: "Organizations say it with the confidence of a solution" but HITL often means "a rubber stamp at the end of an automated process." ([source](https://www.ibm.com/think/insights/liability-laundering-problem-human-in-the-loop-not-governance-strategy))

### Human-in-the-loop vs human-on-the-loop

- **HITL**: System pauses for human approval before each high-stakes action. Synchronous, per-decision validation.
- **HOTL**: System operates autonomously while humans monitor asynchronously and can intervene.
- **Nature Medicine (2026)  - "Meaningful oversight of medical AI beyond human in the loop"**: Proposes four conditions for meaningful oversight: epistemic capacity, cognitive space, decisional authority, and intervention effectiveness. "Clinician presence alone does not make oversight meaningful." ([source](https://www.nature.com/articles/s41746-026-02971-1))
- **Springer (2026)  - "Designing meaningful human oversight in AI"**: "Current approaches risk either collapsing agentic AI into mere automation... or reducing human agency to a rubber stamp." ([source](https://link.springer.com/10.1007/s43681-026-01147-7))
- **EDPS TechDispatch (2025)**: European Data Protection Supervisor's formal analysis of human oversight in automated decision-making, acknowledging risks of "opacity, bias, and discrimination." ([source](https://www.edps.europa.eu/data-protection/our-work/publications/techdispatch/2025-09-23-techdispatch-22025-human-oversight-automated-making))

**What this means for HPP**: The research is clear. Human oversight without structural guarantees degrades into rubber-stamping. HPP provides that guarantee: the human must actively engage with a physical device, using biometrics, to make a specific decision. The attestation records what they decided, when, and how.

---

## 8. Market signals and existing analogues

### 3D Secure (transaction signing in payments)

- **3D Secure 2.x**: Payment authentication protocol adding real-time identity verification between cardholder, issuing bank, and merchant. Prompts biometric verification or one-time code for higher-risk transactions. Transmits up to 150 data points; ~80-85% of transactions approved frictionlessly, with challenges only for higher-risk payments. ([source](https://stripe.com/us/resources/more/3d-secure-101), [source](https://www.pci-proxy.com/blog-posts/blog-3d-secure-authentication-guide))
- **Strong Customer Authentication (SCA)**: EU/UK mandate. The US remains the largest single market where stepped-up authentication remains optional. ([source](https://glenbrook.com/payments_on_fire/episode-249-3-d-secure-strong-customer-authentication-stripe-entersekt/))

**How HPP relates**: 3DS is the closest existing pattern to HPP: an out-of-band verification that a human approves a specific transaction. But 3DS is payments-only, proprietary, and controlled by card networks. HPP generalises this pattern to any application, any decision, with an open protocol.

### Gartner on AI governance

- **Gartner (2026)  - "Reducing GenAI Risk With Decision Governance"**: "Placing trust in AI agents that make automated but ungoverned decisions is a fast route to failure." Decision governance emerging as a top trend. ([source](https://www.gartner.com/en/documents/7440362))
- **Gartner (2026)  - "When AI Governance Fails, Revenue and Executives Take the Hit"**: "AI governance is no longer just about control. It is about executive exposure. The challenge is proving the decisions it touches are visible, owned, defensible and paying off." ([source](https://www.gartner.com/en/documents/8115197))
- **Gartner (2026)  - "Transform Your Trust Strategy With Verifiable Integrity"**: "Product leaders must move beyond compliance and adopt verifiable integrity  - active accountability, model resilience and contextual alignment." ([source](https://www.gartner.com/en/documents/7493553))
- **Gartner (2027 prediction)**: "Cross-industry collaborations on AI ethics frameworks will become regular practice, reinforcing accountability across sectors." ([source](https://www.gartner.com/en/articles/2025/ai-ethics-governance-and-compliance))

### Google's security approach to agent actions

- **Google (2025)  - "Building Gemini Intelligence on a Foundation of Security & Privacy"**: "Gemini can only access the apps you allow it to work in, and not the rest of your device. Gemini is designed to require user confirmation before making purchases on your behalf." ([source](https://blog.google/security/android-gemini-intelligence-security-privacy/))

**What this means**: Even Google recognises that agents need human confirmation for consequential actions. But their solution is proprietary, device-specific, and non-interoperable. HPP standardises this pattern across all applications and providers.

---

## 9. Summary: the gap HPP fills

| Layer | What exists | What it proves | What it doesn't prove |
|-------|-------------|---------------|----------------------|
| Authentication | OAuth, FIDO2, Passkeys | Who you are | That you're still here |
| Session management | Cookies, tokens | Valid access | That a human is using the session |
| Agent identity | A2A, MCP, NHI registries | Which agent acted | That a human approved the action |
| Proof of personhood | Worldcoin, BrightID | You're human (once) | That you participated in THIS decision |
| Transaction auth | 3D Secure, SCA | Human approved THIS payment | Anything beyond payments |
| **HPP** | ** -** | **A human participated in THIS specific decision, at THIS time, verified by biometrics on a physical device** | ** -** |

HPP sits above the identity layer and below the application layer. It answers a question no existing protocol answers at internet scale: "Did a human meaningfully participate in this specific action?"

---

## Research notes

- Sources prioritise primary documentation (RFCs, W3C specs, regulatory text, official announcements) over secondary commentary
- Statistics from analyst firms (Gartner, McKinsey, PwC) reflect 2025-2026 surveys
- The automation bias literature is well-established (decades of research in aviation and medicine); its application to AI oversight is emerging but increasingly consensus
- The EU AI Act text is final (Regulation 2024/1689, effective August 2024); interpretation for agentic AI is actively developing
- Proof-of-personhood space is contested (privacy concerns, centralisation risks with Worldcoin); HPP's per-decision model sidesteps these debates

---

*Research compiled July 2026. All URLs verified at time of research.*
