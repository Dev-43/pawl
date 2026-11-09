import { NextRequest, NextResponse } from "next/server";
import { gatewayCall } from "../../../../lib/gateway";
import { GatewayCallInputSchema } from "../../../../contracts";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Check x-taut-key or x-pawl-key header
    const providedKey = req.headers.get("x-pawl-key") || req.headers.get("x-taut-key");
    const expectedKey = process.env.DEMO_AGENT_KEY;

    if (!expectedKey) {
      return NextResponse.json(
        { error: { code: "SERVER_CONFIG_ERROR", message: "Gateway authorization key is not configured" } },
        { status: 500 }
      );
    }

    if (!providedKey || providedKey !== expectedKey) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid or missing agent key header (x-pawl-key / x-taut-key)." } },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = GatewayCallInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "INVALID_REQUEST",
            message: "Payload does not match GatewayCallInput schema",
            details: parsed.error.issues,
          },
        },
        { status: 400 }
      );
    }

    const result = await gatewayCall(parsed.data);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return NextResponse.json(
      { error: { code: "GATEWAY_ERROR", message } },
      { status: 500 }
    );
  }
}
