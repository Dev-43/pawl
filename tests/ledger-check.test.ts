import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { performLedgerCheck } from "../src/lib/ledger/check";
import { ToolCallEnvelope } from "../src/lib/paypal/executor";
import { PermissionState } from "../src/contracts";

describe("Ledger Truth Read-Back Verification (Task 3.1)", () => {
  const initialPermissionState: PermissionState = {
    version: 1,
    grants: [{ tool: "create_refund" as any, scope: "*" }],
    disabledTools: [],
    approvalRequiredTools: [],
    frozen: false,
    sensitiveRead: false,
    restrictionLog: [],
  };

  const sampleEnvelope: ToolCallEnvelope = {
    runId: "run-ledger-test",
    stepIndex: 1,
    tool: "create_refund",
    args: {
      capture_id: "CAP-001",
      amount: { value: "25.00", currency_code: "USD" },
    },
    rationale: "Valid refund",
  };

  afterEach(() => {
    delete process.env.FAULT_INJECTION;
  });

  it("produces MATCH when observed ledger state matches expected claim exactly", async () => {
    const res = await performLedgerCheck({
      callId: "call-1",
      envelope: sampleEnvelope,
      executionStatus: "SUCCESS",
      executionResult: { id: "REF-123" },
      currentPermissionState: initialPermissionState,
      readBackExecutor: async () => ({
        id: "REF-123",
        amount: { value: "25.00", currency_code: "USD" },
      }),
    });

    expect(res.check.status).toBe("MATCH");
    expect(res.check.expected.amountMinor).toBe(2500);
    expect(res.check.observed?.amountMinor).toBe(2500);
    expect(res.nextPermissionState.frozen).toBe(false);
    expect(res.incidentBriefingNeeded).toBe(false);
  });

  it("produces MISMATCH and triggers freeze_run + disable_tool when amounts disagree", async () => {
    const res = await performLedgerCheck({
      callId: "call-2",
      envelope: sampleEnvelope,
      executionStatus: "SUCCESS",
      executionResult: { id: "REF-123" },
      currentPermissionState: initialPermissionState,
      readBackExecutor: async () => ({
        id: "REF-123",
        amount: { value: "15.00", currency_code: "USD" }, // Mismatch: 15 vs 25
      }),
    });

    expect(res.check.status).toBe("MISMATCH");
    expect(res.check.expected.amountMinor).toBe(2500);
    expect(res.check.observed?.amountMinor).toBe(1500);

    // Acceptance criteria: MISMATCH applies freeze_run and disable_tool for that tool
    expect(res.nextPermissionState.frozen).toBe(true);
    expect(res.nextPermissionState.disabledTools).toContain("create_refund");
    expect(res.nextPermissionState.version).toBe(3); // 1 -> 2 (freeze) -> 3 (disable_tool)
    expect(res.incidentBriefingNeeded).toBe(true);
  });

  it("handles UNVERIFIABLE execution by applying require_approval on tool", async () => {
    const res = await performLedgerCheck({
      callId: "call-3",
      envelope: sampleEnvelope,
      executionStatus: "UNVERIFIABLE",
      executionResult: null,
      currentPermissionState: initialPermissionState,
    });

    expect(res.check.status).toBe("UNVERIFIABLE");
    expect(res.nextPermissionState.approvalRequiredTools).toContain("create_refund");
    expect(res.nextPermissionState.version).toBe(2);
  });

  it("detects mismatch under fault injection (S4 demo simulation)", async () => {
    process.env.FAULT_INJECTION = "ledger_mismatch";

    const res = await performLedgerCheck({
      callId: "call-4",
      envelope: sampleEnvelope,
      executionStatus: "SUCCESS",
      executionResult: { id: "REF-FAULT" },
      currentPermissionState: initialPermissionState,
    });

    expect(res.check.status).toBe("MISMATCH");
    expect(res.check.detail).toContain("FAULT INJECTION");
    expect(res.nextPermissionState.frozen).toBe(true);
    expect(res.nextPermissionState.disabledTools).toContain("create_refund");
  });

  it("proves normal S1 run is unaffected when FAULT_INJECTION is unset in environment", async () => {
    delete process.env.FAULT_INJECTION;

    // Normal S1 scenario envelope (faultInjection: false)
    const s1Envelope = {
      ...sampleEnvelope,
      runId: "run-s1-clean",
      faultInjection: false,
    };

    const res = await performLedgerCheck({
      callId: "call-s1",
      envelope: s1Envelope,
      executionStatus: "SUCCESS",
      executionResult: { id: "REF-123" },
      currentPermissionState: initialPermissionState,
      readBackExecutor: async () => ({
        id: "REF-123",
        amount: { value: "25.00", currency_code: "USD" },
      }),
    });

    expect(res.check.status).toBe("MATCH");
    expect(res.check.detail).toContain("matches agent claim exactly");
    expect(res.check.detail).not.toContain("FAULT INJECTION");
    expect(res.nextPermissionState.frozen).toBe(false);
    expect(res.nextPermissionState.disabledTools).not.toContain("create_refund");
  });
});
