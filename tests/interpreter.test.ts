import { describe, it, expect, vi, beforeEach } from "vitest";
import { briefIncident, validateBriefingDeterministically } from "../src/lib/interpreter";
import { prisma } from "../src/lib/db";
import * as tokenFactory from "../src/lib/tokenfactory";

vi.mock("../src/lib/db", () => {
  return {
    withDbRetry: vi.fn(async (cb) => cb()),
    prisma: {
      run: {
        findUnique: vi.fn(),
      },
      event: {
        findMany: vi.fn(),
        create: vi.fn().mockImplementation(({ data }) => ({
          id: "ev-" + Math.random().toString(36).substring(7),
          ...data,
          at: new Date(),
        })),
      },
      briefing: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => ({ id: "br-1", ...data })),
      },
      moneyRuleConfig: {
        findUnique: vi.fn().mockResolvedValue({
          perCallCapUsd: 50.0,
          dailyBudgetUsd: 200.0,
          allowedCurrencies: ["USD"],
        }),
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
    },
  };
});

describe("Incident Interpreter Facts & Deterministic Safety Checks", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts facts ONLY from blocked event when get_order precedes blocked create_refund", async () => {
    const mockEvents = [
      {
        id: "ev-1",
        seq: 1,
        type: "run_started",
        payload: { scopeIds: ["ORDER-IN-SCOPE-1", "CAPTURE-IN-SCOPE-1"] },
      },
      {
        id: "ev-2",
        seq: 2,
        type: "action_proposed",
        payload: { tool: "get_order", args: { id: "ORDER-IN-SCOPE-1" } },
      },
      {
        id: "ev-3",
        seq: 3,
        type: "action_executed",
        payload: { tool: "get_order", result: { id: "ORDER-IN-SCOPE-1" } },
      },
      {
        id: "ev-4",
        seq: 4,
        type: "action_proposed",
        payload: {
          tool: "create_refund",
          args: { capture_id: "VICTIM-CAP-999", amount: { value: "45.00", currency_code: "USD" } },
        },
      },
      {
        id: "ev-5",
        seq: 5,
        type: "action_blocked",
        payload: {
          ruleId: "P7",
          reason: "Target ID 'VICTIM-CAP-999' is not in declared scope list [ORDER-IN-SCOPE-1, CAPTURE-IN-SCOPE-1].",
          tool: "create_refund",
          target: "VICTIM-CAP-999",
          args: { capture_id: "VICTIM-CAP-999", amount: { value: "45.00", currency_code: "USD" } },
        },
      },
      {
        id: "ev-6",
        seq: 6,
        type: "restriction_applied",
        payload: { kind: "require_approval", tool: "create_refund", version: 2 },
      },
    ];

    (prisma.run.findUnique as any).mockResolvedValue({
      id: "run-seq-test",
      scopeIds: ["ORDER-IN-SCOPE-1", "CAPTURE-IN-SCOPE-1"],
      status: "completed",
    });

    (prisma.event.findMany as any).mockResolvedValue(mockEvents);
    (prisma.briefing.findFirst as any).mockResolvedValue(null);

    const chatSpy = vi.spyOn(tokenFactory, "chatJson").mockResolvedValue({
      data: {
        runId: "run-seq-test",
        whatHappened: "Agent attempted create_refund for target VICTIM-CAP-999 requesting 45.00 USD.",
        whyFlagged: "Rule P7 fired: Target ID 'VICTIM-CAP-999' is not in declared scope list [ORDER-IN-SCOPE-1, CAPTURE-IN-SCOPE-1].",
        whatWasRestricted: "require_approval applied to tool 'create_refund' (version 2).",
        humanOptions: ["Approve held action", "Deny and terminate run"],
        cites: ["ev-5"],
      },
    } as any);

    const briefing = await briefIncident("run-seq-test");
    expect(briefing).not.toBeNull();
    expect(briefing?.whatHappened).toContain("create_refund");
    expect(briefing?.whatHappened).toContain("VICTIM-CAP-999");
    expect(briefing?.whatHappened).toContain("45.00");
    expect(briefing?.whatHappened).not.toContain("get_order");
    expect(briefing?.whyFlagged).toContain("Rule P7");
    expect(briefing?.whyFlagged).toContain("VICTIM-CAP-999");
    expect(briefing?.author).toBe("NVIDIA Nemotron Ultra");

    // Verify chatJson received prompt containing facts from the blocked event ONLY
    const calledUserPrompt = (chatSpy.mock.calls[0][0] as any).user;
    expect(calledUserPrompt).toContain("Tool Invoked: create_refund");
    expect(calledUserPrompt).toContain("Target ID: VICTIM-CAP-999");
    expect(calledUserPrompt).toContain("Requested Amount & Currency: 45.00 USD");
    expect(calledUserPrompt).not.toContain("Tool Invoked: get_order");
  });

  it("skips briefing and returns null when no blocked or held event exists", async () => {
    const mockEvents = [
      {
        id: "ev-1",
        seq: 1,
        type: "run_started",
        payload: { scopeIds: ["ORDER-IN-SCOPE-1"] },
      },
      {
        id: "ev-2",
        seq: 2,
        type: "action_proposed",
        payload: { tool: "get_order", args: { id: "ORDER-IN-SCOPE-1" } },
      },
      {
        id: "ev-3",
        seq: 3,
        type: "action_executed",
        payload: { tool: "get_order", result: { id: "ORDER-IN-SCOPE-1" } },
      },
    ];

    (prisma.run.findUnique as any).mockResolvedValue({
      id: "run-no-block",
      scopeIds: ["ORDER-IN-SCOPE-1"],
      status: "completed",
    });

    (prisma.event.findMany as any).mockResolvedValue(mockEvents);
    (prisma.briefing.findFirst as any).mockResolvedValue(null);

    const briefing = await briefIncident("run-no-block");
    expect(briefing).toBeNull();
  });

  it("falls back to plain template briefing with author 'template' when model hallucination fails deterministic check", async () => {
    const mockEvents = [
      {
        id: "ev-1",
        seq: 1,
        type: "run_started",
        payload: { scopeIds: ["ORDER-IN-SCOPE-1"] },
      },
      {
        id: "ev-2",
        seq: 2,
        type: "action_blocked",
        payload: {
          ruleId: "P7",
          reason: "Target ID 'VICTIM-CAP-999' is not in declared scope list [ORDER-IN-SCOPE-1].",
          tool: "create_refund",
          target: "VICTIM-CAP-999",
          args: { capture_id: "VICTIM-CAP-999", amount: { value: "45.00", currency_code: "USD" } },
        },
      },
    ];

    (prisma.run.findUnique as any).mockResolvedValue({
      id: "run-hallucinated",
      scopeIds: ["ORDER-IN-SCOPE-1"],
      status: "completed",
    });

    (prisma.event.findMany as any).mockResolvedValue(mockEvents);
    (prisma.briefing.findFirst as any).mockResolvedValue(null);

    // Model hallucinated wrong tool "get_order" and omitted amount
    vi.spyOn(tokenFactory, "chatJson").mockResolvedValue({
      data: {
        runId: "run-hallucinated",
        whatHappened: "Agent attempted get_order on target VICTIM-CAP-999.",
        whyFlagged: "Rule P7 fired.",
        whatWasRestricted: "require_approval applied to tool create_refund.",
        humanOptions: ["Approve held action"],
        cites: ["ev-2"],
      },
    } as any);

    const briefing = await briefIncident("run-hallucinated");
    expect(briefing).not.toBeNull();
    expect(briefing?.author).toBe("template");
    expect(briefing?.whatHappened).toContain("create_refund");
    expect(briefing?.whatHappened).toContain("VICTIM-CAP-999");
    expect(briefing?.whatHappened).toContain("45.00");
    expect(briefing?.whyFlagged).toContain("Rule P7 fired");
    expect(briefing?.whyFlagged).toContain("[ORDER-IN-SCOPE-1]");
  });
});
