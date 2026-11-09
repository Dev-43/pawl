import { NextResponse } from "next/server";
import { prisma, withDbRetry } from "../../../lib/db";
import { getTokenHealth, assertSandboxEnv, getValidAccessToken } from "../../../lib/paypal/token";

export const dynamic = "force-dynamic";

export async function GET() {
  let paypalEnvStatus = {
    valid: false,
    value: process.env.PAYPAL_ENV || "missing",
  };

  try {
    assertSandboxEnv();
    paypalEnvStatus.valid = true;
  } catch (err: any) {
    paypalEnvStatus.valid = false;
  }

  // 1. Database Health
  let dbStatus = { ok: false, latencyMs: 0, error: undefined as string | undefined };
  try {
    const t0 = Date.now();
    await withDbRetry(() => prisma.$queryRaw`SELECT 1`);
    dbStatus = { ok: true, latencyMs: Date.now() - t0, error: undefined };
  } catch (err: any) {
    dbStatus = { ok: false, latencyMs: 0, error: err.message };
  }

  // 2. PayPal Token Health
  let paypalTokenStatus = getTokenHealth();
  if (!paypalTokenStatus.valid) {
    try {
      await getValidAccessToken();
      paypalTokenStatus = getTokenHealth();
    } catch (err: any) {
      paypalTokenStatus = {
        valid: false,
        remainingSeconds: 0,
        expiresAt: null,
        error: err.message,
      };
    }
  }

  // 3. Nebius Health
  const nebiusConfigured = Boolean(process.env.NEBIUS_API_KEY && process.env.NEBIUS_API_KEY.length > 10);
  const nebiusStatus = {
    configured: nebiusConfigured,
    modelNano: process.env.TF_MODEL_NANO || "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B",
  };

  // 4. Gemini Fallback Health
  const geminiConfigured = Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.length > 5);
  const geminiStatus = {
    configured: geminiConfigured,
    status: geminiConfigured ? "ready" : "not configured (optional)",
  };

  const healthy = paypalEnvStatus.valid && dbStatus.ok && nebiusStatus.configured;

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      paypalEnv: paypalEnvStatus,
      db: dbStatus,
      paypalToken: paypalTokenStatus,
      nebius: nebiusStatus,
      gemini: geminiStatus,
      timestamp: new Date().toISOString(),
    },
    { status: paypalEnvStatus.valid ? (healthy ? 200 : 503) : 500 }
  );
}
