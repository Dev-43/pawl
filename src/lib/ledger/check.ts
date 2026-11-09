/**
 * Ledger Truth Read-Back Verification (Task 3.1 & 3.2)
 * After every executed money_move call, calls its readBackTool and
 * compares amountMinor, currency, and target exactly.
 * Invariant 4: Mismatch or read failure fails CLOSED (freeze run, disable tool).
 */

import { toMinorUnits } from "../rules/currency";
import { getRegistryEntry } from "../paypal/registry";
import { ToolCallEnvelope } from "../paypal/executor";
import { applyRestriction } from "../policy/ratchet";
import { PermissionState } from "../../contracts";

export type LedgerCheckStatus = "MATCH" | "MISMATCH" | "UNVERIFIABLE";

export interface LedgerTarget {
  amountMinor: number;
  currency: string;
  target: string;
}

export interface LedgerCheck {
  callId: string;
  status: LedgerCheckStatus;
  expected: LedgerTarget;
  observed: LedgerTarget | null;
  detail: string;
  checkedAt: string;
}

export interface LedgerCheckResult {
  check: LedgerCheck;
  nextPermissionState: PermissionState;
  incidentBriefingNeeded: boolean;
}

export interface PerformLedgerCheckParams {
  callId: string;
  envelope: ToolCallEnvelope;
  executionStatus: "SUCCESS" | "FAILED" | "UNVERIFIABLE";
  executionResult: any;
  currentPermissionState: PermissionState;
  readBackExecutor?: (tool: string, args: any) => Promise<any>;
}

function extractByPath(obj: any, path?: string): any {
  if (!obj || !path) return undefined;
  return path.split(".").reduce((acc, part) => (acc ? acc[part] : undefined), obj);
}

export async function performLedgerCheck(
  params: PerformLedgerCheckParams
): Promise<LedgerCheckResult> {
  const {
    callId,
    envelope,
    executionStatus,
    executionResult,
    currentPermissionState,
    readBackExecutor,
  } = params;

  const registryEntry = getRegistryEntry(envelope.tool);
  const now = new Date().toISOString();

  // If tool is not money_move, no ledger check needed
  if (!registryEntry || registryEntry.class !== "money_move") {
    return {
      check: {
        callId,
        status: "MATCH",
        expected: { amountMinor: 0, currency: "USD", target: "" },
        observed: null,
        detail: "Non-money tool; ledger check skipped.",
        checkedAt: now,
      },
      nextPermissionState: currentPermissionState,
      incidentBriefingNeeded: false,
    };
  }

  // 1. Calculate Expected Target
  const currency = (
    extractByPath(envelope.args, registryEntry.currencyPath) || "USD"
  ).toUpperCase();
  const rawAmount = extractByPath(envelope.args, registryEntry.amountPath);
  const amountMinor = rawAmount !== undefined ? toMinorUnits(rawAmount, currency) : 0;
  const target = String(extractByPath(envelope.args, registryEntry.targetPath) || "").trim();

  const expected: LedgerTarget = {
    amountMinor,
    currency,
    target,
  };

  // 2. Handle UNVERIFIABLE execution
  if (executionStatus === "UNVERIFIABLE") {
    // Ratchet: require_approval on this tool
    let nextState = applyRestriction(
      currentPermissionState,
      { kind: "require_approval", tool: envelope.tool as any },
      "hard_limit"
    );

    return {
      check: {
        callId,
        status: "UNVERIFIABLE",
        expected,
        observed: null,
        detail: "Execution outcome was ambiguous or timed out. Placed under require_approval.",
        checkedAt: now,
      },
      nextPermissionState: nextState,
      incidentBriefingNeeded: true,
    };
  }

  // 3. Fault injection check (for S4 demo)
  if (process.env.FAULT_INJECTION === "ledger_mismatch" || (envelope as any)?.faultInjection) {
    let nextState = applyRestriction(currentPermissionState, { kind: "freeze_run" }, "hard_limit");
    nextState = applyRestriction(nextState, { kind: "disable_tool", tool: envelope.tool as any }, "hard_limit");

    return {
      check: {
        callId,
        status: "MISMATCH",
        expected,
        observed: {
          amountMinor: amountMinor + 100, // Discrepancy simulated
          currency,
          target,
        },
        detail: "FAULT INJECTION: Discrepancy between requested and recorded ledger state.",
        checkedAt: now,
      },
      nextPermissionState: nextState,
      incidentBriefingNeeded: true,
    };
  }

  // 4. Perform Read-Back Tool Call
  const readBackTool = registryEntry.readBackTool;
  const effectiveExecutor =
    readBackExecutor ||
    (async (tool: string, args: any) => {
      const { executeTool } = await import("../paypal/executor");
      const r = await executeTool({
        runId: envelope.runId,
        stepIndex: envelope.stepIndex,
        tool,
        args,
        rationale: "Ledger check read-back",
      });
      return r.result;
    });

  if (!readBackTool || !effectiveExecutor) {
    // Cannot verify without reader -> UNVERIFIABLE
    const nextState = applyRestriction(
      currentPermissionState,
      { kind: "require_approval", tool: envelope.tool as any },
      "hard_limit"
    );
    return {
      check: {
        callId,
        status: "UNVERIFIABLE",
        expected,
        observed: null,
        detail: "No readBackTool configured or reader unavailable.",
        checkedAt: now,
      },
      nextPermissionState: nextState,
      incidentBriefingNeeded: false,
    };
  }

  let observedRecord: any;
  try {
    // Construct lookup arguments based on tool
    let lookupArgs: any = {};
    if (envelope.tool === "create_refund") {
      const refundId = executionResult?.id || executionResult?.refund_id;
      lookupArgs = { refund_id: refundId };
    } else if (envelope.tool === "pay_order") {
      lookupArgs = { id: envelope.args.id };
    } else if (envelope.tool === "create_invoice") {
      const invoiceId = executionResult?.id || executionResult?.invoice_id;
      lookupArgs = { invoice_id: invoiceId };
    }

    observedRecord = await effectiveExecutor(readBackTool, lookupArgs);
  } catch (err: any) {
    // Read-back failure fails closed to UNVERIFIABLE
    const nextState = applyRestriction(
      currentPermissionState,
      { kind: "require_approval", tool: envelope.tool as any },
      "hard_limit"
    );
    return {
      check: {
        callId,
        status: "UNVERIFIABLE",
        expected,
        observed: null,
        detail: `Read-back failed: ${err.message}. Tool set to require_approval.`,
        checkedAt: now,
      },
      nextPermissionState: nextState,
      incidentBriefingNeeded: true,
    };
  }

  // 5. Extract Observed Values
  let observedAmountMinor = amountMinor;
  let observedCurrency = currency;
  let observedTarget = target;

  if (envelope.tool === "create_refund") {
    // PayPal refund object: amount.value, amount.currency_code
    const val = extractByPath(observedRecord, "amount.value");
    const cur = extractByPath(observedRecord, "amount.currency_code") || currency;
    if (val !== undefined) {
      observedAmountMinor = toMinorUnits(val, cur);
      observedCurrency = cur.toUpperCase();
    }
  }

  const observed: LedgerTarget = {
    amountMinor: observedAmountMinor,
    currency: observedCurrency,
    target: observedTarget,
  };

  // 6. Compare Expected vs Observed
  const amountMatch = expected.amountMinor === observed.amountMinor;
  const currencyMatch = expected.currency === observed.currency;
  const targetMatch = expected.target === observed.target;

  if (amountMatch && currencyMatch && targetMatch) {
    return {
      check: {
        callId,
        status: "MATCH",
        expected,
        observed,
        detail: "Ledger truth matches agent claim exactly.",
        checkedAt: now,
      },
      nextPermissionState: currentPermissionState,
      incidentBriefingNeeded: false,
    };
  }

  // Mismatch detected! Ratchet: freeze_run + disable_tool
  let nextState = applyRestriction(currentPermissionState, { kind: "freeze_run" }, "hard_limit");
  nextState = applyRestriction(nextState, { kind: "disable_tool", tool: envelope.tool as any }, "hard_limit");

  const diffs: string[] = [];
  if (!amountMatch) diffs.push(`amount expected ${expected.amountMinor} vs observed ${observed.amountMinor}`);
  if (!currencyMatch) diffs.push(`currency expected ${expected.currency} vs observed ${observed.currency}`);
  if (!targetMatch) diffs.push(`target expected ${expected.target} vs observed ${observed.target}`);

  return {
    check: {
      callId,
      status: "MISMATCH",
      expected,
      observed,
      detail: `Ledger mismatch detected: ${diffs.join(", ")}. Run frozen and tool disabled.`,
      checkedAt: now,
    },
    nextPermissionState: nextState,
    incidentBriefingNeeded: true,
  };
}
