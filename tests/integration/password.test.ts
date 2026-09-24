/**
 * Covers changing password (PATCH /api/auth/password), which requires
 * re-entering the current password. Requires `npm run dev` running (see
 * auth.test.ts).
 */
import { beforeAll, describe, expect, it } from "vitest";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const VALID_PASSWORD = "Sup3r$ecurePass!";
const NEW_PASSWORD = "An0ther$ecurePass!";

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

function unique() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sessionCookieFrom(response: Response): string | null {
  const raw = response.headers.get("set-cookie");
  if (!raw) return null;
  return raw.split(";")[0];
}

async function signup(body: unknown) {
  return fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(drained);
}

async function login(body: unknown) {
  return fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(drained);
}

async function changePassword(cookie: string | null, body: unknown) {
  return fetch(`${BASE_URL}/api/auth/password`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  }).then(drained);
}

async function signupAndGetCookie() {
  const email = `test-${unique()}@example.com`;
  const res = await signup({ username: `user_${unique()}`, email, password: VALID_PASSWORD });
  return { cookie: sessionCookieFrom(res), email };
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

describe("PATCH /api/auth/password (change password)", () => {
  it("changes the password when the current password is correct, and the new password works for login afterwards", async () => {
    const { cookie, email } = await signupAndGetCookie();

    const res = await changePassword(cookie, {
      currentPassword: VALID_PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(res.status).toBe(200);

    const loginWithNew = await login({ email, password: NEW_PASSWORD });
    expect(loginWithNew.status).toBe(200);
  });

  it("rejects the change and does not alter the password when the current password is wrong", async () => {
    const { cookie, email } = await signupAndGetCookie();

    const res = await changePassword(cookie, {
      currentPassword: "TotallyWrong123!",
      newPassword: NEW_PASSWORD,
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.errors).toHaveProperty("currentPassword");

    // The original password must still work, proving the change never applied.
    const loginWithOriginal = await login({ email, password: VALID_PASSWORD });
    expect(loginWithOriginal.status).toBe(200);
  });

  it("rejects a new password that fails complexity rules", async () => {
    const { cookie } = await signupAndGetCookie();

    const res = await changePassword(cookie, {
      currentPassword: VALID_PASSWORD,
      newPassword: "weak",
    });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.errors.newPassword.length).toBeGreaterThan(0);
  });

  it("rejects an unauthenticated request with 401", async () => {
    const res = await changePassword(null, {
      currentPassword: VALID_PASSWORD,
      newPassword: NEW_PASSWORD,
    });
    expect(res.status).toBe(401);
  });

  it("rejects a malformed (non-JSON) body without crashing", async () => {
    const { cookie } = await signupAndGetCookie();
    const res = await fetch(`${BASE_URL}/api/auth/password`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: "not valid json{{{",
    }).then(drained);
    expect(res.status).toBe(400);
  });

  it("the old password stops working, and the new one is required, after a successful change", async () => {
    const { cookie, email } = await signupAndGetCookie();

    await changePassword(cookie, { currentPassword: VALID_PASSWORD, newPassword: NEW_PASSWORD });

    const loginWithOld = await login({ email, password: VALID_PASSWORD });
    expect(loginWithOld.status).toBe(401);

    const loginWithNew = await login({ email, password: NEW_PASSWORD });
    expect(loginWithNew.status).toBe(200);
  });
});
