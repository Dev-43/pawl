import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import {
  APPROVER_COOKIE_NAME,
  verifyApproverToken,
} from "../../../../../lib/auth/approver";
import {
  HumanActionSchema,
  PermissionState,
  AgentAction,
} from "../../../../../contracts";
import { applyHumanAction } from "../../../../../lib/policy/ratchet";
import { executeTool } from "../../../../../lib/env/tools";
import { executeTool as executePaypalTool } from "../../../../../lib/paypal/executor";
import { getRegistryEntry } from "../../../../../lib/paypal/registry";
import { performLedgerCheck } from "../../../../../lib/ledger/check";
import { appendEvent } from "../../../../../lib/audit/chain";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // 1. Verify approver authentication cookie
    const token = req.cookies.get(APPROVER_COOKIE_NAME)?.value;
    if (!token || !verifyApproverToken(token)) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Approver authentication required." } },
        { status: 401 }
      );
    }

    // 2. Validate request body
    const body = await req.json();
    const parsedAction = HumanActionSchema.safeParse(body);
    if (!parsedAction.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_ACTION",
            message: "Malformed human action payload.",
            details: parsedAction.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const humanAction = parsedAction.data;

    // 3. Load run
    const run = await prisma.run.findUnique({
      where: { id },
    });

    if (!run) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: `Run ${id} not found.` } },
        { status: 404 }
      );
    }

    let state = run.permissionState as unknown as PermissionState;
    let nextStatus = run.status;
    let nextHeldAction = run.heldAction;

    if (humanAction.action === "approve_held") {
      if (!run.heldAction) {
        return NextResponse.json(
          {
            error: {
              code: "NO_HELD_ACTION",
              message: "No action is currently held for approval, or it was already resolved.",
            },
          },
          { status: 409 }
        );
      }

      const held = run.heldAction as unknown as AgentAction;

      // Execute held action exactly once
      let toolResult: any;
      if (getRegistryEntry(held.tool)) {
        const exec = await executePaypalTool(held);
        toolResult = exec.result;
        await performLedgerCheck({
          callId: `human-appr-${Date.now()}`,
          envelope: held,
          executionStatus: exec.status,
          executionResult: exec.result,
          currentPermissionState: state,
        });
      } else {
        toolResult = await executeTool(held.tool, held.args, id);
      }
      nextHeldAction = null;
      nextStatus = "running";

      await appendEvent(id, "human_action", {
        action: "approve_held",
        executedAction: held,
      });

      await appendEvent(id, "action_executed", {
        tool: held.tool,
        args: held.args,
        by: "human_approver",
        result: toolResult,
      });
    } else if (humanAction.action === "deny_held") {
      if (!run.heldAction) {
        return NextResponse.json(
          {
            error: {
              code: "NO_HELD_ACTION",
              message: "No action is currently held for approval.",
            },
          },
          { status: 409 }
        );
      }

      const discarded = run.heldAction;
      nextHeldAction = null;
      nextStatus = "running";

      await appendEvent(id, "human_action", {
        action: "deny_held",
        discardedAction: discarded,
      });
    } else if (humanAction.action === "restore_scope") {
      state = applyHumanAction(state, humanAction);

      await appendEvent(id, "human_action", {
        action: "restore_scope",
        restoredGrant: humanAction.grant,
        newVersion: state.version,
      });
    } else if (humanAction.action === "unfreeze") {
      state = applyHumanAction(state, humanAction);
      nextStatus = "running";

      await appendEvent(id, "human_action", {
        action: "unfreeze",
        newVersion: state.version,
      });
    }

    const updated = await prisma.run.update({
      where: { id },
      data: {
        status: nextStatus,
        heldAction: nextHeldAction as any,
        permissionState: state as any,
      },
    });

    return NextResponse.json({
      run: {
        id: updated.id,
        scenarioId: updated.scenarioId,
        mode: updated.mode,
        declaredTask: updated.declaredTask,
        status: updated.status,
        stepCount: updated.stepCount,
        heldAction: updated.heldAction,
        createdAt: updated.createdAt.toISOString(),
      },
      permissionState: state,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
