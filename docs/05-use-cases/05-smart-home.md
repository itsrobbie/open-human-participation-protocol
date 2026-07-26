# Smart home and IoT

## When your home has an agent

Smart home devices already act autonomously: thermostats adjust temperature, lights follow schedules, locks auto-engage. AI agents take this further: "Optimise my energy usage," "Let the cleaner in on Tuesdays," "Order replacement filters when they're low."

Most of these actions are fine without human involvement. But some have physical-world consequences that warrant a check. Unlocking a door. Disabling a security camera. Turning off smoke detection for "cooking mode." Granting a new device network access.

---

## Door lock control

A home AI agent decides to unlock the front door because a delivery is expected. The smart lock system uses OHPP for physical access decisions.

**Request**:
```json
{
  "type": "select",
  "action": {
    "summary": "Unlock front door for delivery?",
    "description": "**Reason**: Agent detected delivery notification from AusPost\n**Tracking**: AP4821003344\n**Door**: Front door (Street-facing)\n**Duration**: Agent requests 10 minutes unlocked\n**Camera**: Doorbell camera is active",
    "category": "access"
  },
  "options": [
    { "key": "unlock-10", "label": "Unlock for 10 minutes" },
    { "key": "unlock-5", "label": "Unlock for 5 minutes" },
    { "key": "deny", "label": "Keep locked" }
  ],
  "expiry": "2026-07-15T14:35:00Z"
}
```

The request expires because the delivery window is time-sensitive. If the human doesn't respond, the door stays locked. The attestation records whether the human unlocked it (and for how long), or the request expired unanswered.

---

## Security system changes

An agent wants to disable motion detection in the living room because the user's calendar shows a party tonight.

**Request**:
```json
{
  "type": "select",
  "action": {
    "summary": "Disable living room motion alerts until midnight?",
    "description": "**Reason**: Calendar event 'House Party' detected (7pm-12am)\n**Affected zones**: Living room, kitchen, hallway\n**Unaffected**: Bedrooms, garage, exterior\n**Auto-restore**: 12:00am tonight",
    "category": "security"
  },
  "options": [
    { "key": "disable-all", "label": "Disable alerts (living, kitchen, hallway)" },
    { "key": "disable-living", "label": "Disable living room only" },
    { "key": "deny", "label": "Keep all alerts active" }
  ]
}
```

---

## Energy management

An energy optimisation agent wants to pre-cool the house using off-peak electricity, but this means running the AC at 3am (noise implications for light sleepers).

**Request**:
```json
{
  "type": "select",
  "action": {
    "summary": "Pre-cool house tonight (3am-5am) to save $4.20?",
    "description": "**Tomorrow's forecast**: 38C\n**Strategy**: Cool to 22C during off-peak ($0.08/kWh) instead of running AC during peak ($0.42/kWh)\n**Noise**: AC outdoor unit will run for ~2 hours\n**Savings**: Estimated $4.20 vs cooling during peak tomorrow",
    "category": "energy"
  },
  "options": [
    { "key": "approve", "label": "Pre-cool tonight" },
    { "key": "approve-quiet", "label": "Pre-cool (quiet mode only)" },
    { "key": "deny", "label": "Skip - cool tomorrow as needed" }
  ]
}
```

---

## Guest access

A recurring situation: someone needs temporary access to the home, and the agent handles the logistics.

**Request**:
```json
{
  "type": "select",
  "action": {
    "summary": "Grant cleaner access: Tuesday 9am-12pm?",
    "description": "**Who**: Sarah's Cleaning (recurring booking)\n**When**: Tuesday 22 Jul, 9:00am - 12:00pm\n**Access**: Front door code + disarm alarm\n**History**: 14 previous visits, no issues\n**Cameras**: Indoor cameras will be deactivated during visit",
    "category": "access"
  },
  "options": [
    { "key": "grant", "label": "Grant access as usual" },
    { "key": "grant-cameras", "label": "Grant access (keep cameras on)" },
    { "key": "deny", "label": "Cancel this visit" }
  ]
}
```

---

## Auto-approve rules in practice

Smart home is where auto-approve rules become most practical. A user might set:

- "Auto-approve front door unlock for deliveries between 8am-6pm when doorbell camera is active"
- "Auto-approve pre-cooling if savings exceed $3"
- "Auto-approve cleaner access for recurring bookings with 10+ previous visits"
- "Never auto-approve security system changes"

When auto-approve fires, the attestation records `resolution.method: "auto-approved"` and `autoApproveRule` describing which rule matched. The human still has visibility in their participation history, and can revise rules if the agent is approving things they'd rather review.

---

## IoT device registration

New IoT devices joining the network is a security-sensitive action. An agent that manages device onboarding can use OHPP for the approval step.

**Request**:
```json
{
  "type": "select",
  "action": {
    "summary": "Allow new device on network: 'Xiaomi Air Purifier'?",
    "description": "**Device**: Xiaomi Air Purifier 4 Pro\n**MAC**: A4:CF:12:xx:xx:48\n**Detected**: 2 minutes ago\n**Network**: IoT VLAN (isolated from main network)\n**Manufacturer verified**: Yes (Xiaomi OUI match)",
    "category": "network"
  },
  "options": [
    { "key": "allow", "label": "Allow on IoT network" },
    { "key": "allow-main", "label": "Allow on main network" },
    { "key": "block", "label": "Block device" }
  ]
}
```

---

## Next

- [Financial services →](01-financial-services.md)
- [E-commerce →](02-ecommerce.md)
