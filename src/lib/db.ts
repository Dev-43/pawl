import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Use DIRECT_URL only when USE_DIRECT_DB=1 (e.g. for batch benchmark scripts), else default to DATABASE_URL
const dbUrl =
  process.env.USE_DIRECT_DB === "1" && process.env.DIRECT_URL
    ? process.env.DIRECT_URL
    : process.env.DATABASE_URL;

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: dbUrl ? { db: { url: dbUrl } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * Execute a database operation with exponential backoff retry on transient connection errors
 */
export async function withDbRetry<T>(
  operation: () => Promise<T>,
  retries = 5,
  delayMs = 1000
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (err: any) {
      attempt++;
      const isTransientConn =
        err.message?.includes("Can't reach database server") ||
        err.message?.includes("Unable to start a transaction") ||
        err.message?.includes("Transaction API error") ||
        err.message?.includes("Connection reset") ||
        err.message?.includes("ConnectionReset") ||
        err.message?.includes("forcibly closed") ||
        err.message?.includes("Connection refused") ||
        err.message?.includes("timed out") ||
        err.code === "P1001" ||
        err.code === "P2024";

      if (attempt >= retries || !isTransientConn) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, delayMs * Math.pow(2, attempt - 1)));
    }
  }
}
