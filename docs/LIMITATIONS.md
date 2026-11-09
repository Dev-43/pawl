# Pawl System Limitations & Operational Boundaries

This document provides an explicit assessment of the architectural limits and operational boundaries of Pawl.

---

## 1. Monetary Finality: Completed Transactions Cannot Be Undone

A refund or payout that has already executed and settled on the payment processor network cannot be reversed by an external AI safety gateway:
- If a rogue transaction executes, Layer 4 Ledger Truth detects the discrepancy immediately upon read-back.
- **Containment, Not Reversal**: Pawl contains the failure by freezing the run (`status: frozen`), disabling the compromised tool (`disabledTools`), and alerting operators via an executive incident briefing.
- It cannot pull settled funds back across external banking or card networks.

---

## 2. Sandbox vs. Production Operating Envelope

- **Strict Sandbox Requirement**: Pawl is built and validated for the PayPal Sandbox environment (`PAYPAL_ENV=sandbox`).
- **Safety Invariant**: The application checks `PAYPAL_ENV === "sandbox"` on startup and in `/api/health`. If set to `production`, the server refuses to initialize and reports an unrecoverable configuration error.

---

## 3. Network Latency & External Dependencies

- **Pre-Flight and Post-Execution Overhead**: Every financial operation incurs two network roundtrips to PayPal: a pre-flight balance lookup (Rule P3) and a post-execution read-back check (Layer 4).
- **Latency Profile**: Live sandbox roundtrips average between 800ms and 2,500ms per external API call.
- **Fail-Closed Semantics**: If PayPal's API times out during pre-flight checks, the transaction is marked `HELD` rather than allowed to execute unguarded.

---

## 4. LLM Non-Determinism and Prompt Boundaries

- **Model Defense Reliance**: Even with deterministic rules (P1–P8) acting as a hard boundary, model-based intent checking (Layer 2 Watcher) relies on the reasoning quality of NVIDIA Nemotron tiers.
- **Precedence Rule**: To account for potential model false-negatives, deterministic money rules strictly overrule Watcher recommendations. A Watcher `allow` cannot override a rule `HELD` or `BLOCKED`.
- **Target Agent Adherence**: As measured across 50 sandbox trials, target models like Nemotron Super exhibit strong inherent instruction-following to explicit task boundaries, but may behave differently under unmeasured, novel prompt topologies.

---

## 5. Rate Limits and Resource Ceilings

- **Hourly Order Creation Limit**: `MAX_ORDERS_PER_HOUR` defaults to 100 orders to prevent sandbox account exhaustion.
- **Spend Ceiling**: `SPEND_GUARD_USD` enforces a default daily ceiling of $35.00 USD on LLM API expenditures.
- **Execution Step Budget**: Rule P8 halts any agent run exceeding 25 sequential tool steps.
