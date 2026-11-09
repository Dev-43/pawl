import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../lib/db";
import { checkSpendAndRate, recordIpRun, hashIp } from "../../../lib/guards/spend";
import { getScenario } from "../../../lib/scenarios/definitions";
import { createInitialPermissionState } from "../../../lib/agent/scenarios";
import { appendEvent } from "../../../lib/audit/chain";
import { Mode } from "../../../contracts";
import { provisionFreshOrdersForRun } from "../../../lib/paypal/provision";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for") || req.ip || "127.0.0.1";

    // 1. Guard check: spend cap and rate limit
    const guard = await checkSpendAndRate(ip);
    if (!guard.ok) {
      return NextResponse.json(
        { error: { code: "RATE_LIMIT_EXCEEDED", message: guard.message } },
        { status: 429 }
      );
    }

    const body = await req.json();
    const scenarioId = body.scenarioId || "custom";
    const mode = (body.mode || "protected") as Mode;
    const customTask = body.task as string | undefined;
    const attackerText = body.attackerText as string | undefined;

    if (mode !== "baseline" && mode !== "protected") {
      return NextResponse.json(
        { error: { code: "INVALID_MODE", message: `Invalid mode: ${mode}` } },
        { status: 400 }
      );
    }

    const scenario = getScenario(scenarioId);
    const declaredTask = customTask || scenario.task;
    const isCompromised = scenarioId === "S2" && (body.simulatedCompromised === true || body.compromised === true);
    const initialPermissionState = {
      ...createInitialPermissionState(),
      simulatedCompromised: isCompromised,
    };
    const ipHash = hashIp(ip);

    // Record IP run rate limit
    await recordIpRun(ip);

    // Create Run record
    const run = await prisma.run.create({
      data: {
        scenarioId,
        mode,
        declaredTask,
        status: "created",
        stepCount: 0,
        permissionState: initialPermissionState as any,
        ipHash,
      },
    });

    // Setup helper: Provision fresh orders via test card (No mock fallback)
    const provisionedOrders = await provisionFreshOrdersForRun({
      runId: run.id,
      scenarioId,
      attackerText: attackerText || scenario.attackerText,
    });

    const inScope = provisionedOrders.find((o) => o.role === "in_scope") || provisionedOrders[0];
    const victim = provisionedOrders.find((o) => o.role === "out_of_scope_victim");

    // Dynamic scope IDs from fresh sandbox order
    const scopeIds = [inScope.orderId, inScope.captureId];
    const finalDeclaredTask = declaredTask.replace(/ORD-[A-Za-z0-9-]+/, inScope.orderId);

    // Store scopeIds and simulatedCompromised flag in permissionState
    await prisma.run.update({
      where: { id: run.id },
      data: {
        declaredTask: finalDeclaredTask,
        permissionState: {
          ...initialPermissionState,
          scopeIds,
          simulatedCompromised: isCompromised,
          victimCaptureId: victim?.captureId,
          inScopeOrderId: inScope.orderId,
          inScopeCaptureId: inScope.captureId,
        } as any,
      },
    });

    // Append run_started audit event
    await appendEvent(run.id, "run_started", {
      scenarioId,
      mode,
      declaredTask: finalDeclaredTask,
      attackerText: inScope.shippingAddressLine1,
      scopeIds,
      model: isCompromised ? "simulated-compromised" : (body.model || "nvidia/nemotron-3-super-120b-a12b"),
      simulatedCompromised: isCompromised,
      victimCaptureId: victim?.captureId,
    });

    return NextResponse.json(
      {
        runId: run.id,
        run: {
          id: run.id,
          scenarioId: run.scenarioId,
          mode: run.mode,
          status: run.status,
          declaredTask: run.declaredTask,
          stepCount: run.stepCount,
          simulatedCompromised: isCompromised,
        },
        simulatedCompromised: isCompromised,
        provisionedOrders,
        inScopeOrder: inScope,
        victimOrder: victim || null,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { error: { code: "PROVISIONING_FAILED", message } },
      { status: 500 }
    );
  }
}
