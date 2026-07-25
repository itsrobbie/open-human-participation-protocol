# The agentic world

## The shift

We are entering an era where software is the primary user of software.

Microsoft, Google, OpenAI, Anthropic, Salesforce, ServiceNow, SAP, Atlassian, and others are investing heavily in agentic architectures. Google's Agent-to-Agent protocol (A2A), launched April 2025 with 50+ partners, now counts 150+ supporting organisations including Microsoft Azure AI Foundry, Amazon Bedrock, and Salesforce Agentforce. Anthropic's Model Context Protocol (MCP), introduced late 2024, is broadly adopted across agent frameworks. Browser automation, workflow agents, and AI copilots are establishing ecosystems where machines interact with other machines.

The numbers:

- **79%** of US executives report their companies use AI agents in some form (PwC, April 2025)
- **40%** of enterprise applications will embed task-specific AI agents by end of 2026, up from <5% in 2025 (Gartner)
- **$206.5 billion** in AI agent software spending forecast for 2026, a 139% increase year-over-year (Gartner)
- **23%** of organisations are actively scaling agentic AI; another 39% experimenting (McKinsey State of AI, 2025)

In this environment:

- Software becomes the primary user of software
- APIs become the primary interface
- Humans become supervisors rather than operators

This transition is happening faster than governance models are evolving.

---

## What agents can already do

Today's agents can:

- Control a browser as if they were a human (clicking, typing, navigating)
- Use legitimate authentication tokens (they log in as you)
- Complete multi-step workflows across applications
- Make decisions based on context and history
- Operate 24/7 without human oversight

The computer-use category, coined by Anthropic in October 2024 and adopted by OpenAI in January 2025, lets AI models drive any application via screenshots and virtual inputs. By mid-2026, all three major AI providers offer this:

- **Anthropic's Claude** operates through a virtual mouse and keyboard, interacting with any software "just like a human user would," without requiring APIs or integrations.
- **OpenAI's Operator** navigates web applications via the browser. Their "Background Computer Use" (April 2026) extends this to desktop workflows running for hours unattended.
- **Google's Gemini** uses screen automation on Android to handle multi-step tasks (ordering food, booking rides, managing inbox) and Gemini 3.5 Flash (June 2026) extends this to full PC takeover.
- **Google's Gemini Spark** operates 24/7 in the background, "even if your phone and laptop are turned off."

From the perspective of any SaaS platform: **it looks like a human is working.** The credentials are valid. The session is real. The actions are well-formed. The only difference is no human is actually there.

---

## The assumption applications make

Every web application, every API, every SaaS platform makes the same implicit assumption:

> If a valid session is performing actions, a human is behind it.

This assumption was never explicitly stated because it didn't need to be. Humans were the only entities capable of navigating software. That's no longer true.

Applications will keep working at the same speed. They'll keep pushing out features. Agents will keep acting on behalf of people using real authentication tokens. As far as the SaaS platforms are concerned, humans are still working.

But they're not. And the platforms can't tell the difference.

---

## What doesn't work

**Blocking agents entirely.** Impractical. Agents provide enormous value. Organisations *want* them to handle routine work.

**Requiring every app to implement agent identity.** Doesn't scale. The non-human identity (NHI) problem is already overwhelming enterprises. Machine identities outnumber human ones 45:1 (Rubrik Zero Labs), rising to 144:1 in cloud-native environments. Two-thirds of enterprises have already suffered a breach involving a compromised NHI. Adding more identities doesn't solve participation; it makes identity management worse.

**Relying on agent protocols to handle it.** Existing agent protocols don't address this. An arxiv analysis of approximately 2,000 MCP servers found all lacked authentication. MCP has "no native identity or authorization layer" and "a server receiving an MCP request cannot determine which agent sent it, who authorized the call, or what permissions the caller holds." A2A defines task delegation between agents but not human verification. These protocols answer "which agent did this?", not "did a human approve it?"

**CAPTCHAs and bot detection.** These prove "not a bot" at login. They don't prove "a human is involved in this specific decision 3 hours later."

**Audit trails.** They record what happened. They don't prove who was actually involved when it happened.

---

## What's needed

A world where:

- Agents work in the background autonomously (this is good and expected)
- Certain actions automatically escalate to a human for genuine participation
- The human participates through a channel the agent cannot control (a physical device with biometrics)
- The participation is cryptographically provable after the fact
- Any application can trigger this, without implementing a custom solution
- The mechanism is standardised, interoperable, and open

This is the Human Participation Protocol.

---

## Next

- [Thought Experiments →](03-thought-experiments.md)
- [Design Principles →](04-design-principles.md)

---

## References

- PwC, "AI Agent Adoption Survey," April 2025. [aboutchromebooks.com](https://www.aboutchromebooks.com/ai-agent-adoption-statistics/)
- Gartner, "AI Agents Statistics 2026: Market Size, Adoption, and the Deployment Gap." [axis-intelligence.com](https://axis-intelligence.com/ai-agents-statistics/)
- McKinsey, "State of AI 2025 Global Survey," via Forbes, March 2026. [forbes.com](https://www.forbes.com/sites/josipamajic/2026/03/22/10-of-enterprise-functions-use-ai-agents-mckinsey-finds/)
- Google, "Announcing the Agent2Agent Protocol (A2A)," April 2025. [googleblog.com](https://developers.googleblog.com/a2a-a-new-era-of-agent-interoperability/)
- Google Cloud, "Agent2Agent protocol (A2A) is getting an upgrade," 2025. [cloud.google.com](https://cloud.google.com/blog/products/ai-machine-learning/agent2agent-protocol-is-getting-an-upgrade)
- Eco, "A2A (Agent-to-Agent) Protocol Explained," 2026. [eco.com](https://eco.com/support/en/articles/14845481-a2a-agent-to-agent-protocol-explained)
- Cloud Security Alliance, "Agentic AI, MCP, and the Identity Explosion," 2026. [cloudsecurityalliance.org](https://cloudsecurityalliance.org/articles/agentic-ai-mcp-and-the-identity-explosion-you-can-t-ignore)
- WorkOS, "Anthropic's Computer Use versus OpenAI's Computer Using Agent (CUA)," July 2025. [workos.com](https://workos.com/blog/anthropics-computer-use-versus-openais-computer-using-agent-cua)
- Digital Applied, "Computer Use Agents 2026: Claude vs OpenAI vs Gemini." [digitalapplied.com](https://www.digitalapplied.com/blog/computer-use-agents-2026-claude-openai-gemini-matrix)
- Google, "Computer Use tool," Gemini API documentation, July 2026. [ai.google.dev](https://ai.google.dev/gemini-api/docs/computer-use)
- Google, "Gemini Spark – Your 24/7 personal AI agent for productivity." [gemini.google](https://gemini.google/overview/agent/spark/)
- Rubrik Zero Labs, NHI-to-human identity ratio research, via The Hacker News, 2026. [thehackernews.com](https://thehackernews.com/expert-insights/2026/05/the-non-human-identity-crisis-why-your.html)
- IJRASET, "The Non-Human Identity Governance Crisis in Cloud Environments," 2025. [ijraset.com](https://www.ijraset.com/research-paper/the-non-human-identity-governance-crisis-in-cloud-environments)
- Axis Intelligence, "Non-Human Identity Statistics 2026." [axis-intelligence.com](https://axis-intelligence.com/non-human-identity-statistics/)
- Arxiv, "Agent Identity Protocol for Verifiable Delegation Across MCP and A2A," 2025. [arxiv.org](https://arxiv.org/abs/2603.24775)
- Vouched, "Model Context Protocol MCP-I Security for Developers," 2026. [vouched.id](https://www.vouched.id/learn/blog/model-context-protocol-mcp-i-security-guide)
