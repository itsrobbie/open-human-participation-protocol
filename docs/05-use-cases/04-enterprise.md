# Enterprise and SaaS

## The enterprise agent problem

Enterprise software is where agents will hit hardest. Salesforce Einstein, Microsoft Copilot, ServiceNow AI agents - these are already operating inside business workflows. They draft proposals, update CRM records, approve expense reports, and escalate tickets.

The enterprise concern is governance: who approved what, when, and can you prove it to an auditor? Today's answer is permission models and audit logs. Tomorrow's answer needs to account for agents acting on behalf of employees.

---

## Expense approval

An AI financial agent processes expense reports. Company policy: any expense over $500 requires manager approval.

**Request**:
```json
{
  "type": "select",
  "action": {
    "summary": "Approve expense: $1,240 conference travel (Sarah Chen)",
    "description": "**Submitted by**: Sarah Chen, Engineering\n**Category**: Conference travel\n**Amount**: $1,240.00\n**Breakdown**:\n- Flight: $680\n- Hotel (2 nights): $420\n- Conference ticket: $140\n**Event**: PyCon AU 2026, Melbourne\n**Business justification**: Presenting team's MLOps tooling work",
    "category": "expenses"
  },
  "options": [
    { "key": "approve", "label": "Approve" },
    { "key": "approve-partial", "label": "Approve with conditions", "freeText": true, "placeholder": "Conditions (e.g., economy flights only)" },
    { "key": "reject", "label": "Reject", "freeText": true, "placeholder": "Reason for rejection" }
  ]
}
```

The attestation proves the manager (not their agent) reviewed the line items and approved. If a pattern of rubber-stamped approvals emerges (all approved in under 2 seconds), that's visible in the attestation timestamps.

---

## Production deployment approval

A CI/CD pipeline wants to deploy to production. Company policy requires a human to approve production deployments.

**Request**:
```json
{
  "type": "select",
  "action": {
    "summary": "Deploy payments-service v2.14.0 to production?",
    "description": "**Service**: payments-service\n**Version**: 2.14.0 (from 2.13.8)\n**Changes**: 14 commits, 3 PRs merged\n**Tests**: 847/847 passed, 0 flaky\n**Staging health**: All green (deployed 4h ago)\n**Rollback**: Automated, <2 min\n**Risk**: Medium (DB migration included)",
    "rationale": "Contains payment processor failover logic - human review recommended",
    "category": "deployments"
  },
  "options": [
    { "key": "deploy", "label": "Deploy to production" },
    { "key": "delay", "label": "Delay (deploy during next window)" },
    { "key": "reject", "label": "Reject - needs more testing" }
  ]
}
```

The attestation goes into the deployment audit trail. If something goes wrong, the investigation can verify that a human reviewed the deployment summary and approved.

---

## Access escalation

An employee's agent requests elevated permissions. The security team needs proof a human authorised it.

**Request**:
```json
{
  "type": "select",
  "action": {
    "summary": "Grant prod database read access to Alex Park?",
    "description": "**Requester**: Alex Park (Backend Engineer, Level 3)\n**Resource**: prod-payments-db (PostgreSQL)\n**Access level**: Read-only\n**Duration**: 4 hours\n**Reason stated**: Investigating payment failure for ticket INC-4401\n**Current access**: staging-payments-db (read/write), prod logs (read)",
    "category": "access"
  },
  "options": [
    { "key": "grant", "label": "Grant access (4 hours)" },
    { "key": "grant-reduced", "label": "Grant access (1 hour)" },
    { "key": "deny", "label": "Deny" },
    { "key": "escalate", "label": "Escalate to security lead" }
  ]
}
```

---

## Contract signature

A SaaS procurement tool negotiated terms with a vendor. The legal team needs to confirm a human authorised the final agreement.

**Request**:
```json
{
  "type": "signature",
  "action": {
    "summary": "Sign: Master Services Agreement with CloudStack Inc",
    "description": "**Vendor**: CloudStack Inc\n**Term**: 24 months\n**Annual value**: $84,000\n**Negotiated by**: AI procurement agent\n**Key terms**: 99.9% SLA, 60-day termination notice, data residency AU\n**Legal review**: Passed (no flags)\n**Document**: [Link available in app]",
    "category": "contracts"
  }
}
```

The `signature` type renders a drawing pad. The signed attestation includes the signature image and the signer's biometric verification. Stronger evidence than DocuSign's "someone with access to this email address clicked a button."

---

## HR actions

An HR AI agent processes sensitive employee changes. Some actions require explicit human authorisation.

**Request**:
```json
{
  "type": "select",
  "action": {
    "summary": "Approve termination: Employee ID 4421",
    "description": "**Employee**: [Name redacted in summary - visible in secure view]\n**Department**: Sales\n**Reason**: Performance management - final stage\n**Process followed**: PIP issued 12 Jan, review 12 Mar, final review 15 Jul\n**Notice period**: 4 weeks\n**Payroll impact**: Final pay + accrued leave ($12,400)",
    "rationale": "Termination actions require VP-level human approval per policy HR-107",
    "category": "hr-actions"
  },
  "options": [
    { "key": "approve", "label": "Approve termination" },
    { "key": "extend-pip", "label": "Extend PIP (30 days)" },
    { "key": "hold", "label": "Place on hold - need more info" }
  ]
}
```

---

## What makes OHPP different from existing enterprise approval systems

Most enterprise tools (ServiceNow, Jira, etc.) already have approval workflows. The difference:

| Existing approvals | OHPP |
|-------------------|-----|
| Approval lives inside the tool | Attestation is portable and verifiable externally |
| Agent can click "Approve" in the tool's UI | Agent cannot authenticate on the phone |
| Proof is "user X was logged in when the button was clicked" | Proof is "a human biometrically verified on a separate device" |
| Auditor must trust the tool's integrity | Auditor verifies independently using public keys |
| Locked to one vendor's ecosystem | Interoperable across any tool that speaks OHPP |

---

## Next

- [Smart home and IoT →](05-smart-home.md)
- [Financial services →](01-financial-services.md)
