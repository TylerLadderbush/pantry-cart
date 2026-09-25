/**
 * Covers uploading and deleting a profile picture (POST/DELETE
 * /api/account/avatar). Requires `npm run dev` running (see auth.test.ts).
 *
 * Uploaded test images are real files in Supabase Storage, named by user id
 * (see app/api/account/avatar/route.ts's pathFor()), so each run's test
 * users each leave one small (~KB) object behind. Periodically clean these
 * up from the Supabase dashboard's Storage browser if it matters to you -
 * they're harmless otherwise.
 */
import { beforeAll, describe, expect, it } from "vitest";
import sharp from "sharp";

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

async function signupAndGetCookie() {
  const email = `test-${unique()}@example.com`;
  const res = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: `user_${unique()}`, email, password: VALID_PASSWORD }),
  }).then(drained);
  return sessionCookieFrom(res);
}

async function uploadAvatar(cookie: string | null, blob: Blob, filename = "avatar.png") {
  const formData = new FormData();
  formData.append("file", blob, filename);
  return fetch(`${BASE_URL}/api/account/avatar`, {
    method: "POST",
    headers: cookie ? { Cookie: cookie } : {},
    body: formData,
  }).then(drained);
}

async function deleteAvatar(cookie: string | null) {
  return fetch(`${BASE_URL}/api/account/avatar`, {
    method: "DELETE",
    headers: cookie ? { Cookie: cookie } : {},
  }).then(drained);
}

async function accountPageHtml(cookie: string) {
  const res = await fetch(`${BASE_URL}/account`, { headers: { Cookie: cookie } });
  return res.text();
}

async function validPngBlob(): Promise<Blob> {
  const buffer = await sharp({
    create: { width: 50, height: 50, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
  return new Blob([buffer], { type: "image/png" });
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

describe("POST /api/account/avatar (upload profile picture)", () => {
  it("uploads a valid image, returns a working public URL, and reflects it on the account page", async () => {
    const cookie = await signupAndGetCookie();

    const res = await uploadAvatar(cookie, await validPngBlob());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(typeof body.avatar_url).toBe("string");

    // The URL must actually resolve to a real object in Storage, not just
    // a string our API made up.
    const imageRes = await fetch(body.avatar_url).then(drained);
    expect(imageRes.status).toBe(200);
    expect(imageRes.headers.get("content-type")).toBe("image/webp");

    const html = await accountPageHtml(cookie!);
    expect(html).toContain(body.avatar_url);
  });

  it("re-encodes the image to webp regardless of the uploaded format", async () => {
    const cookie = await signupAndGetCookie();
    const res = await uploadAvatar(cookie, await validPngBlob());
    const body = await res.json();

    expect(body.avatar_url).toMatch(/\.webp/);
  });

  it("rejects a non-image content type", async () => {
    const cookie = await signupAndGetCookie();
    const blob = new Blob(["just some text"], { type: "text/plain" });

    const res = await uploadAvatar(cookie, blob, "notes.txt");
    expect(res.status).toBe(400);
  });

  it("rejects a file that claims to be an image but isn't one (spoofed mimetype)", async () => {
    const cookie = await signupAndGetCookie();
    const blob = new Blob(["definitely not a real png"], { type: "image/png" });

    const res = await uploadAvatar(cookie, blob);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toMatch(/valid image/i);
  });

  it("rejects a file larger than the 2MB cap", async () => {
    const cookie = await signupAndGetCookie();
    const oversized = new Blob([new Uint8Array(3 * 1024 * 1024)], { type: "image/png" });

    const res = await uploadAvatar(cookie, oversized);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.message).toMatch(/2MB/);
  });

  it("rejects a request with no file field", async () => {
    const cookie = await signupAndGetCookie();
    const formData = new FormData();

    const res = await fetch(`${BASE_URL}/api/account/avatar`, {
      method: "POST",
      headers: { Cookie: cookie ?? "" },
      body: formData,
    }).then(drained);

    expect(res.status).toBe(400);
  });

  it("rejects an unauthenticated request with 401", async () => {
    const res = await uploadAvatar(null, await validPngBlob());
    expect(res.status).toBe(401);
  });

  it("replaces a previous upload rather than accumulating multiple", async () => {
    const cookie = await signupAndGetCookie();

    const first = await uploadAvatar(cookie, await validPngBlob());
    const firstBody = await first.json();

    const second = await uploadAvatar(cookie, await validPngBlob());
    const secondBody = await second.json();

    expect(second.status).toBe(200);
    // Same deterministic storage path (userid.webp) both times, only the
    // cache-busting query string differs.
    expect(secondBody.avatar_url.split("?")[0]).toBe(firstBody.avatar_url.split("?")[0]);
  });
});

describe("DELETE /api/account/avatar (remove profile picture)", () => {
  it("clears the avatar so the account page falls back to the default image", async () => {
    const cookie = await signupAndGetCookie();
    await uploadAvatar(cookie, await validPngBlob());

    const res = await deleteAvatar(cookie);
    expect(res.status).toBe(200);

    const html = await accountPageHtml(cookie!);
    expect(html).toContain("/default-avatar.webp");
  });

  it("is idempotent when there is no avatar to delete", async () => {
    const cookie = await signupAndGetCookie();
    const res = await deleteAvatar(cookie);
    expect(res.status).toBe(200);
  });

  it("rejects an unauthenticated request with 401", async () => {
    const res = await deleteAvatar(null);
    expect(res.status).toBe(401);
  });
});
