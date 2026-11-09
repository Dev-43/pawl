import { NextRequest, NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json(
        { error: { code: "INVALID_REQUEST", message: "Run ID parameter is missing" } },
        { status: 400 }
      );
    }

    const run = await prisma.run.findUnique({
      where: { id },
      include: {
        events: {
          orderBy: { seq: "asc" },
        },
        briefings: true,
      },
    });

    if (!run) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: `Run with id ${id} not found.` } },
        { status: 404 }
      );
    }

    // Extract verdicts and ledger checks from event stream
    const verdicts = run.events
      .filter((e) => e.type === "verdict_issued")
      .map((e) => ({ id: e.id, seq: e.seq, ...(e.payload as any) }));

    const ledgerChecks = run.events
      .filter((e) => e.type === "action_executed" && (e.payload as any)?.ledgerCheck)
      .map((e) => (e.payload as any).ledgerCheck);

    const reportCheck = run.events
      .filter((e) => e.type === "run_completed" && (e.payload as any)?.reportCheck)
      .map((e) => (e.payload as any).reportCheck)[0] || null;

    return NextResponse.json({
      run: {
        id: run.id,
        scenarioId: run.scenarioId,
        mode: run.mode,
        declaredTask: run.declaredTask,
        status: run.status,
        stepCount: run.stepCount,
        heldAction: run.heldAction,
        permissionState: run.permissionState,
        createdAt: run.createdAt.toISOString(),
      },
      events: run.events.map((e) => ({
        id: e.id,
        seq: e.seq,
        type: e.type,
        at: e.at.toISOString(),
        payload: e.payload,
        hash: e.hash,
        prevHash: e.prevHash,
      })),
      verdicts,
      ledgerChecks,
      reportCheck,
      briefings: run.briefings,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
