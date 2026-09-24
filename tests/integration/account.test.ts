/**
 * Covers editing account info (PATCH /api/auth/me) and logout/token
 * revocation. Requires `npm run dev` running (see auth.test.ts).
 */
import { beforeAll, describe, expect, it } from "vitest";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const VALID_PASSWORD = "Sup3r$ecurePass!";

function unique() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sessionCookieFrom(response: Response): string | null {
  const raw = response.headers.get("set-cookie");
  if (!raw) return null;
  return raw.split(";")[0];
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
    body: JSON.stringify(body),
  }).then(drained);
}

async function patchMe(cookie: string | null, body: unknown) {
  return fetch(`${BASE_URL}/api/auth/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: JSON.stringify(body),
  }).then(drained);
}

async function getMe(cookie: string | null) {
  return fetch(`${BASE_URL}/api/auth/me`, {
    headers: cookie ? { Cookie: cookie } : {},
  }).then(drained);
}

async function logout(cookie: string | null) {
  return fetch(`${BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: cookie ? { Cookie: cookie } : {},
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

describe("PATCH /api/auth/me (edit account info)", () => {
  it("signup sets display_name to match username by default", async () => {
    const username = `user_${unique()}`;
    const res = await signup({ username, email: `test-${unique()}@example.com`, password: VALID_PASSWORD });
    const body = await res.json();

    expect(body.user).toMatchObject({ username, display_name: username });
  });

  it("updates only display_name when that's the only field provided, reflected in a subsequent GET /me", async () => {
    const { cookie } = await signupAndGetCookie();
    const newDisplayName = `Display ${unique()}`;

    const patchRes = await patchMe(cookie, { display_name: newDisplayName });
    const patchBody = await patchRes.json();

    expect(patchRes.status).toBe(200);
    expect(patchBody.user.display_name).toBe(newDisplayName);
    expect(patchBody.user).not.toHaveProperty("password_hash");

    const meRes = await getMe(cookie);
    const meBody = await meRes.json();
    expect(meBody.user.display_name).toBe(newDisplayName);
  });

  it("updates only email when that's the only field provided, leaving display_name untouched", async () => {
    const { cookie } = await signupAndGetCookie();
    const newEmail = `test-${unique()}@example.com`;

    const patchRes = await patchMe(cookie, { email: newEmail });
    const patchBody = await patchRes.json();

    expect(patchRes.status).toBe(200);
    expect(patchBody.user.email).toBe(newEmail);
  });

  it("silently ignores an attempt to change username - it is not editable", async () => {
    const { cookie, email } = await signupAndGetCookie();

    const meBefore = await getMe(cookie);
    const usernameBefore = (await meBefore.json()).user.username;

    const res = await patchMe(cookie, { username: "hijacked-username", display_name: "Still Me" });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.user.username).toBe(usernameBefore);
    expect(body.user.username).not.toBe("hijacked-username");
    expect(body.user.email).toBe(email);
  });

  it("rejects a request with neither email nor display_name with a 400", async () => {
    const { cookie } = await signupAndGetCookie();

    const res = await patchMe(cookie, {});
    expect(res.status).toBe(400);
  });

  it("rejects an empty display_name with a 400 and a specific field error", async () => {
    const { cookie } = await signupAndGetCookie();

    const res = await patchMe(cookie, { display_name: "" });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.errors).toHaveProperty("display_name");
  });

  it("rejects updating to an email that's already taken by another user", async () => {
    const takenEmail = `test-${unique()}@example.com`;
    await signup({ username: `user_${unique()}`, email: takenEmail, password: VALID_PASSWORD });

    const { cookie } = await signupAndGetCookie();
    const res = await patchMe(cookie, { email: takenEmail });
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.errors).toHaveProperty("email");
  });

  it("rejects an unauthenticated request with 401", async () => {
    const res = await patchMe(null, { display_name: `Display ${unique()}` });
    expect(res.status).toBe(401);
  });

  it("rejects a malformed (non-JSON) body without crashing", async () => {
    const { cookie } = await signupAndGetCookie();
    const res = await fetch(`${BASE_URL}/api/auth/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body: "not valid json{{{",
    }).then(drained);
    expect(res.status).toBe(400);
  });
});

describe("logout revokes the token, not just the browser's copy", () => {
  it("a token captured before logout can no longer read /me afterwards", async () => {
    const { cookie } = await signupAndGetCookie();

    const beforeLogout = await getMe(cookie);
    expect(beforeLogout.status).toBe(200);

    const logoutRes = await logout(cookie);
    expect(logoutRes.status).toBe(200);

    const afterLogout = await getMe(cookie);
    expect(afterLogout.status).toBe(401);
  });

  it("a token captured before logout can no longer edit the account afterwards", async () => {
    const { cookie } = await signupAndGetCookie();

    await logout(cookie);

    const res = await patchMe(cookie, { display_name: `Display ${unique()}` });
    expect(res.status).toBe(401);
  });
});
