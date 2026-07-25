# Why this matters

The participation gap creates risk across five dimensions.

---

## Accountability

Legal and regulatory accountability remains human. Boards remain accountable. Executives remain accountable. Professionals remain accountable.

Delegating execution to an agent does not transfer responsibility. If an agent approves a transaction that causes harm, the human is still liable. But if the human never actually participated in the decision, accountability becomes a fiction maintained by audit logs.

As IBM stated in their 2026 analysis: "'Human in the loop' alone is not a governance strategy." Organisations say it with the confidence of a solution, but without structural guarantees it often means "a rubber stamp at the end of an automated process." Gartner's research confirms: "AI governance is no longer just about control. It is about executive exposure. The challenge is proving the decisions it touches are visible, owned, defensible and paying off."

---

## Governance

Organisations must demonstrate that humans remain involved in critical decisions. This is becoming law.

The **EU AI Act** (Regulation 2024/1689, effective August 2024) requires human oversight for high-risk AI systems. Article 14 mandates that high-risk systems "shall be designed and developed in such a way... that they can be effectively overseen by natural persons during the period in which they are in use." Article 26 requires deployers to "assign human oversight to natural persons who have the necessary competence, training and authority." The EU's own analysis argues that for agentic AI, "that obligation only bites at the granularity of the action." Oversight must be per-decision, not per-model.

The **US Executive Order 14110** (October 2023) on "Safe, Secure, and Trustworthy Development and Use of AI" establishes human oversight as a guiding principle. The accompanying OMB memo identifies "the right to human oversight" as one of five accountability principles.

The **NIST AI Risk Management Framework** treats human oversight as "a recurring property rather than a one-time check," asking whether organisations have "defined roles, responsibilities, and oversight processes that ensure a human remains accountable for every AI-assisted output."

"Human oversight" without evidence of participation is unverifiable. It becomes a checkbox exercise. Gartner predicts that by 2027, 40% of enterprises will demote or decommission autonomous AI agents due to governance gaps identified only after production incidents.

---

## Compliance

Compliance increasingly depends on demonstrating process integrity. If AI agents can complete workflows on behalf of humans, organisations need stronger evidence that required participation actually occurred.

In financial services, **MiFID II** requires suitability assessments ensuring firms make "suitable investment decisions on behalf of their clients," implying human judgement. ESMA and EBA issued a joint consultation in February 2026 revising these requirements specifically for the AI era. **SOX** requires management attestation of internal controls. **Strong Customer Authentication** (SCA) under PSD2 already mandates stepped-up verification for payment transactions. The EU and UK have made this law, though the US remains the largest market where it's still optional.

In healthcare, FDA guidance on clinical decision support and AI-assisted diagnostics requires human review before acting on AI recommendations. HIPAA's audit requirements assume human involvement in access decisions.

The question shifts from "was the process followed?" to "was a human genuinely involved in the process?"

---

## Safety

In healthcare, a misread scan leads to wrong treatment. In finance, an unauthorised transfer moves money that can't be recovered. In aviation, a missed maintenance check can kill people.

These fields have always required human review for high-stakes decisions. The challenge now is proving that review actually happened, not just that someone's credentials were used to sign off.

Specific examples:
- A radiologist must review an AI-flagged scan before treatment proceeds
- A bank officer must authorise transfers above a threshold to new payees
- A nuclear plant operator must confirm changes to cooling system parameters
- A maintenance engineer must sign off on aircraft safety checks

In each case, the audit log currently records "approved by [name]." It cannot distinguish between a human who carefully reviewed the decision and an agent that clicked the button.

---

## Trust

Trust depends on confidence that important actions received real human attention. When a bank says "your transaction was approved," you trust that you or someone you authorised made that decision. When a company says "our board reviewed and approved," stakeholders trust that directors were actually involved.

Without verifiable participation, that trust erodes. Gartner's research puts it plainly: organisations must move "beyond compliance and adopt verifiable integrity" including "active accountability, model resilience and contextual alignment." Their work on decision governance warns that "placing trust in AI agents that make automated but ungoverned decisions is a fast route to failure."

When trust erodes at scale, across financial systems, healthcare, governance, and infrastructure, the consequences are systemic.

---

## The opportunity

The next frontier of digital trust is not identity. It's participation.

The infrastructure exists to prove who you are. Nothing exists to prove you were actually there when it mattered.

---

## Next

- [Back to the start →](01-human-participation-problem.md)
- [Concepts: Participation vs Intent →](../02-concepts/01-participation-vs-intent.md)

---

## References

- IBM, "Why 'human in the loop' alone is not a governance strategy," 2026. [ibm.com](https://www.ibm.com/think/insights/liability-laundering-problem-human-in-the-loop-not-governance-strategy)
- Gartner, "When AI Governance Fails, Revenue and Executives Take the Hit," 2026. [gartner.com](https://www.gartner.com/en/documents/8115197)
- Gartner, "Transform Your Trust Strategy With Verifiable Integrity," 2026. [gartner.com](https://www.gartner.com/en/documents/7493553)
- Gartner, "Gartner Says Applying Uniform Governance Across AI Agents Will Lead to Enterprise AI Agent Failure," May 2026. [gartner.com](https://www.gartner.com/en/newsroom/press-releases/2026-05-26-gartner-says-applying-uniform-governance-across-ai-agents-will-lead-to-enterprise-ai-agent-failure)
- EU AI Act, Article 14: Human Oversight. [activemind.legal](https://www.activemind.legal/legislation/ai-act/article-14/)
- EU AI Act, Article 26: Obligations of deployers of high-risk AI systems. [europa.eu](https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-26)
- EU AI Act, Key Issue 4: Human Oversight. [euaiact.com](https://www.euaiact.com/key-issue/4)
- EU Futurium, "Article 14 at runtime — why oversight of agentic AI has to be evidenced per action, not per model," 2025. [europa.eu](https://futurium.ec.europa.eu/it/apply-ai-alliance/community-content/article-14-runtime-why-oversight-agentic-ai-has-be-evidenced-action-not-model)
- US Executive Order 14110, "Safe, Secure, and Trustworthy Development and Use of Artificial Intelligence," October 2023. [federalregister.gov](https://www.federalregister.gov/documents/2023/11/01/2023-24283/safe-secure-andtrustworthy-development-and-use-of-artificial-intelligence)
- Brookings, "How the AI Executive Order and OMB memo introduce accountability for artificial intelligence," 2024. [brookings.edu](https://www.brookings.edu/articles/how-the-ai-executive-order-and-omb-memo-introduce-accountability-for-artificial-intelligence/)
- NIST, AI Risk Management Framework. [nist.gov](https://airc.nist.gov/airmf-resources/airmf/)
- Metacto, "Human Oversight of AI Agents in Production: Architecture," 2026. [metacto.com](https://www.metacto.com/blogs/human-oversight-of-ai-agents-production)
- Stell Engineering, "Engineering Certainty: Applying the NIST AI Risk Management Framework Playbook," 2026. [stell-engineering.com](https://stell-engineering.com/blog/nist-ai-risk-management-framework-playbook)
- ESMA, MiFID II Article 17: Algorithmic Trading. [europa.eu](https://www.esma.europa.eu/publications-and-data/interactive-single-rulebook/mifid-ii/article-17-algorithmic-trading)
- MFSA, "Circular on MiFID II and MiFIR," March 2026. [mfsa.mt](https://www.mfsa.mt/wp-content/uploads/2026/03/Circular-on-Markets-in-Financial-Instruments-Directive-MiFID-II-and-Markets-in-Financial-Instruments-Regulation-MiFIR.pdf)
- Glenbrook, "Two Decades of 3-D Secure: Can Strong Customer Authentication Succeed in the US?", 2024. [glenbrook.com](https://glenbrook.com/payments_on_fire/episode-249-3-d-secure-strong-customer-authentication-stripe-entersekt/)
