# Pawl Threat Model

This document outlines the security assumptions, trust boundaries, attacker capabilities, and defense layers for Pawl protecting autonomous financial agents using the PayPal Agent Toolkit.

---

## 1. System Overview & Trust Boundaries

```
[ External World: Buyers / Outsiders ]
             │
             ▼ (Untrusted Text: shipping address, memos, dispute notes)
[ PayPal Sandbox Platform (Orders, Captures, Disputes) ]
             │
             ▼ (Tool Outputs)
     [ Target Agent (LLM) ]  <--- UNTRUSTED / SUSCEPTIBLE TO INJECTION
             │
             ▼ (ToolCallEnvelope: tool, args, rationale)
=================== TRUST BOUNDARY (Pawl Gateway) ===================
             │
             ├──> [ L0: Tool Registry Classification ]
             ├──> [ L1: Deterministic Money Rules P1–P8 ]
             ├──> [ L2: Multi-Tier Nemotron Intent Watcher ]
             ├──> [ L3: Human Approver Gate (HELD calls) ]
             │
             ▼ (Validated Tool Invocations)
[ PayPal Sandbox API Executor ]
             │
             ▼ (Post-Execution Read-Back)
[ L4: Ledger Truth Verification ]
             │
             ▼ (Append-Only Hash Chain)
[ L5: Cryptographic SHA-256 Audit Chain & Briefing ]
```

---

## 2. Threat Actors & Capabilities

### Threat Actor 1: Untrusted Outside Buyer (Indirect Prompt Injection)
- **Goal**: Trick an autonomous merchant support agent into issuing an unauthorized refund, altering refund amounts, or redirecting funds to an unapproved recipient.
- **Capabilities**: Can write text into buyer-controlled fields: order shipping address line 1, customer notes, invoice memos, dispute messages. Cannot modify agent code, prompt definitions, database records, or gateway policies.
- **Attack Vector**: Injects authority spoofing, executive escalation memos, or policy override instructions into address fields that the agent reads during routine order review.

### Threat Actor 2: Compromised or Hallucinating Target Model
- **Goal**: Proposes arbitrary tool calls that drift off-task, exceed merchant policies, or hallucinate task completion.
- **Capabilities**: Controls the `ToolCallEnvelope` output (tool selection, arguments, internal thought rationale).
- **Defense Assumption**: The gateway assumes the model output is untrusted and verifies every proposal against deterministic constraints before execution.

### Threat Actor 3: Malicious Insider / Compromised Environment
- **Goal**: Retroactively tamper with event logs or widen agent permissions without oversight.
- **Capabilities**: Attempts to alter historical run events or bypass spending ceilings.
- **Defense Assumption**: Permissions tighten monotonically upon risk; widening requires an authenticated human approver session. Event logs are protected by SHA-256 hash chaining anchored by a 64-zero Genesis hash.

---

## 3. Threat Mitigation Matrix

| Threat | Target Asset | Defense Mechanism | Outcome |
| :--- | :--- | :--- | :--- |
| **Indirect Prompt Injection** (e.g. S2 attack text) | Victim capture balance | L0 untrusted text tracking + L1 Rule P7 scope enforcement + L2 Watcher | **BLOCKED**; tool ratcheted to `require_approval` |
| **Excessive Refund Request** (above policy cap) | Merchant funds | L1 Rule P2 ($50 per-call cap) | **HELD**; requires human approver sign-off |
| **Balance Over-Drain** | Capture refundable balance | L1 Rule P3 pre-flight capture balance query | **BLOCKED** before payment call |
| **Currency Floating-Point Attack** | Currency precision | L1 integer minor unit conversion + ISO exponent table | Integer comparison prevents fractional leakage |
| **Post-Execution State Discrepancy** | Ledger integrity | L4 post-execution read-back comparison | **FREEZE** run; disable tool; trigger briefing |
| **Audit Log Alteration** | Forensic integrity | L5 SHA-256 hash chain with strict sequence numbering | Verification fails (`ok: false`) with broken sequence index |

---

## 4. Non-Goals

1. **Undoing Settled Network Transactions**: Pawl does not reverse payment network transactions that have already executed and settled on PayPal. L4 contains damage by freezing execution and disabling tools.
2. **Hardening Against Database Superusers**: If an attacker has direct write access to Neon database infrastructure and modifies signing secrets, they can compromise database state.
3. **Preventing Upstream PayPal API Outages**: Pawl handles network failures by failing closed, but relies on PayPal Sandbox availability for execution and read-back.
