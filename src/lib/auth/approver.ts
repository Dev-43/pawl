import crypto from "crypto";

export const APPROVER_COOKIE_NAME = "taut_approver";

function getSessionSecret(): string {
  return process.env.SESSION_SECRET || "taut-demo-session-secret-at-least-32-chars-long";
}

/**
 * Constant-time comparison of approver passcode to prevent timing attacks.
 */
export function verifyApproverPasscode(candidate: string): boolean {
  const expected = process.env.APPROVER_PASSCODE || "pawl-demo-passcode-2026";
  if (!candidate || typeof candidate !== "string") return false;

  const candidateBuf = Buffer.from(candidate);
  const expectedBuf = Buffer.from(expected);

  if (candidateBuf.length !== expectedBuf.length) {
    // Constant-time dummy comparison to mitigate length timing leaks
    crypto.timingSafeEqual(candidateBuf, candidateBuf);
    return false;
  }

  return crypto.timingSafeEqual(candidateBuf, expectedBuf);
}

/**
 * Generates an HMAC-signed session token with a 12-hour expiry.
 */
export function createApproverToken(): string {
  const secret = getSessionSecret();
  const payload = {
    role: "approver",
    exp: Date.now() + 12 * 60 * 60 * 1000, // 12 hours
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies the validity and expiration of an approver token.
 */
export function verifyApproverToken(token: string): boolean {
  if (!token || typeof token !== "string" || !token.includes(".")) {
    return false;
  }

  const [payloadB64, signature] = token.split(".");
  const secret = getSessionSecret();

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payloadB64)
    .digest("base64url");

  const sigBuf = Buffer.from(signature);
  const expSigBuf = Buffer.from(expectedSignature);

  if (sigBuf.length !== expSigBuf.length || !crypto.timingSafeEqual(sigBuf, expSigBuf)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf-8"));
    if (payload.role !== "approver") return false;
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}
