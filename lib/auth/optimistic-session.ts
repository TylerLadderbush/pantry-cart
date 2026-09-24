import { jwtVerify } from "jose";
import type { SessionPayload } from "@/lib/auth/definitions";

const secretKey = process.env.SESSION_SECRET;
if (!secretKey) {
  throw new Error("SESSION_SECRET environment variable is not set.");
}
const encodedKey = new TextEncoder().encode(secretKey);

/**
 * Lightweight, database-free session check for proxy.ts only. It only
 * proves the cookie is a validly-signed, unexpired token - it cannot detect
 * a token that was revoked (e.g. by logout) before its natural expiry,
 * since that requires a database lookup, and proxy should stay fast and
 * avoid data fetching. Pages that need the authoritative answer must still
 * call verifySession() from lib/auth/session.ts.
 */
export async function hasOptimisticSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, encodedKey, { algorithms: ["HS256"] });
    return Boolean((payload as unknown as SessionPayload).sessionId);
  } catch {
    return false;
  }
}
