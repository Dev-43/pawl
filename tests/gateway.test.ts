import { describe, it, expect, vi, beforeEach } from "vitest";
import { gatewayCall, setTestWatcherOverride } from "../src/lib/gateway";
import { prisma } from "../src/lib/db";
import { WatcherUnavailableError, AgentAction } from "../src/contracts";

vi.mock("../src/lib/db", () => {
  return {
    withDbRetry: vi.fn(async (cb) => cb()),
    prisma: {
      run: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      event: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        create: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => {
        return cb({
          event: {
            findFirst: vi.fn().mockResolvedValue(null),
            create: vi.fn().mockImplementation(({ data }) => ({
              id: "ev-" + Math.random().toString(36).substring(7),
              ...data,
              at: new Date(),
            })),
          },
        });
      }),
      envFile: {
        findFirst: vi.fn(),
        findMany: vi.fn(),
        upsert: vi.fn(),
      },
      envInvoice: {
        findMany: vi.fn(),
      },
      envOutbox: {
        create: vi.fn().mockResolvedValue({ id: "mail-1", to: "test@domain.com" }),
      },
    },
  };
});

describe("Gateway Execution Pipeline (T7 & T10)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setTestWatcherOverride(null);
  });

  const sampleRun = {
    id: "run-test-1",
    scenarioId: "S2",
    mode: "protected",
    declaredTask: "Reconcile September invoices",
    status: "running",
    stepCount: 1,
    heldAction: null,
    permissionState: {
      version: 1,
      grants: [
        { tool: "read_file", scope: "/finance/" },
        { tool: "read_file", scope: "/hr/" },
        { tool: "write_file", scope: "/finance/reports/" },
        { tool: "send_email", scope: "*" },
      ],
      disabledTools: [],
      approvalRequiredTools: [],
      frozen: false,
      sensitiveRead: false,
      restrictionLog: [],
    },
  };

  it("baseline mode executes allowed action without calling Watcher", async () => {
    vi.mocked(prisma.run.findUnique).mockResolvedValueOnce({
      ...sampleRun,
      mode: "baseline",
    } as any);

    vi.mocked(prisma.envFile.findFirst).mockResolvedValueOnce({
      path: "/finance/invoices/INV-1001.txt",
      content: "Invoice content",
      sensitivity: "internal",
    } as any);

    const action: AgentAction = {
      runId: "run-test-1",
      stepIndex: 1,
      tool: "read_file",
      args: { path: "/finance/invoices/INV-1001.txt" },
      rationale: "reading invoice",
    };

    const res = await gatewayCall({
      runId: "run-test-1",
      mode: "baseline",
      action,
    });

    expect(res.outcome).toBe("executed");
    expect(res.verdict).toBeNull();
    expect(res.toolResult).toBeDefined();
  });

  it("baseline mode blocks out of scope call", async () => {
    vi.mocked(prisma.run.findUnique).mockResolvedValueOnce({
      ...sampleRun,
      mode: "baseline",
    } as any);

    const action: AgentAction = {
      runId: "run-test-1",
      stepIndex: 1,
      tool: "read_file",
      args: { path: "/unauthorized/passwords.txt" },
      rationale: "trying to read root",
    };

    const res = await gatewayCall({
      runId: "run-test-1",
      mode: "baseline",
      action,
    });

    expect(res.outcome).toBe("blocked");
  });

  it("protected mode: Watcher allow NEVER overrides an H3 hold (Precedence Invariant)", async () => {
    vi.mocked(prisma.run.findUnique).mockResolvedValueOnce({
      ...sampleRun,
      mode: "protected",
    } as any);

    vi.mocked(prisma.event.findMany).mockResolvedValueOnce([]);

    // Mock watcher to return 'allow'
    setTestWatcherOverride(async () => ({
      verdict: {
        decision: "allow",
        intentMatch: "matches",
        confidence: 0.99,
        reasons: ["Looks good"],
        evidence: "",
        restrictions: [],
        tier: "nano",
        escalatedFrom: [],
        model: "nano-model",
        tokensIn: 50,
        tokensOut: 20,
        costUsd: 0.0001,
        latencyMs: 150,
      },
      calls: [],
    }));

    // Action attempts to email unlisted domain
    const action: AgentAction = {
      runId: "run-test-1",
      stepIndex: 2,
      tool: "send_email",
      args: {
        to: "unlisted@outside-company.example",
        subject: "data",
        body: "content",
      },
      rationale: "sending email",
    };

    const res = await gatewayCall({
      runId: "run-test-1",
      mode: "protected",
      action,
    });

    // Must be held by H3 regardless of what Watcher would say!
    expect(res.outcome).toBe("held");
    expect(res.message).toMatch(/Held for human approval \(H3\)/);
  });

  it("protected mode: WatcherUnavailableError fails closed to held", async () => {
    vi.mocked(prisma.run.findUnique).mockResolvedValueOnce({
      ...sampleRun,
      mode: "protected",
    } as any);

    vi.mocked(prisma.event.findMany).mockResolvedValueOnce([]);

    setTestWatcherOverride(async () => {
      throw new WatcherUnavailableError("Token Factory outage simulated.");
    });

    const action: AgentAction = {
      runId: "run-test-1",
      stepIndex: 1,
      tool: "read_file",
      args: { path: "/finance/invoices/INV-1001.txt" },
      rationale: "reading invoice",
    };

    const res = await gatewayCall({
      runId: "run-test-1",
      mode: "protected",
      action,
    });

    expect(res.outcome).toBe("held");
    expect(res.message).toMatch(/Watcher service is currently unavailable/);
  });

  it("protected mode: Watcher tighten blocks action, revokes scope, and increments version", async () => {
    vi.mocked(prisma.run.findUnique).mockResolvedValueOnce({
      ...sampleRun,
      mode: "protected",
    } as any);

    vi.mocked(prisma.event.findMany).mockResolvedValueOnce([]);

    setTestWatcherOverride(async () => ({
      verdict: {
        decision: "tighten",
        intentMatch: "off_task",
        confidence: 0.95,
        reasons: ["Accessing HR payroll during finance reconciliation"],
        evidence: "read_file /hr/payroll/2026-09-payroll.csv",
        restrictions: [
          {
            kind: "revoke_scope",
            tool: "read_file",
            scope: "/hr/",
          },
        ],
        tier: "ultra",
        escalatedFrom: ["nano", "super"],
        model: "ultra-model",
        tokensIn: 500,
        tokensOut: 120,
        costUsd: 0.001,
        latencyMs: 1200,
      },
      calls: [],
    }));

    const action: AgentAction = {
      runId: "run-test-1",
      stepIndex: 3,
      tool: "read_file",
      args: { path: "/hr/payroll/2026-09-payroll.csv" },
      rationale: "auditing payroll",
    };

    const res = await gatewayCall({
      runId: "run-test-1",
      mode: "protected",
      action,
    });

    expect(res.outcome).toBe("blocked");
    expect(res.permissionVersion).toBe(2);
    expect(res.message).toMatch(/revoked read_file \/hr\//);
  });
});
