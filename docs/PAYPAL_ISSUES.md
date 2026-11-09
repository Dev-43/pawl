# Upstream `@paypal/agent-toolkit` Observations & Tracking

This document catalogues observed operational characteristics and public tracking items from the upstream [`@paypal/agent-toolkit`](https://github.com/paypal/agent-toolkit) repository. Pawl acts as an external, tighten-only guard layer positioned around toolkit calls without modifying upstream packages.

---

## Tracked Issues and Upstream PRs

### [Issue #82](https://github.com/paypal/agent-toolkit/issues/82): Pre-Flight Balance and Refund Bounds
- **Summary**: Toolkit execution exposes payment actions without built-in pre-flight validation against remaining unrefunded capture balances.
- **Pawl Mitigation**: Deterministic Rule P3 queries capture status pre-flight via PayPal REST API and blocks any refund request that exceeds the remaining balance.

### [Issue #95](https://github.com/paypal/agent-toolkit/issues/95): External Untrusted Text Propagation
- **Summary**: Buyer-controlled strings (shipping address lines, customer notes, dispute messages) pass directly into agent context where models can interpret them as system instructions.
- **Pawl Mitigation**: Layer 0 maps all external text fields; Layer 2 Nemotron Watcher explicitly tracks untrusted text provenance and evaluates intent against declared task scope.

### [Issue #104](https://github.com/paypal/agent-toolkit/issues/104): Timeout Handling on Payment Mutation Tools
- **Summary**: Network timeouts on mutating payment calls leave transaction status ambiguous if automated retries are attempted.
- **Pawl Mitigation**: Safety invariant 5 enforces that the executor never auto-retries a `money_move` call; ambiguous responses are marked `UNVERIFIABLE` and held for human resolution.

### [Issue #105](https://github.com/paypal/agent-toolkit/issues/105): Post-Execution Ledger Read-Back Reconciliation
- **Summary**: Toolkit does not natively read back post-execution settlement status to detect divergence between agent claims and processor truth.
- **Pawl Mitigation**: Layer 4 Ledger Truth performs an immediate read-back query to PayPal after execution, freezing the run if amounts, currencies, or targets disagree.

### [Issue #114](https://github.com/paypal/agent-toolkit/issues/114): Dynamic Permission Bounds and Confinement
- **Summary**: All registered tools remain callable throughout a session with no automated mechanism to restrict capabilities upon anomalous behavior.
- **Pawl Mitigation**: Monotonic one-way permission ratchet automatically downgrades tools from autonomous execution to `require_approval` or `disabledTools` upon policy violations.

### [Pull Request / Issue #115](https://github.com/paypal/agent-toolkit/pull/115): Parameter Validation and Structured Error Propagation
- **Summary**: Proposed upstream fix improving argument schema validation and surfacing structured error payloads from underlying PayPal SDK calls.
- **Pawl Relationship**: Pawl operates independently of upstream PR merges by validating input types in minor currency units (integers) and wrapping toolkit execution in isolated try/catch boundaries.
