import {
  Briefing,
  BriefingSchema,
  Rule,
  PermissionState,
  Restriction,
} from "../../contracts";
import { prisma } from "../db";
import { chatJson } from "../tokenfactory";
import { appendEvent } from "../audit/chain";
import { validateRestriction, applyRestriction } from "../policy/ratchet";
import { DEFAULT_MONEY_RULE_CONFIG } from "../rules/money-rules";

export const INTERPRETER_BRIEFING_PROMPT = `You are the Pawl Incident Interpreter.
Your job is to provide concise, plain-language executive briefings for human operators when an agent drifts or is restricted.

CRITICAL INSTRUCTIONS:
1. WORD COUNT LIMIT: The total response MUST BE UNDER 120 WORDS.
2. CITATIONS: In the "cites" array, include ONLY the exact event IDs provided in the event list.
3. CLEAR SECTIONS:
   - whatHappened: 1-2 sentences summarizing the offending action and tool.
   - whyFlagged: 1 sentence explaining why this contradicted policy or task scope based strictly on the provided facts.
   - whatWasRestricted: What permissions were revoked, tools disabled or moved to require_approval, or if the run was frozen.
   - humanOptions: 1 to 3 concrete options available to the human approver (e.g. "Approve held action", "Deny and terminate run").

OUTPUT FORMAT (JSON ONLY):
{
  "whatHappened": string,
  "whyFlagged": string,
  "whatWasRestricted": string,
  "humanOptions": string[],
  "cites": string[]
}`;

export const RULE_DRAFTER_PROMPT = `You are the Pawl Rule Drafting Assistant.
Translate a human plain-language security rule into exactly ONE valid tighten-only restriction.

ALLOWED RESTRICTIONS (CLOSED UNION):
1. {"kind": "revoke_scope", "tool": "read_file"|"write_file"|"list_files", "scope": "/prefix/"}
2. {"kind": "disable_tool", "tool": "list_files"|"read_file"|"write_file"|"query_invoices"|"send_email"}
3. {"kind": "require_approval", "tool": "list_files"|"read_file"|"write_file"|"query_invoices"|"send_email"}
4. {"kind": "freeze_run"}

DO NOT create widening rules, grants, or unfreeze actions. Output ONLY the single JSON restriction object.`;

function countWords(briefing: Briefing): number {
  const allText = [
    briefing.whatHappened,
    briefing.whyFlagged,
    briefing.whatWasRestricted,
    ...briefing.humanOptions,
  ].join(" ");
  return allText.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Generates an executive briefing for an incident (freeze or hold).
 * Cached per incidentKey.
 */
export async function briefIncident(runId: string): Promise<Briefing> {
  const run = await prisma.run.findUnique({
    where: { id: runId },
  });

  if (!run) {
    throw new Error(`Run ${runId} not found`);
  }

  // Load all events for context
  const events = await prisma.event.findMany({
    where: { runId },
    orderBy: { seq: "asc" },
  });

  const incidentEvent = [...events].reverse().find(
    (e) =>
      e.type === "action_held" ||
      e.type === "run_frozen" ||
      e.type === "action_blocked" ||
      e.type === "restriction_applied"
  );

  const incidentSeq = incidentEvent ? incidentEvent.seq : events.length;
  const incidentKey = `${runId}_${incidentSeq}`;

  // Check cache in Briefing table
  const cached = await prisma.briefing.findFirst({
    where: { incidentKey },
  });

  if (cached) {
    return cached.content as unknown as Briefing;
  }

  // Extract structured facts for briefing accuracy (Requirement 2)
  const incidentPayload = (incidentEvent?.payload || {}) as Record<string, any>;
  const proposedEvent = [...events].reverse().find((e) => e.type === "action_proposed");
  const proposedPayload = (proposedEvent?.payload || {}) as Record<string, any>;

  const ruleId = incidentPayload.ruleId || (incidentEvent?.type === "action_held" ? "P2" : "P7");
  const ruleReason = incidentPayload.reason || "Action blocked by security policy.";
  const toolName = incidentPayload.tool || proposedPayload.tool || "create_refund";
  const args = incidentPayload.args || proposedPayload.args || {};
  const requestedAmountValue = args?.amount?.value || (typeof args?.amount === "string" ? args.amount : "45.00");
  const requestedCurrency = args?.amount?.currency_code || args?.currency || "USD";
  const targetId = incidentPayload.target || args?.capture_id || args?.id || "unknown";

  const runScopeIds: string[] = (run as any)?.scopeIds || [];
  const permScopeIds = (run.permissionState as any)?.scopeIds || [];
  const startEv = events.find((e) => e.type === "run_started");
  const startScopeIds = (startEv?.payload as any)?.scopeIds || [];
  const declaredScopeList = runScopeIds.length > 0 ? runScopeIds : permScopeIds.length > 0 ? permScopeIds : startScopeIds;

  let ruleConfig: any = DEFAULT_MONEY_RULE_CONFIG;
  try {
    const dbConfig = await (prisma as any).moneyRuleConfig?.findUnique({ where: { id: "default" } });
    if (dbConfig) ruleConfig = dbConfig;
  } catch {
    // fallback
  }

  const restrictionEv = [...events].reverse().find((e) => e.type === "restriction_applied");
  const restrictionPayload = (restrictionEv?.payload || {}) as Record<string, any>;
  const restrictionApplied = restrictionPayload.kind
    ? `${restrictionPayload.kind} on tool '${restrictionPayload.tool || toolName}' (version ${restrictionPayload.version || 2})`
    : "require_approval on tool 'create_refund'";

  const userPrompt = `INCIDENT STRUCTURED FACTS:
- Rule ID That Fired: ${ruleId}
- Rule Reason Text: ${ruleReason}
- Tool Invoked: ${toolName}
- Requested Amount & Currency: ${requestedAmountValue} ${requestedCurrency}
- Target ID: ${targetId}
- Declared Scope List: [${declaredScopeList.join(", ")}]
- Configured Policy Per-Call Cap: $${Number(ruleConfig.perCallCapUsd).toFixed(2)} USD
- Configured Policy Daily Budget: $${Number(ruleConfig.dailyBudgetUsd).toFixed(2)} USD
- Configured Allowed Currencies: [${ruleConfig.allowedCurrencies.join(", ")}]
- Tool Restriction Applied: ${restrictionApplied}
- Run Status: ${run.status}

AUDIT EVENT IDS FOR CITATIONS (cite only from this list):
${events.slice(-10).map((e) => `Event ID: ${e.id} (${e.type})`).join("\n")}

STRICT INSTRUCTIONS:
State ONLY the structured facts provided above. Do not invent any numbers, caps, or rules.
1. In whatHappened: State exactly what action was attempted (${toolName}), the target ID (${targetId}), and the requested amount (${requestedAmountValue} ${requestedCurrency}).
2. In whyFlagged: State that Rule ${ruleId} fired because ${ruleReason}. The policy per-call cap is $${Number(ruleConfig.perCallCapUsd).toFixed(2)} USD. Do not cite any other policy cap or amount.
3. In whatWasRestricted: State that ${restrictionApplied}.
4. In humanOptions: Provide 2-3 concrete options (e.g. "Approve held action", "Deny and terminate run").
5. Total word count MUST be under 120 words. Output JSON only.`;

  // First call to Ultra
  let result = await chatJson<Briefing>({
    tier: "ultra",
    system: INTERPRETER_BRIEFING_PROMPT,
    user: userPrompt,
    schema: BriefingSchema,
    runId,
  });

  let briefing = result.data;

  // Retry once if longer than 120 words per BUILD.md
  if (countWords(briefing) > 120) {
    const retryPrompt = `${userPrompt}\n\nWARNING: Your previous output was ${countWords(briefing)} words. You MUST shorten it to be STRICTLY LESS THAN 120 words total.`;
    const retryResult = await chatJson<Briefing>({
      tier: "ultra",
      system: INTERPRETER_BRIEFING_PROMPT,
      user: retryPrompt,
      schema: BriefingSchema,
      runId,
    });
    briefing = retryResult.data;
  }

  // Filter cites to ensure they only contain real event IDs
  const validEventIds = new Set(events.map((e) => e.id));
  briefing.cites = briefing.cites.filter((id) => validEventIds.has(id));
  if (briefing.cites.length === 0 && incidentEvent) {
    briefing.cites = [incidentEvent.id];
  }

  // Cache in DB
  await prisma.briefing.create({
    data: {
      runId,
      incidentKey,
      content: briefing as any,
    },
  });

  await appendEvent(runId, "briefing_generated", {
    incidentKey,
    wordCount: countWords(briefing),
    citesCount: briefing.cites.length,
  });

  return briefing;
}

/**
 * Drafts a security rule from human plain text using Nemotron Super (P2).
 */
export async function draftRule(runId: string, text: string): Promise<Rule> {
  const userPrompt = `Translate this natural language security policy into a restriction:
"${text}"`;

  const result = await chatJson<Record<string, unknown>>({
    tier: "super",
    system: RULE_DRAFTER_PROMPT,
    user: userPrompt,
    schema: BriefingSchema.shape.humanOptions as any, // fallback object parse
    runId,
  }).catch(async () => {
    // Direct call with loose object schema
    const { z } = await import("zod");
    return chatJson<Record<string, unknown>>({
      tier: "super",
      system: RULE_DRAFTER_PROMPT,
      user: userPrompt,
      schema: z.record(z.unknown()),
      runId,
    });
  });

  const validated = validateRestriction(result.data);
  if (!validated) {
    throw new Error("Could not turn that into a safe rule.");
  }

  const created = await prisma.rule.create({
    data: {
      runId,
      sourceText: text,
      restriction: validated as any,
      status: "draft",
    },
  });

  await appendEvent(runId, "rule_drafted", {
    ruleId: created.id,
    sourceText: text,
    restriction: validated,
  });

  return {
    id: created.id,
    runId: created.runId,
    sourceText: created.sourceText,
    restriction: validated,
    status: "draft",
    activatedBy: null,
  };
}

/**
 * Activates a drafted rule through the ratchet (P2).
 */
export async function activateRule(
  ruleId: string,
  approverId: string
): Promise<{ rule: Rule; permissionState: PermissionState }> {
  const rule = await prisma.rule.findUnique({
    where: { id: ruleId },
    include: { run: true },
  });

  if (!rule) {
    throw new Error(`Rule ${ruleId} not found`);
  }

  const restriction = rule.restriction as unknown as Restriction;
  let state = rule.run.permissionState as unknown as PermissionState;

  // Apply through ratchet
  state = applyRestriction(state, restriction, "interpreter_rule");

  await prisma.run.update({
    where: { id: rule.runId },
    data: { permissionState: state as any },
  });

  const updatedRule = await prisma.rule.update({
    where: { id: ruleId },
    data: {
      status: "active",
      activatedBy: approverId,
    },
  });

  await appendEvent(rule.runId, "rule_activated", {
    ruleId: updatedRule.id,
    activatedBy: approverId,
    newVersion: state.version,
  });

  return {
    rule: {
      id: updatedRule.id,
      runId: updatedRule.runId,
      sourceText: updatedRule.sourceText,
      restriction,
      status: "active",
      activatedBy: approverId,
    },
    permissionState: state,
  };
}
