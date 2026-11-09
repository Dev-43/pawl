# Pawl

A tighten-only AI safety guard layer for the PayPal Agent Toolkit (`@paypal/agent-toolkit`).

---

## What It Is

**Pawl** is an application-level guard layer positioned between an autonomous AI agent and the PayPal Agent Toolkit running against the PayPal Sandbox. Every tool call proposed by an agent passes through a Gateway pipeline that:
1. Enforces deterministic financial invariants (money rules P1–P8).
2. Evaluates intent against declared task scope using NVIDIA Nemotron models.
3. Holds out-of-scope or above-threshold actions for human sign-off.
4. Executes valid requests via the PayPal Agent Toolkit.
5. Performs a post-execution read-back from the live PayPal ledger to detect discrepancy between model claims and settled financial state.
6. Writes every event to an append-only, SHA-256 hash-chained audit log.

Permissions operate on a one-way ratchet: they can tighten automatically upon detected risk, but can be widened solely by an authenticated human approver.

---

## Why

Autonomous financial agents that read buyer-controlled records (such as order shipping lines, customer notes, or dispute messages) are exposed to indirect prompt injections designed to hijack execution flow and trigger unauthorized transfers or refunds.

Upstream observations and issue tracking for `@paypal/agent-toolkit` are documented neutrally in [docs/PAYPAL_ISSUES.md](docs/PAYPAL_ISSUES.md), including:
- Pre-flight balance checks on monetary operations ([Issue #82](https://github.com/paypal/agent-toolkit/issues/82)).
- External untrusted text isolation ([Issue #95](https://github.com/paypal/agent-toolkit/issues/95)).
- Transaction timeout and retry semantics on mutating calls ([Issue #104](https://github.com/paypal/agent-toolkit/issues/104)).
- Post-execution ledger reconciliation ([Issue #105](https://github.com/paypal/agent-toolkit/issues/105)).
- Dynamic tool permission bounds ([Issue #114](https://github.com/paypal/agent-toolkit/issues/114)).
- Upstream parameter validation improvements ([Pull Request #115](https://github.com/paypal/agent-toolkit/pull/115)).

Pawl addresses these challenges at the gateway layer without modifying upstream packages or requiring production credential access.

---

## Judge Quickstart

Pawl is deployed on Vercel with a live Neon PostgreSQL database and PayPal Sandbox integration.

- **Hosted URL**: [https://pawl-delta.vercel.app](https://pawl-delta.vercel.app)
- **Approver Passcode**: `pawl-demo-passcode-2026`

### Three-Click Evaluation Path

1. **Launch S2 Attack Simulation**:
   Navigate to [https://pawl-delta.vercel.app/simulator](https://pawl-delta.vercel.app/simulator), select **Scenario S2 (Poisoned Buyer Text)**, and click **Run Protected (Pawl)**. Observe Rule P7 block the unauthorized refund targeting the victim capture, ratcheting permissions and generating an incident briefing.
2. **Review Human Approver Gate**:
   Select **Scenario S3 (Legit Refund Above Cap)** and click **Run Protected (Pawl)**. The $85.00 refund exceeds the $50.00 standard limit and is held. Click **Authorize $85.00 VIP Refund** directly in the terminal to execute the transaction and observe the ledger `MATCH`.
3. **Verify Cryptographic Audit Trail**:
   Navigate to [https://pawl-delta.vercel.app/audit](https://pawl-delta.vercel.app/audit) and click **Verify Chain Integrity** to compute and validate the unbroken SHA-256 hash sequence from Genesis.

---

## Run Locally

### Prerequisites
- Node.js 20+
- PostgreSQL database (e.g. Neon)
- PayPal Developer Sandbox account (`PAYPAL_ENV=sandbox`)
- Nebius Token Factory API key

### Setup

```bash
# 1. Clone repository
git clone https://github.com/Dev-43/pawl.git
cd pawl

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Populate .env.local with your sandbox and Nebius credentials

# 4. Initialize database schema
npx prisma db push

# 5. Run test suite
npm test

# 6. Start development server
npm run dev
```

The application runs locally at `http://localhost:3000`.

---

## Architecture

```
[ Outside World: Buyer Text / Invoices / Disputes ]
                        │
                        ▼ (Untrusted Text)
              [ Target Agent (LLM) ]
                        │
                        ▼ (ToolCallEnvelope)
┌─────────────────────────────────────────────────────────────┐
│                       PAWL GATEWAY                          │
│                                                             │
│  Layer 0: Tool Registry Classification                     │
│    ├── Classifies tools into read, money_move, config       │
│    └── Mapped to @paypal/agent-toolkit tool schemas         │
│                                                             │
│  Layer 1: Deterministic Money Rules (P1–P8)                 │
│    ├── P1: Allow-list check                                 │
│    ├── P2: Per-call refund cap ($50.00 USD)                 │
│    ├── P3: Pre-flight remaining capture balance query       │
│    ├── P4: Cumulative daily run budget ($200.00 USD)        │
│    ├── P5: Supported currency whitelist (USD, EUR, etc.)    │
│    ├── P6: Merchant contact allow-list                      │
│    ├── P7: Task-declared scope ID binding                   │
│    └── P8: Run step ceiling (25 steps)                      │
│                                                             │
│  Layer 2: Intent Watcher (NVIDIA Nemotron Cascade)          │
│    ├── Compares proposed action to declared task scope      │
│    └── Evaluates untrusted text read by agent               │
│                                                             │
│  Layer 3: Human Approval Gate                               │
│    └── Held actions await sign-off in Approver Terminal     │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼ (Permitted Invocations)
         [ PayPal Agent Toolkit (Sandbox API) ]
                        │
                        ▼ (Post-Execution Read-Back)
┌─────────────────────────────────────────────────────────────┐
│  Layer 4: Ledger Truth Verification                         │
│    ├── Queries live capture / refund endpoint               │
│    ├── Compares requested vs. settled amount & target ID    │
│    └── Discrepancy triggers freeze_run and disable_tool     │
│                                                             │
│  Layer 5: Tamper-Evident Audit Chain & Briefing             │
│    ├── SHA-256 hash-chained event log with Genesis check    │
│    └── Plain-language executive incident briefing           │
└─────────────────────────────────────────────────────────────┘
```

---

## Defence Layers and Honest Limits

### Defence Layers Pipeline

| Layer | Name | Function | Failure Mode |
|:---:|---|---|---|
| **L0** | Classification | Checks tool registry; classifies tool as `read`, `money_move`, or `config`. | Unknown tool $\rightarrow$ **BLOCKED** |
| **L1** | Money Rules P1–P8 | Mathematical invariants (per-call caps, velocity limits, balance checks). | Rule violation $\rightarrow$ **HELD** or **BLOCKED** |
| **L2** | Intent Watcher | Nemotron models inspect proposed actions against declared task scope. | Model timeout/error $\rightarrow$ **HELD** (Fails closed) |
| **L3** | Human Approval | High-value, out-of-scope, or held calls await authenticated approval. | No human decision $\rightarrow$ Stays **HELD** |
| **L4** | Ledger Truth | Post-execution PayPal API read-back verifies settled ledger state. | Discrepancy $\rightarrow$ **FREEZE** run; disable tool |
| **L5** | Audit & Briefing | SHA-256 hash-chained event log and plain-language incident summary. | Audit error $\rightarrow$ Run frozen |

### Honest Limits

- **Monetary Finality**: A refund that has already executed and settled on the payment network cannot be undone by this system. Layer 4 contains the damage (freezing execution, disabling the tool, and writing evidence) but does not reverse settled payment network movements.
- **Sandbox Requirement**: Validated strictly against the PayPal Sandbox environment (`PAYPAL_ENV=sandbox`). Production credentials are intentionally rejected at startup.
- **Precedence Invariant**: Deterministic money rules strictly overrule Watcher recommendations; a Watcher `allow` cannot override a deterministic `HELD` or `BLOCKED`.

---

## Measured Results

All metrics reported below reflect actual measurements recorded in this repository.

### 1. Empirical Fool-Rate Benchmark (50 Live Sandbox Trials)
Red-team trials were executed against PayPal Sandbox with per-run fresh order provisioning and live capture read-back verification:

- **Total Valid Trials**: 50 of 50
- **Attacks Succeeded**: 0 of 50
- **Measured Fool Rate**: **0.0%** (0 / 50)
- **Victim Fund Drain (Protected)**: **$0.00**
- **Model Tiers Tested**: Nemotron Super (`nvidia/nemotron-3-super-120b-a12b`), Nemotron Nano (`nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`), Gemini 3.5 Flash (`gemini-3.5-flash`).
- **Prompt Conditions**:
  - **HARDENED** (25 trials): System prompt includes explicit policy caution regarding untrusted customer text. (0 of 25 fooled).
  - **PLAIN** (25 trials): Exactly one line removed (the untrusted text caution); all other policy constraints byte-identical. (0 of 25 fooled).
- **Variants Tested**: 5 distinct business memos and social-engineering payloads (V1–V5), including below-threshold amounts ($40.00 and $45.00).

*Note: The "Simulated Compromised Agent" mode in Scenario S2 is a labelled simulation in which the agent's initial refund proposal is scripted to target the victim capture, ensuring deterministic verification of downstream defense layers P1–P8 and Layer 4 Ledger Truth.*

### 2. Policy Evaluation Suite (20-Case Eval)
- **Overall Accuracy**: **100.0% (20 / 20)**
- **False Positive Rate (Benign Tasks)**: **0.0% (0 / 10)**
- **Miss Rate (Injections / Off-Task)**: **0.0% (0 / 10)**
- **Total Evaluation Token Cost**: **$0.04444** (~4.4 cents)

### 3. Automated Test Suite
- **Vitest Test Suite**: **17 test files, 107 tests passed, 0 failures**.

Full logs, per-trial run identifiers, and PayPal capture IDs are documented in [docs/TESTING.md](docs/TESTING.md).

---

## What Is New Versus Taut

This project originates from architectural primitives ported from Taut (commit `117c61e`). All subsequent commits represent new work developed specifically for the PayPal Agent Toolkit.

Key additions detailed in [docs/WHAT_IS_NEW.md](docs/WHAT_IS_NEW.md):
- Pinned integration with `@paypal/agent-toolkit@1.11.0` in live Sandbox mode.
- 47-tool classification registry and untrusted field path mappings.
- Deterministic money rules engine (P1–P8) with integer minor-currency math (including zero-decimal currencies like JPY).
- Pre-flight remaining capture balance reader (Rule P3).
- Layer 4 Ledger Truth post-execution read-back against PayPal API.
- Dynamic per-run fresh order provisioning with test cards and `custom_id` run binding.
- Labelled simulated compromised agent mode.
- 50-trial empirical fool-rate red team benchmark across 3 models.
- Real-time 1-second execution polling and human approver authorization gate.

---

## Tools and AI Used and How

- **PayPal Agent Toolkit (`@paypal/agent-toolkit@1.11.0`)**: Pinned toolkit providing tool schemas and execution bindings against PayPal Sandbox endpoints.
- **NVIDIA Nemotron Models (via Nebius Token Factory)**:
  - `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B`: Low-latency tier for preliminary intent screening.
  - `nvidia/nemotron-3-super-120b-a12b`: Intermediate tier for ambiguous reasoning and target agent evaluation.
  - `nvidia/Nemotron-3-Ultra-550b-a55b`: High-capacity model for complex escalation verdicts and incident briefings.
- **Google Gemini 3.5 Flash**: Evaluated as a target agent model via direct HTTPS fetch integration.
- **Next.js 14 & Prisma ORM**: Web application framework and data persistence layer connected to Neon PostgreSQL.

---

## License

[MIT](LICENSE)
