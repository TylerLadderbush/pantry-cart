/**
 * Confirms the login/signup pages exist and that the homepage's buttons
 * actually point at them. Requires `npm run dev` running (see
 * tests/integration/auth.test.ts for the same requirement/rationale).
 */
import { beforeAll, describe, expect, it } from "vitest";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const VALID_PASSWORD = "Sup3r$ecurePass!";

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

async function signupAndGetCookie() {
  const email = `test-${unique()}@example.com`;
  const res = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: `user_${unique()}`, email, password: VALID_PASSWORD }),
  }).then(drained);
  return sessionCookieFrom(res);
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

describe("login/signup pages", () => {
  it("renders the login page", async () => {
    const res = await fetch(`${BASE_URL}/login`).then(drained);
    expect(res.status).toBe(200);
  });

  it("renders the signup page", async () => {
    const res = await fetch(`${BASE_URL}/signup`).then(drained);
    expect(res.status).toBe(200);
  });

  it("has homepage buttons that link to /login and /signup", async () => {
    const res = await fetch(BASE_URL);
    const html = await res.text();

    expect(html).toContain('href="/login"');
    expect(html).toContain('href="/signup"');
  });
});

describe("route protection (proxy.ts)", () => {
  it("redirects an unauthenticated request from /home to /login", async () => {
    const res = await fetch(`${BASE_URL}/home`, { redirect: "manual" }).then(drained);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects an unauthenticated request from /account to /login", async () => {
    const res = await fetch(`${BASE_URL}/account`, { redirect: "manual" }).then(drained);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("does not redirect an unauthenticated request away from the landing page", async () => {
    const res = await fetch(BASE_URL, { redirect: "manual" }).then(drained);
    expect(res.status).toBe(200);
  });

  it("lets an authenticated request through to /home and /account", async () => {
    const cookie = await signupAndGetCookie();

    const homeRes = await fetch(`${BASE_URL}/home`, { headers: { Cookie: cookie ?? "" } }).then(
      drained
    );
    expect(homeRes.status).toBe(200);

    const accountRes = await fetch(`${BASE_URL}/account`, {
      headers: { Cookie: cookie ?? "" },
    }).then(drained);
    expect(accountRes.status).toBe(200);
  });

  it("redirects an authenticated request away from the landing, login, and signup pages to /home", async () => {
    const cookie = await signupAndGetCookie();
    const headers = { Cookie: cookie ?? "" };

    for (const path of ["/", "/login", "/signup"]) {
      const res = await fetch(`${BASE_URL}${path}`, { headers, redirect: "manual" }).then(drained);
      expect(res.status, `expected ${path} to redirect`).toBe(307);
      expect(res.headers.get("location")).toContain("/home");
    }
  });
});
