# E-commerce

## Agents shopping on your behalf

The obvious use case for AI agents in e-commerce: "Order me a pizza," "Restock my coffee," "Find me flights to Bali under $800." The agent navigates the site, picks options, fills forms, and checks out. All using your saved credentials.

The question for the platform: when should the human be in the loop?

The answer is not "always." If a user orders the same coffee every week, asking them to confirm every time is just friction. But when the agent picks a $300 hotel upgrade, or orders from a new vendor, or applies a coupon that changes the total - those are moments where participation adds value.

HPP gives platforms a standardised way to insert those moments without building a proprietary notification system.

---

## Pizza ordering (the running example)

A pizza app integrated with HPP. The user's agent says "order my usual."

The app knows the "usual" is a large pepperoni, thin crust, from the saved address. No participation needed for that. But the agent adds garlic bread (upsell opportunity), and the total is higher than last time.

**Request**:
```json
{
  "type": "select",
  "action": {
    "summary": "Your agent added garlic bread ($5.50). Confirm order?",
    "description": "**Order**: Large Pepperoni (thin crust) + Garlic Bread\n**Total**: $28.50 (was $23.00 last time)\n**Delivery to**: 42 Smith St",
    "category": "orders"
  },
  "options": [
    { "key": "confirm", "label": "Confirm order ($28.50)" },
    { "key": "remove-extra", "label": "Remove garlic bread ($23.00)" },
    { "key": "cancel", "label": "Cancel order" }
  ],
  "transaction": { "id": "txn-order-001", "label": "Pizza order" }
}
```

The platform chose to ask. Not because the protocol said it must, but because it's good business: the customer sees the upsell, sees the price, and makes a conscious choice. The platform gets a direct relationship moment with the customer, even though an agent initiated the order.

---

## Marketplace purchases from unknown sellers

A user's agent finds a deal on a refurbished laptop from a seller the user hasn't bought from before.

**Request**:
```json
{
  "type": "select",
  "action": {
    "summary": "Buy refurbished ThinkPad X1 from 'TechDeals_AU' ($649)?",
    "description": "**Seller**: TechDeals_AU (4.2 stars, 89 sales)\n**Item**: Lenovo ThinkPad X1 Carbon Gen 11, Refurbished Grade A\n**Price**: $649.00 + $12 shipping\n**Returns**: 30-day returns accepted\n**Note**: You haven't bought from this seller before.",
    "category": "purchases"
  },
  "options": [
    { "key": "buy", "label": "Buy now" },
    { "key": "save", "label": "Save for later" },
    { "key": "skip", "label": "Skip" }
  ]
}
```

The marketplace asks because it's a new seller and a significant amount. The user sees the seller rating, return policy, and price - context that would otherwise be invisible if the agent just bought it.

---

## Subscription management

Agents managing subscriptions on your behalf - upgrading plans, adding seats, changing billing cycles. These are recurring spend decisions.

**Request**:
```json
{
  "type": "select",
  "action": {
    "summary": "Your agent wants to upgrade to Pro plan ($29/mo from $12/mo)",
    "description": "**Service**: DesignTool.io\n**Current plan**: Starter ($12/month)\n**Proposed**: Pro ($29/month)\n**Reason**: Agent hit the 5-project limit on Starter\n**Annual cost increase**: $204",
    "category": "subscriptions"
  },
  "options": [
    { "key": "upgrade", "label": "Upgrade to Pro ($29/mo)" },
    { "key": "annual", "label": "Upgrade to Pro Annual ($24/mo)" },
    { "key": "deny", "label": "Stay on Starter" }
  ]
}
```

The platform uses HPP not just for security, but as a way to present upgrade options directly to the human - bypassing the agent's interpretation of what the user wants.

---

## What platforms gain

For e-commerce platforms, HPP is less about security and more about maintaining a direct relationship with the customer:

1. **Upsell visibility** - the human sees add-ons and upgrades, not just the agent's filtered view
2. **Trust signal** - "This purchase was human-approved" in order confirmations
3. **Dispute resolution** - signed attestation proves the human saw the price and confirmed
4. **Differentiation** - "We check with you before spending your money" vs competitors that don't

The platform decides when to ask. A repeat order of the same item from a trusted seller? Let the agent through. A new seller, higher amount, or unusual item? Ask.

---

## Next

- [Healthcare →](03-healthcare.md)
- [Enterprise and SaaS →](04-enterprise.md)
