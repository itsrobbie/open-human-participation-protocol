# Thought experiments

These scenarios show why human participation verification matters, and why existing systems can't provide it.

None are hypothetical. The technology to execute each one exists today. Google's Gemini Spark operates autonomously 24/7 "even if your phone and laptop are turned off." OpenAI's Background Computer Use runs desktop workflows for hours unattended. The only thing separating these scenarios from reality is time and adoption, and adoption is growing at 340% year-over-year (2025).

---

## The invisible pizza

You tell your AI agent: "Order me a pizza tonight."

The agent opens the pizza app, selects your usual order, enters your payment details, and confirms. You get a pizza. The system worked perfectly.

But what if the pizza app added a new "Subscribe to weekly delivery for $50/month" checkbox - pre-ticked - during checkout? Your agent, optimising for completing the task, might accept it without noticing. You'd never know until you see the charge.

**With HPP**: The pizza app marks the subscription as requiring participation. Your phone shows: "Subscribe to weekly delivery? $50/month" with Yes/No. You see it. You decline. The agent completes the original order.

**A new-age food ordering app built on HPP**: The ordering experience lives entirely on the web — browsing menus, building your cart, applying coupons. The agent handles all of it. But the provider decides which moments matter. The checkout confirmation comes as a participation request: "Place order: 1x Margherita, 1x Garlic Bread — $24.50. Pay with Visa ending 4821?" with Confirm/Edit/Cancel. Upsells arrive the same way: "Add a dessert for $5?" — the customer sees it, the provider gets a direct relationship moment, and the agent doesn't silently accept or reject on your behalf. The pizza shop controls what the human sees. The human controls what gets approved. The agent does the legwork between those moments.

---

## The silent approval

You work at a bank. An AI agent handles routine transaction approvals - small amounts, known payees, standard patterns. One day, a $50,000 transfer to a new international payee comes through. The agent approves it using your credentials because you set the approval threshold at $100,000.

The transfer is fraudulent. In the investigation, the compliance team asks: "Did you approve this?" The audit log says yes. You never saw it.

**With HPP**: The bank's system marks new-payee international transfers as requiring participation regardless of amount. Your watch buzzes: "Transfer $50,000 to [new payee, Nigeria]. Approve?" You see it. You deny it. Fraud prevented.

**A new-age banking app built on HPP**: The bank's web platform handles the routine — viewing balances, recurring payments, standard transfers between known accounts. Agents navigate it freely. But the bank decides where humans must be present. Adding a new payee pushes a participation request: "Add payee: John Smith, Sort 12-34-56, Acc 12345678?" International transfers, regardless of amount, go to the customer's device with full details. Standing order changes, direct debit mandates, limit increases — each one a participation request with context the human can read and approve in seconds. The bank gets attestation-backed proof for every sensitive action. In a dispute, they don't need to argue about what "the user" did — they have a cryptographic record that the human, on their device, approved the specific transaction. Regulators get what they actually want: evidence of informed human consent, not just session logs.

---

## The compliance theatre

Your company requires all employees to complete annual security training and acknowledge the acceptable use policy. An AI agent completes the training for 500 employees in one afternoon - answering all questions correctly, clicking through all slides, and signing the acknowledgement.

The company's compliance report shows 100% completion. The regulator is satisfied. But no employee actually learned anything or genuinely acknowledged the policy.

**With HPP**: The training platform marks completion as requiring participation. Each employee must physically confirm on their device: "I have completed and understood the 2026 Security Policy." The attestation proves a human interacted - not just that credentials were used.

**A new-age compliance app built on HPP**: Take this further. A modern compliance platform — phishing simulation, security awareness, policy acknowledgement — would use HPP as its core delivery channel. The learning content (videos, articles, interactive modules) lives on the web where it always has. But every assessment question, every "what would you do?" scenario, every policy sign-off is pushed as a participation request to the employee's device.

A phishing simulation sends a realistic email. The employee clicks the link. Instead of a "gotcha" page, their phone buzzes with a participation request: "You just clicked a suspicious link. What gave it away?" with options like "I didn't notice anything," "The sender address looked wrong," or "The URL didn't match." They answer on their device. The attestation proves the human engaged with the lesson — not that a browser session completed a form.

Weekly micro-training drops a question to the employee's phone: "A colleague asks for your login to fix something urgently. What do you do?" The employee answers in the moment. No browser tab. No "I'll do it later" that becomes never. The compliance platform has a cryptographic record that this specific human answered this specific question at this specific time.

The compliance team gets attestation-backed records for every interaction. Not "this session completed the module" — "this human, on this device, answered these questions and acknowledged this policy." Auditors can independently verify every attestation. The company knows its training programme actually reached humans, not just their credentials.

---

## The smart home disaster

Your AI home assistant manages your smart home. It learns patterns, adjusts heating, locks doors. One day, a voice-controlled agent (triggered by a TV advertisement or a visitor) says "unlock the front door" and "disable the alarm." The smart home system complies - the command came through an authenticated channel.

**With HPP**: Unlocking doors and disabling alarms require participation. Your phone shows: "Unlock front door?" You didn't ask for that. You deny it.

**A new-age smart home platform built on HPP**: The smart home runs autonomously for the mundane stuff — adjusting thermostats, turning lights on at sunset, running the robot vacuum. No participation needed, no interruptions. But the platform categorises actions by consequence. Unlocking any external door, disabling security systems, granting guest access, opening the garage after midnight — those push participation requests. "Grant temporary access to: Delivery Driver (Amazon). Duration: 10 minutes. Unlock: Side gate only." You approve from your phone while at work. The delivery happens. The gate re-locks. You have a cryptographic record of exactly what access you granted, when, and to whom. If someone later claims you let them in, the attestation either exists or it doesn't. No ambiguity.

---

## The delegated life

A busy executive has an AI agent managing their entire digital life. Email, calendar, approvals, document signing, expenses, travel booking. The agent is efficient and accurate 99% of the time.

In the 1% of cases, the agent signs a contract with unfavourable terms, approves a hire that should have been declined, and books a trip that conflicts with a family commitment. The executive never knew these decisions were being made.

**With HPP**: High-stakes actions - signing contracts, approving hires, large expenses - require participation. The executive sees a summary on their phone and consciously decides. Routine actions (booking meeting rooms, filing expenses under $100) flow through without interruption.

**A new-age executive workflow platform built on HPP**: The agent manages the full workload — scheduling, email triage, expense categorisation, document preparation, travel logistics. It operates across dozens of SaaS tools using the executive's credentials. Each of those tools independently decides what requires human participation. The HR platform pushes: "Approve hire: Senior Engineer, $185k base + equity. Start date: Aug 1." The legal tool pushes: "Sign: NDA with Acme Corp. 2-year non-compete clause included. View summary / Sign / Decline." The travel system pushes: "Book: London → Tokyo, Nov 12-16. Business class. $4,200. Confirm?" The executive's phone becomes a decision stream — just the moments that matter, from all the platforms that matter, answered in seconds between meetings. Each decision carries a signed attestation back to the originating platform. The agent keeps working on everything else. No bottleneck, no "catch up on 200 pending approvals" backlog — because the human handles decisions in real time on their device, and the agent handles execution everywhere else.

---

## The key question

In each scenario, the question isn't "was the system authenticated?" - it was. The question isn't "was the action authorised?" - it was.

The question is: **did a human actually participate in the decision?**

That's the question the Human Participation Protocol answers.

---

## Next

- [Design Principles →](04-design-principles.md)

---

## References

- Google, "Gemini Spark – Your 24/7 personal AI agent for productivity." [gemini.google](https://gemini.google/overview/agent/spark/)
- Digital Applied, "Computer Use Agents 2026: Claude vs OpenAI vs Gemini." [digitalapplied.com](https://www.digitalapplied.com/blog/computer-use-agents-2026-claude-openai-gemini-matrix)
- Axis Intelligence, "Agentic AI Statistics 2025-2026: Market Growth, Adoption Rates & Enterprise Impact Data." [axis-intelligence.com](https://axis-intelligence.com/agentic-ai-statistics-2025-2026/)
