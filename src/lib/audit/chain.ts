import crypto from "crypto";
import { EventType, Event } from "../../contracts";
import { prisma, withDbRetry } from "../db";

export const GENESIS_PREV_HASH = "0".repeat(64);

/**
 * Deterministically stringifies an object with sorted keys recursively.
 */
export function canonicalJson(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }

  if (Array.isArray(obj)) {
    return "[" + obj.map((item) => canonicalJson(item)).join(",") + "]";
  }

  const record = obj as Record<string, unknown>;
  const sortedKeys = Object.keys(record).sort();
  const pairs = sortedKeys.map(
    (key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`
  );
  return "{" + pairs.join(",") + "}";
}

/**
 * Computes the SHA-256 hash for an audit event.
 * Formula per BUILD.md 6.8:
 * hash = sha256(prevHash + "|" + canonicalJson({seq, type, at, payload}))
 */
export function computeEventHash(
  prevHash: string,
  seq: number,
  type: string,
  at: string,
  payload: Record<string, unknown>
): string {
  const payloadCanonical = canonicalJson({
    seq,
    type,
    at,
    payload,
  });
  const input = `${prevHash}|${payloadCanonical}`;
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Appends an audit event to a run's hash chain inside an isolated transaction.
 * Ensures strict sequential numbering and cryptographic chaining.
 */
export async function appendEvent(
  runId: string,
  type: EventType,
  payload: Record<string, unknown>
): Promise<Event> {
  const at = new Date().toISOString();
  const cleanPayload = JSON.parse(JSON.stringify(payload));

  return await withDbRetry(() => prisma.$transaction(async (tx) => {
    // Find the latest event for this run
    const lastEvent = await tx.event.findFirst({
      where: { runId },
      orderBy: { seq: "desc" },
    });

    const seq = lastEvent ? lastEvent.seq + 1 : 0;
    const prevHash = lastEvent ? lastEvent.hash : GENESIS_PREV_HASH;
    const hash = computeEventHash(prevHash, seq, type, at, cleanPayload);

    const created = await tx.event.create({
      data: {
        runId,
        seq,
        type,
        at: new Date(at),
        payload: cleanPayload,
        prevHash,
        hash,
      },
    });

    return {
      id: created.id,
      runId: created.runId,
      seq: created.seq,
      type: created.type as EventType,
      at: created.at.toISOString(),
      payload: created.payload as Record<string, unknown>,
      prevHash: created.prevHash,
      hash: created.hash,
    };
  }));
}

/**
 * Verifies the integrity of the audit chain for a run.
 * Checks:
 * 1. Genesis hash is 64 zeros.
 * 2. Sequences are contiguous (0, 1, 2, ...).
 * 3. Each prevHash matches the preceding event's hash.
 * 4. Each hash recomputed matches the recorded hash.
 */
export async function verifyChain(
  runId: string
): Promise<{ ok: boolean; brokenAtSeq: number | null; count: number }> {
  const events = await prisma.event.findMany({
    where: { runId },
    orderBy: { seq: "asc" },
  });

  if (events.length === 0) {
    return { ok: true, brokenAtSeq: null, count: 0 };
  }

  for (let i = 0; i < events.length; i++) {
    const current = events[i];
    const expectedSeq = i;

    // Check sequence contiguity
    if (current.seq !== expectedSeq) {
      return { ok: false, brokenAtSeq: current.seq, count: events.length };
    }

    // Check prevHash
    const expectedPrevHash = i === 0 ? GENESIS_PREV_HASH : events[i - 1].hash;
    if (current.prevHash !== expectedPrevHash) {
      return { ok: false, brokenAtSeq: current.seq, count: events.length };
    }

    // Check hash computation
    const recomputedHash = computeEventHash(
      current.prevHash,
      current.seq,
      current.type,
      current.at.toISOString(),
      current.payload as Record<string, unknown>
    );

    if (recomputedHash !== current.hash) {
      return { ok: false, brokenAtSeq: current.seq, count: events.length };
    }
  }

  return { ok: true, brokenAtSeq: null, count: events.length };
}
