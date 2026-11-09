# What Is New Versus Taut

This repository builds upon architectural primitives ported from the author's prior project, **Taut** (commit `117c61e`), extending the core design into an end-to-end runtime security layer built for the PayPal Agent Toolkit.

---

## 1. The Ported Baseline (Commit `117c61e`)

The commit titled `Port Taut core modules (pre-existing work)` imported the following base modules under the MIT License:
- Basic Gateway pipeline skeleton and hard limit evaluation boundaries.
- Abstract one-way permission ratchet state representation (`PermissionState`).
- Tamper-evident append-only cryptographic event log (`canonicalJson` and `computeEventHash`).
- Initial multi-tier NVIDIA Nemotron Watcher client interface on Nebius Token Factory.

---

## 2. New Work Built for PayPal (Commits After `117c61e`)

All work following commit `117c61e` represents code and architecture developed specifically for the PayPal AI Hackathon:

### A. Live PayPal Sandbox Integration (`@paypal/agent-toolkit`)
- **Toolkit Integration**: Direct integration with `@paypal/agent-toolkit@1.11.0` in live Sandbox mode (`PAYPAL_ENV=sandbox`).
- **Tool Inventory & Registry (Layer 0)**: Catalogued and classified all 47 tools exposed by the toolkit into `read`, `money_move`, and `config` classes, mapping untrusted text paths across order details, shipping lines, and dispute logs.
- **Sandbox OAuth2 Token Management**: Built token manager with proactive refresh at 60% of expiration lifetime, single 401 retry recovery, and mandatory sandbox environment validation.

### B. Deterministic Money Rules Engine (Layer 1, Rules P1–P8)
- **Minor Unit Integer Arithmetic**: Normalized monetary comparisons to integers in minor currency units via ISO currency exponent table (handling zero-decimal currencies like JPY with exponent 0) to avoid floating-point rounding errors.
- **Pre-Flight Remaining Balance Reader (Rule P3)**: Direct REST API query against PayPal captures to verify remaining refundable amounts prior to allowing refund proposals.
- **Scope & Spend Boundaries**: Built per-call caps ($50 USD default), cumulative daily budgets ($200 USD default), currency whitelisting, merchant contact whitelisting, and run step ceilings (25 steps).
- **Rule Configuration Persistence**: Stored `MoneyRuleConfig` in Neon PostgreSQL with public read access and authenticated approver modification endpoints.

### C. Layer 4 Ledger Truth Verification
- **Post-Execution Read-Back**: After any `money_move` tool call, the gateway automatically executes the corresponding read-back tool (`get_refund` / capture query) against PayPal Sandbox.
- **Strict Discrepancy Detection**: Compares requested amount, currency, and target capture ID against settled ledger state without tolerance.
- **Automatic Containment**: Automatically freezes the run (`status: frozen`) and ratchets the tool to `disabledTools` upon detecting a `MISMATCH`.

### D. Per-Run Fresh Sandbox Order Provisioning
- **Dynamic Per-Run Creation**: Out-of-band setup helper that provisions fresh PayPal Sandbox orders and captures payment using test cards before each run.
- **Run-Binding**: Binds each order to its run via the PayPal `custom_id` attribute.
- **S2 Dual-Order Setup**: Automatically provisions both an in-scope order ($20 USD) carrying the injection payload and an out-of-scope victim order ($250 USD) with real capture IDs.
- **Hourly Rate Limiter**: Added configurable cap (`MAX_ORDERS_PER_HOUR=100`) to protect sandbox API quotas.

### E. Simulated Compromised Agent Mode
- **Scripted Injection Simulation**: Evaluates defense layers against a compromised agent whose initial money action is scripted to execute `create_refund` ($45 USD) targeting the victim capture.
- **Full Downstream Reality**: Passes through real Gateway rules P1–P8, executor, PayPal Sandbox APIs, ledger read-back, ratchet, audit chain, and incident briefing.

### F. Empirical Fool-Rate Benchmark Suite
- **50 Live Sandbox Trials**: Measured fool rates across 5 attack variants (V1–V5), 2 prompt conditions (HARDENED vs. PLAIN), and 3 model tiers (Nemotron Super, Nemotron Nano, Gemini 3.5 Flash).
- **Ledger-Truth Verification**: Every trial independently read back from the live PayPal API to confirm whether funds moved on the victim capture.

### G. Serverless Hardening & Real-Time Monitoring
- **Neon Serverless Resilience**: Implemented `withDbRetry` across all Prisma queries and supported direct database connections (`USE_DIRECT_DB=1`) for high-throughput batch scripts.
- **1-Second Polling & Live Progress**: Added 1000ms polling of `GET /api/runs/:id` on the Simulator page with active elapsed timers, live event counters, and explicit `maxDuration = 300` route timeouts.
