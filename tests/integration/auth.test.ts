/**
 * Black-box security/integration tests for the auth API routes.
 *
 * These hit a REAL running dev server and a REAL Supabase database (there is
 * no mock/in-memory mode), so:
 *   1. Run `npm run dev` in another terminal first.
 *   2. Run `npm test`.
 *
 * Each run creates a handful of real rows in `public.users` with randomized
 * emails/usernames (see `unique()` below) so repeated runs never collide
 * with each other. Nothing is cleaned up automatically. Periodically purge
 * test rows from the Supabase SQL Editor with:
 *
 *   delete from public.users where email like 'test-%@example.com';
 */
import { beforeAll, describe, expect, it } from "vitest";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const VALID_PASSWORD = "Sup3r$ecurePass!"; // 16 chars, uppercase + special

function unique() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sessionCookieFrom(response: Response): string | null {
  const raw = response.headers.get("set-cookie");
  if (!raw) return null;
  return raw.split(";")[0]; // "session=<jwt>"
}

/**
 * Always drains the response body (via a clone, so callers can still read
 * the original) so the underlying keep-alive socket is released back to
 * Node's connection pool even when a test only cares about the status code
 * or headers. Without this, enough unread bodies across a full test run
 * exhausts the pool and later requests hang until timeout.
 */
function drained(res: Response): Response {
  res
    .clone()
    .text()
    .catch(() => {});
  return res;
}

async function signup(body: unknown) {
  return fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }).then(drained);
}

async function login(body: unknown) {
  return fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }).then(drained);
}

async function me(cookie?: string | null) {
  return fetch(`${BASE_URL}/api/auth/me`, {
    headers: cookie ? { Cookie: cookie } : {},
  }).then(drained);
}

async function logout(cookie?: string | null) {
  return fetch(`${BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: cookie ? { Cookie: cookie } : {},
  }).then(drained);
}

beforeAll(async () => {
  try {
    await fetch(BASE_URL, { signal: AbortSignal.timeout(3000) }).then(drained);
  } catch {
    throw new Error(
      `Could not reach ${BASE_URL}. Start the dev server first with \`npm run dev\`, then rerun \`npm test\`.`
    );
  }
});

describe("POST /api/auth/signup", () => {
  it("creates a user and never returns the password or its hash", async () => {
    const email = `test-${unique()}@example.com`;
    const res = await signup({ username: `user_${unique()}`, email, password: VALID_PASSWORD });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.user).toMatchObject({ email });
    expect(body.user).not.toHaveProperty("password");
    expect(body.user).not.toHaveProperty("password_hash");
  });

  it("rejects a password that fails complexity rules and lists every violated rule", async () => {
    const res = await signup({
      username: `user_${unique()}`,
      email: `test-${unique()}@example.com`,
      password: "weak",
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.errors.password.length).toBeGreaterThan(0);
  });

  it("rejects a malformed (non-JSON) body without crashing", async () => {
    const res = await signup("not valid json{{{");
    expect(res.status).toBe(400);
  });

  it("rejects a duplicate email with a field-specific 409, case-insensitively", async () => {
    const email = `test-${unique()}@example.com`;
    const first = await signup({ username: `user_${unique()}`, email, password: VALID_PASSWORD });
    expect(first.status).toBe(201);

    const second = await signup({
      username: `user_${unique()}`,
      email: email.toUpperCase(),
      password: VALID_PASSWORD,
    });
    const body = await second.json();

    expect(second.status).toBe(409);
    expect(body.errors).toHaveProperty("email");
  });

  it("rejects a duplicate username with a field-specific 409, case-insensitively", async () => {
    const username = `user_${unique()}`;
    const first = await signup({
      username,
      email: `test-${unique()}@example.com`,
      password: VALID_PASSWORD,
    });
    expect(first.status).toBe(201);

    const second = await signup({
      username: username.toUpperCase(),
      email: `test-${unique()}@example.com`,
      password: VALID_PASSWORD,
    });
    const body = await second.json();

    expect(second.status).toBe(409);
    expect(body.errors).toHaveProperty("username");
  });

  it("ignores extra client-supplied fields instead of letting them override server-controlled values", async () => {
    const email = `test-${unique()}@example.com`;
    const res = await signup({
      username: `user_${unique()}`,
      email,
      password: VALID_PASSWORD,
      // Attempted privilege escalation / field injection:
      id: "11111111-1111-1111-1111-111111111111",
      password_hash: "not-a-real-hash",
      role: "admin",
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.user.id).not.toBe("11111111-1111-1111-1111-111111111111");

    // The real password must still be required to log in afterwards -
    // proves the injected password_hash was never used.
    const loginRes = await login({ email, password: VALID_PASSWORD });
    expect(loginRes.status).toBe(200);
  });
});

describe("POST /api/auth/login", () => {
  it("returns the identical status and message for a wrong password and a nonexistent email (no user enumeration)", async () => {
    const email = `test-${unique()}@example.com`;
    await signup({ username: `user_${unique()}`, email, password: VALID_PASSWORD });

    const wrongPassword = await login({ email, password: "WrongPassword123!" });
    const wrongPasswordBody = await wrongPassword.json();

    const nonexistent = await login({
      email: `test-${unique()}@example.com`,
      password: VALID_PASSWORD,
    });
    const nonexistentBody = await nonexistent.json();

    expect(wrongPassword.status).toBe(401);
    expect(nonexistent.status).toBe(401);
    expect(wrongPasswordBody).toEqual(nonexistentBody);
  });

  it("logs in with a differently-cased email than was used at signup", async () => {
    const email = `test-${unique()}@example.com`;
    await signup({ username: `user_${unique()}`, email, password: VALID_PASSWORD });

    const res = await login({ email: email.toUpperCase(), password: VALID_PASSWORD });
    expect(res.status).toBe(200);
  });

  it("rejects a malformed (non-JSON) body without crashing", async () => {
    const res = await login("not valid json{{{");
    expect(res.status).toBe(400);
  });

  it("rejects a SQL-injection-style payload in the email field as a validation error, not a server error", async () => {
    const res = await login({ email: "' OR '1'='1' --", password: "anything" });
    expect(res.status).toBe(400);
  });

  it("sets the session cookie as HttpOnly and SameSite=Lax", async () => {
    const email = `test-${unique()}@example.com`;
    await signup({ username: `user_${unique()}`, email, password: VALID_PASSWORD });

    const res = await login({ email, password: VALID_PASSWORD });
    const rawCookie = res.headers.get("set-cookie") ?? "";

    expect(rawCookie.toLowerCase()).toContain("httponly");
    expect(rawCookie.toLowerCase()).toContain("samesite=lax");
  });

  it(
    "flags (informational, not a hard failure) whether login response time differs between a wrong password and a nonexistent email",
    async () => {
      const email = `test-${unique()}@example.com`;
      await signup({ username: `user_${unique()}`, email, password: VALID_PASSWORD });

      const timeIt = async (body: unknown) => {
        const start = performance.now();
        await login(body);
        return performance.now() - start;
      };

      const existingUserWrongPassword = await timeIt({ email, password: "WrongPassword123!" });
      const nonexistentUser = await timeIt({
        email: `test-${unique()}@example.com`,
        password: VALID_PASSWORD,
      });

      const diff = Math.abs(existingUserWrongPassword - nonexistentUser);
      if (diff > 20) {
        console.warn(
          `[timing] existing-user-wrong-password=${existingUserWrongPassword.toFixed(1)}ms ` +
            `vs nonexistent-email=${nonexistentUser.toFixed(1)}ms (diff ${diff.toFixed(1)}ms). ` +
            `A consistent gap here is a timing side-channel: bcrypt only runs when the user exists, ` +
            `so response time alone can reveal whether an email is registered even though the JSON ` +
            `response bodies are identical.`
        );
      }
      // Not asserted as a hard failure: timing varies too much across machines/CI to be a reliable gate.
      expect(true).toBe(true);
    }
  );
});

describe("session persistence and logout", () => {
  it("GET /api/auth/me is unauthenticated with no cookie", async () => {
    const res = await me();
    expect(res.status).toBe(401);
  });

  it("GET /api/auth/me is authenticated immediately after signup", async () => {
    const email = `test-${unique()}@example.com`;
    const signupRes = await signup({
      username: `user_${unique()}`,
      email,
      password: VALID_PASSWORD,
    });
    const cookie = sessionCookieFrom(signupRes);

    const meRes = await me(cookie);
    const body = await meRes.json();

    expect(meRes.status).toBe(200);
    expect(body.authenticated).toBe(true);
    expect(body.user).not.toHaveProperty("password_hash");
  });

  it("rejects a tampered session cookie", async () => {
    const email = `test-${unique()}@example.com`;
    const signupRes = await signup({
      username: `user_${unique()}`,
      email,
      password: VALID_PASSWORD,
    });
    const cookie = sessionCookieFrom(signupRes);
    expect(cookie).toBeTruthy();

    // Flip a character in the middle of the token rather than the last
    // character of the base64url-encoded signature: a 32-byte signature's
    // final character carries unused padding bits, so tampering only the
    // very last character occasionally leaves the decoded signature bytes
    // unchanged and the "tampered" token still verifies.
    const middle = Math.floor(cookie!.length / 2);
    const middleChar = cookie![middle];
    const tampered =
      cookie!.slice(0, middle) + (middleChar === "A" ? "B" : "A") + cookie!.slice(middle + 1);
    const res = await me(tampered);
    expect(res.status).toBe(401);
  });

  it("logout clears the session so /me becomes unauthenticated again", async () => {
    const email = `test-${unique()}@example.com`;
    const signupRes = await signup({
      username: `user_${unique()}`,
      email,
      password: VALID_PASSWORD,
    });
    const cookie = sessionCookieFrom(signupRes);

    const logoutRes = await logout(cookie);
    expect(logoutRes.status).toBe(200);

    const meRes = await me(cookie);
    expect(meRes.status).toBe(401);
  });

  it("logout without an existing session is idempotent, not an error", async () => {
    const res = await logout();
    expect(res.status).toBe(200);
  });
});
