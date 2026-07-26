# Healthcare

## Why healthcare needs participation proof

Healthcare decisions carry irreversible consequences. A wrong medication dosage, a missed allergy flag, a consent form that nobody actually read. Regulations (FDA 21 CFR Part 11, HIPAA, EU MDR) already require evidence of human oversight in clinical workflows.

As AI agents enter healthcare (clinical decision support, automated ordering, patient communication), the question becomes: how do you prove a clinician actually reviewed and approved an AI's recommendation?

Current approach: audit logs that say "Dr. Smith clicked Approve at 14:32." Problem: Dr. Smith's agent clicked it. Or Dr. Smith was in a different tab. Or the system auto-advanced after a timeout. The log says it happened. It cannot prove participation.

---

## Medication approval

An AI clinical decision support system recommends a medication change for a patient. The hospital system uses OHPP to confirm the prescribing clinician actually reviewed it.

**Request**:
```json
{
  "type": "select",
  "action": {
    "summary": "Approve prescription change for Patient #4821",
    "description": "**Patient**: Maria Santos, 67F\n**Current**: Metformin 500mg twice daily\n**Proposed**: Metformin 1000mg twice daily\n**Reason**: HbA1c increased from 6.8 to 7.4 over 3 months\n**AI confidence**: High (guideline-concordant)\n**Allergies**: Penicillin, Sulfa",
    "rationale": "Clinical guideline ADA-2025 recommends dose increase when HbA1c exceeds 7.0 with no contraindications",
    "category": "prescriptions"
  },
  "options": [
    { "key": "approve", "label": "Approve as recommended" },
    { "key": "modify", "label": "Modify prescription", "freeText": true, "placeholder": "Enter modified prescription" },
    { "key": "reject", "label": "Reject - no change" },
    { "key": "defer", "label": "Defer to specialist" }
  ]
}
```

The attestation proves Dr. Smith saw the patient details, the proposed change, the reasoning, and made a deliberate choice. Not that their agent auto-approved it at 3am.

---

## Surgical consent

Before a procedure, the hospital needs proof the patient (or legal representative) understood and agreed to the risks. Consent forms exist, but an agent could fill them out.

**Request**:
```json
{
  "type": "select",
  "action": {
    "summary": "Consent: right knee arthroscopy on 15 Aug 2026",
    "description": "**Procedure**: Right knee arthroscopy (meniscus repair)\n**Surgeon**: Dr. James Chen\n**Hospital**: St Vincent's, Ward 4B\n**Risks discussed**: Infection (<1%), blood clots (<0.5%), nerve damage (<0.1%), anaesthesia complications\n**Recovery**: 2-4 weeks non-weight-bearing, 6-8 weeks to full activity\n**Alternatives**: Physiotherapy (conservative), total knee replacement (more invasive)",
    "rationale": "Patient must confirm understanding of procedure, risks, and alternatives before scheduling",
    "category": "consent"
  },
  "options": [
    { "key": "consent", "label": "I understand and consent" },
    { "key": "questions", "label": "I have questions (do not proceed)" }
  ]
}
```

The signed attestation, timestamped and biometric-verified, provides stronger evidence of informed consent than a signature on a PDF.

---

## Triage override

An AI triage system in an emergency department categorises patients by severity. When a clinician disagrees with the AI's assessment, that override should be documented with proof of human judgment.

**Request**:
```json
{
  "type": "select",
  "action": {
    "summary": "Override triage: Patient #7102 from Category 3 to Category 2?",
    "description": "**Patient**: Male, 45, chest pain\n**AI assessment**: Category 3 (urgent, 30-min target)\n**Your assessment**: Category 2 (emergency, 10-min target)\n**AI reasoning**: Vitals stable, no cardiac history, pain score 5/10\n**Override reason required**",
    "category": "triage"
  },
  "options": [
    { "key": "confirm-override", "label": "Confirm upgrade to Cat 2", "freeText": true, "placeholder": "Clinical reasoning for override", "validation": { "required": true, "min": 10 } },
    { "key": "accept-ai", "label": "Accept AI assessment (Cat 3)" }
  ]
}
```

The attestation captures the clinician's reasoning alongside their override decision. Useful for clinical governance reviews, incident investigations, and training data for the AI system.

---

## What OHPP provides for healthcare

| Need | How OHPP addresses it |
|------|---------------------|
| Regulatory compliance (FDA, HIPAA) | Signed, timestamped, verifiable proof of human review |
| Clinical accountability | Attestation ties a specific clinician to a specific decision |
| AI oversight evidence | Proves the human reviewed the AI's output, not just rubber-stamped it |
| Audit durability | Attestations verifiable years later without contacting the original system |
| Multi-institution verification | External auditors verify attestations against public keys without system access |

---

## Limitations to acknowledge

OHPP proves a human participated. It does not prove they:
- Read the full description carefully
- Understood the clinical implications
- Were free from fatigue or cognitive overload
- Spent adequate time considering alternatives

These are UX and workflow design concerns. The protocol provides the plumbing. How a healthcare system uses it (timing of requests, information presented, workload management) determines whether the participation is meaningful.

---

## Next

- [Enterprise and SaaS →](04-enterprise.md)
- [Smart home and IoT →](05-smart-home.md)
