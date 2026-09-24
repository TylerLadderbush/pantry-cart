import "server-only";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { SessionPayload } from "@/lib/auth/definitions";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SESSION_COOKIE_NAME = "session";
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 1 day

const secretKey = process.env.SESSION_SECRET;
if (!secretKey) {
  throw new Error("SESSION_SECRET environment variable is not set.");
}
const encodedKey = new TextEncoder().encode(secretKey);

async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(payload.expiresAt / 1000))
    .sign(encodedKey);
}

async function decrypt(session: string | undefined = "") {
  try {
    const { payload } = await jwtVerify(session, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function createSession(userId: string) {
  const expiresAt = Date.now() + SESSION_DURATION_MS;

  const { data: sessionRow, error } = await supabaseAdmin
    .from("sessions")
    .insert({ user_id: userId, expires_at: new Date(expiresAt).toISOString() })
    .select("id")
    .single();

  if (error || !sessionRow) {
    throw new Error("Failed to create session.");
  }

  const session = await encrypt({ sessionId: sessionRow.id, expiresAt });
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: new Date(expiresAt),
    path: "/",
  });
}

export async function verifySession(): Promise<{ userId: string } | null> {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const payload = await decrypt(cookieValue);

  if (!payload?.sessionId) {
    return null;
  }

  // The JWT signature only proves the cookie hasn't been tampered with -
  // the database row is the actual source of truth for whether the session
  // is still active, so a revoked (deleted) session is rejected here even
  // if someone replays a copy of a still-cryptographically-valid token.
  const { data: sessionRow, error } = await supabaseAdmin
    .from("sessions")
    .select("user_id, expires_at")
    .eq("id", payload.sessionId)
    .maybeSingle();

  if (error || !sessionRow) {
    return null;
  }

  if (new Date(sessionRow.expires_at).getTime() <= Date.now()) {
    return null;
  }

  return { userId: sessionRow.user_id };
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const payload = await decrypt(cookieValue);

  if (payload?.sessionId) {
    await supabaseAdmin.from("sessions").delete().eq("id", payload.sessionId);
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}
