import crypto from "crypto";
import { prisma } from "../db";

export function hashIp(ip: string, secret?: string): string {
  const salt = secret || process.env.SESSION_SECRET || "taut-default-session-salt-2026";
  return crypto.createHmac("sha256", salt).update(ip || "unknown").digest("hex");
}

export interface SpendAndRateCheckResult {
  ok: boolean;
  message: string;
}

/**
 * Checks overall spend ledger vs cap, and per-IP rate limit for the current hour.
 */
export async function checkSpendAndRate(ip: string): Promise<SpendAndRateCheckResult> {
  const spendCap = parseFloat(process.env.SPEND_GUARD_USD || process.env.SPEND_CAP_USD || "35");
  const hourlyCap = parseInt(process.env.RUNS_PER_IP_PER_HOUR || "6", 10);

  // 1. Check aggregate spend cap
  try {
    const aggregate = await prisma.spendLedger.aggregate({
      _sum: {
        costUsd: true,
      },
    });

    const totalSpend = aggregate._sum.costUsd || 0;
    if (totalSpend >= spendCap) {
      return {
        ok: false,
        message: "Model budget reached. Existing results remain viewable.",
      };
    }
  } catch (error) {
    // If database is not yet connected or tables empty, log warning but don't hard crash offline checks
    console.warn("Spend ledger check warning:", error);
  }

  // 2. Check per-IP hourly rate limit
  try {
    const ipHash = hashIp(ip);
    const windowStart = new Date(Math.floor(Date.now() / (60 * 60 * 1000)) * (60 * 60 * 1000));

    const existingRate = await prisma.rateLimit.findUnique({
      where: {
        ipHash_windowStart: {
          ipHash,
          windowStart,
        },
      },
    });

    if (existingRate && existingRate.count >= hourlyCap) {
      return {
        ok: false,
        message: `Rate limit reached. Maximum ${hourlyCap} runs per hour per IP.`,
      };
    }
  } catch (error) {
    console.warn("Rate limit check warning:", error);
  }

  return {
    ok: true,
    message: "",
  };
}

/**
 * Records a run start against the IP's hourly rate limit window.
 */
export async function recordIpRun(ip: string): Promise<void> {
  try {
    const ipHash = hashIp(ip);
    const windowStart = new Date(Math.floor(Date.now() / (60 * 60 * 1000)) * (60 * 60 * 1000));

    await prisma.rateLimit.upsert({
      where: {
        ipHash_windowStart: {
          ipHash,
          windowStart,
        },
      },
      update: {
        count: {
          increment: 1,
        },
      },
      create: {
        ipHash,
        windowStart,
        count: 1,
      },
    });
  } catch (error) {
    console.warn("Could not record IP run rate limit:", error);
  }
}
