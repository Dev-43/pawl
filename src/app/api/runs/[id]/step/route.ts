import { NextRequest, NextResponse } from "next/server";
import { runAgentStep } from "../../../../../lib/agent/step";

export const maxDuration = 300;

export async function POST(
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

    const stepExecution = await runAgentStep(id);
    return NextResponse.json(stepExecution);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    if (message.includes("is stopped")) {
      return NextResponse.json(
        { error: { code: "RUN_STOPPED", message } },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: { code: "STEP_EXECUTION_FAILED", message } },
      { status: 500 }
    );
  }
}
