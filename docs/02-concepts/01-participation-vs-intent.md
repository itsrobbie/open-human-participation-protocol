# Participation vs intent

## Why "participation" and not "intent"

The original framing of this problem used the word "intent" - proving that a human *intended* for something to happen. But participation is a broader, more practical, and more future-proof concept.

---

## Intent is an internal state

Intent answers: *"What did the human mean to do?"*

The problem is that intent is incredibly difficult to prove. A person can:

- Intend something and not act
- Act without understanding
- Be coerced
- Make a mistake
- Click approve accidentally
- Delegate the action to an agent

Intent is fundamentally psychological. Most systems can only infer it. This creates a challenge for any trust architecture or standards category - standards bodies prefer observable, measurable, and attestable concepts.

---

## Participation is observable

Participation answers: *"What involvement did the human have in this process?"*

Participation can be evidenced:

| Question | Evidence Possible? |
|----------|-------------------|
| Did a human intend this? | Difficult |
| Did a human view the information? | Yes |
| Did a human spend time reviewing it? | Yes |
| Did a human answer questions? | Yes |
| Did a human intervene? | Yes |
| Did a human make the final decision? | Yes |
| Did a human participate meaningfully? | Potentially |

Participation can be measured, logged, attested, and audited. That makes it a much better candidate for infrastructure.

---

## Intent is a subset of participation

The hierarchy:

```
Human Participation
├── Presence
├── Attention
├── Engagement
├── Understanding
├── Intent
└── Approval
```

Intent doesn't disappear. It becomes one of the strongest forms of participation. A human can participate without necessarily expressing intent. But intent cannot exist in a governance framework without some form of participation.

---

## The strategic distinction

If you position this as "Human Intent Infrastructure," people immediately start arguing philosophy:

- What is intent?
- Can AI have intent?
- Can intent be inferred?
- What about coercion?
- What about mistakes?

You end up in legal and cognitive science debates.

If you position it as "Human Participation Infrastructure," the conversation becomes operational:

- Was a human involved?
- At what stage?
- To what degree?
- How can we prove it?
- What evidence exists?

That's a tractable standards problem. And it aligns with how regulators already frame their requirements. The EU AI Act (Article 14) requires "effective oversight by natural persons during the period in which they are in use." The NIST AI RMF asks whether "a human remains accountable for every AI-assisted output." Neither demands proof of intent. They demand evidence of participation. HPP speaks the language regulators are already using.

---

## The relationship

Participation is the infrastructure problem. Intent is the trust outcome.

A board doesn't care whether a director merely participated. They care whether the director *intentionally* approved something. A regulator doesn't care whether an employee viewed a policy. They care whether the employee *knowingly* accepted it.

But you can't prove intent without first proving participation. Participation is the foundation. Intent is built on top of it.

---

## Next

- [The Agentic World →](02-the-agentic-world.md)
- [Design Principles →](04-design-principles.md)

---

## References

- EU AI Act, Article 14: Human Oversight. [activemind.legal](https://www.activemind.legal/legislation/ai-act/article-14/)
- NIST, AI Risk Management Framework. [nist.gov](https://airc.nist.gov/airmf-resources/airmf/)
- Stell Engineering, "Engineering Certainty: Applying the NIST AI Risk Management Framework Playbook," 2026. [stell-engineering.com](https://stell-engineering.com/blog/nist-ai-risk-management-framework-playbook)
