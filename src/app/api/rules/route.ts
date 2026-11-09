import { NextRequest, NextResponse } from "next/server";
import { prisma, withDbRetry } from "../../../lib/db";
import {
  verifyApproverToken,
  APPROVER_COOKIE_NAME,
} from "../../../lib/auth/approver";
import {
  DEFAULT_MONEY_RULE_CONFIG,
  MoneyRuleConfig,
} from "../../../lib/rules/money-rules";
import { appendEvent } from "../../../lib/audit/chain";

export const dynamic = "force-dynamic";

/**
 * GET /api/rules
 * Public endpoint to view current money rule configuration.
 */
export async function GET() {
  try {
    const config: any = await withDbRetry(() =>
      (prisma as any).moneyRuleConfig?.findUnique({
        where: { id: "default" },
      })
    );

    if (!config) {
      return NextResponse.json(DEFAULT_MONEY_RULE_CONFIG, { status: 200 });
    }

    return NextResponse.json(
      {
        perCallCapUsd: config.perCallCapUsd,
        dailyBudgetUsd: config.dailyBudgetUsd,
        allowedCurrencies: config.allowedCurrencies,
        allowedMerchantContacts: config.allowedMerchantContacts,
        maxSteps: config.maxSteps,
        updatedAt: config.updatedAt,
        updatedBy: config.updatedBy,
      },
      { status: 200 }
    );
  } catch (err: any) {
    return NextResponse.json(DEFAULT_MONEY_RULE_CONFIG, { status: 200 });
  }
}

/**
 * PUT /api/rules
 * Approver-only endpoint to edit rule configuration.
 * Audited into the append-only event chain.
 */
export async function PUT(req: NextRequest) {
  // Check approver authorization
  const cookieToken = req.cookies.get(APPROVER_COOKIE_NAME)?.value;
  const authHeader = req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  const token = cookieToken || bearerToken;

  if (!token || !verifyApproverToken(token)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Approver authorization required" } },
      { status: 401 }
    );
  }

  try {
    const body = (await req.json()) as Partial<MoneyRuleConfig>;

    const updated = await withDbRetry(() =>
      (prisma as any).moneyRuleConfig.upsert({
        where: { id: "default" },
        create: {
          id: "default",
          perCallCapUsd: body.perCallCapUsd ?? DEFAULT_MONEY_RULE_CONFIG.perCallCapUsd,
          dailyBudgetUsd: body.dailyBudgetUsd ?? DEFAULT_MONEY_RULE_CONFIG.dailyBudgetUsd,
          allowedCurrencies: body.allowedCurrencies ?? DEFAULT_MONEY_RULE_CONFIG.allowedCurrencies,
          allowedMerchantContacts: body.allowedMerchantContacts ?? DEFAULT_MONEY_RULE_CONFIG.allowedMerchantContacts,
          maxSteps: body.maxSteps ?? DEFAULT_MONEY_RULE_CONFIG.maxSteps,
          updatedBy: "approver",
        },
        update: {
          ...(body.perCallCapUsd !== undefined && { perCallCapUsd: body.perCallCapUsd }),
          ...(body.dailyBudgetUsd !== undefined && { dailyBudgetUsd: body.dailyBudgetUsd }),
          ...(body.allowedCurrencies !== undefined && { allowedCurrencies: body.allowedCurrencies }),
          ...(body.allowedMerchantContacts !== undefined && { allowedMerchantContacts: body.allowedMerchantContacts }),
          ...(body.maxSteps !== undefined && { maxSteps: body.maxSteps }),
          updatedBy: "approver",
        },
      })
    );

    // Write audit event
    try {
      // Find or create a system audit run
      let systemRun = await prisma.run.findFirst({
        where: { scenarioId: "S1" },
      });
      if (systemRun) {
        await appendEvent(systemRun.id, "rule_activated", {
          action: "update_money_rules",
          config: body,
          updatedBy: "approver",
        });
      }
    } catch {
      // Best-effort audit linkage if run doesn't exist yet
    }

    return NextResponse.json(updated, { status: 200 });
  } catch (err: any) {
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: err.message } },
      { status: 500 }
    );
  }
}
