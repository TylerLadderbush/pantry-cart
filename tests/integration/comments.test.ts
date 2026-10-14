/**
 * Covers POST /api/recipes/[recipeId]/comments and
 * DELETE /api/recipes/[recipeId]/comments/[commentId]. Requires
 * `npm run dev` running (see auth.test.ts) AND a real SPOONACULAR_API_KEY in
 * .env.local, since getting a real recipe_id to comment on goes through the
 * recipe search endpoint.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { testSupabase } from "../supabase-test-client";

const BASE_URL = process.env.TEST_BASE_URL ?? "http://localhost:3000";
const VALID_PASSWORD = "Sup3r$ecurePass!";
const NIL_UUID = "00000000-0000-0000-0000-000000000000";

function unique() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sessionCookieFrom(response: Response): string | null {
  const raw = response.headers.get("set-cookie");
  if (!raw) return null;
  return raw.split(";")[0];
}

function drained(res: Response): Response {
  res
    .clone()
    .text()
    .catch(() => {});
  return res;
}

async function signupAndGetUser(): Promise<{
  cookie: string;
  userId: string;
  displayName: string;
}> {
  const email = `test-${unique()}@example.com`;
  const username = `user_${unique()}`;
  const res = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password: VALID_PASSWORD }),
  }).then(drained);
  const body = await res.json();
  return {
    cookie: sessionCookieFrom(res) ?? "",
    userId: body.user.id as string,
    displayName: body.user.display_name as string,
  };
}

async function getRealRecipeId(cookie: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/recipes/search?query=soup`, {
    headers: { Cookie: cookie },
  }).then(drained);
  const body = await res.json();
  const withId = body.recipes.find((recipe: { recipeId: string | null }) => recipe.recipeId);
  if (!withId) {
    throw new Error("No cached recipe with a recipeId available in this test run.");
  }
  return withId.recipeId as string;
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

describe("POST /api/recipes/[recipeId]/comments", () => {
  it("rejects an unauthenticated request with 401", async () => {
    const res = await fetch(`${BASE_URL}/api/recipes/${NIL_UUID}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: "hello" }),
    }).then(drained);
    expect(res.status).toBe(401);
  });

  it("rejects a malformed recipe id with 400", async () => {
    const { cookie } = await signupAndGetUser();
    const res = await fetch(`${BASE_URL}/api/recipes/not-a-uuid/comments`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ body: "hello" }),
    }).then(drained);
    expect(res.status).toBe(400);
  });

  it("rejects an empty comment body with 400", async () => {
    const { cookie } = await signupAndGetUser();
    const recipeId = await getRealRecipeId(cookie);
    const res = await fetch(`${BASE_URL}/api/recipes/${recipeId}/comments`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ body: "   " }),
    }).then(drained);
    expect(res.status).toBe(400);
  });

  it("rejects a comment over 2000 characters with 400", async () => {
    const { cookie } = await signupAndGetUser();
    const recipeId = await getRealRecipeId(cookie);
    const res = await fetch(`${BASE_URL}/api/recipes/${recipeId}/comments`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ body: "a".repeat(2001) }),
    }).then(drained);
    expect(res.status).toBe(400);
  });

  it("returns 404 for a well-formed id that doesn't match any recipe", async () => {
    const { cookie } = await signupAndGetUser();
    const res = await fetch(`${BASE_URL}/api/recipes/${NIL_UUID}/comments`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ body: "hello" }),
    }).then(drained);
    expect(res.status).toBe(404);
  });

  it("creates a comment with the author's display name and avatar, persisted in public.recipe_comments", async () => {
    const { cookie, userId, displayName } = await signupAndGetUser();
    const recipeId = await getRealRecipeId(cookie);
    const commentBody = `Great recipe ${unique()}`;

    const res = await fetch(`${BASE_URL}/api/recipes/${recipeId}/comments`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentBody }),
    }).then(drained);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.comment.body).toBe(commentBody);
    expect(body.comment.displayName).toBe(displayName);
    expect(body.comment.avatarUrl).toBeTruthy();

    const { data, error } = await testSupabase
      .from("recipe_comments")
      .select("body, user_id")
      .eq("comment_id", body.comment.commentId)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data?.body).toBe(commentBody);
    expect(data?.user_id).toBe(userId);
  });

  it("shows up on the recipe page with the author's display name", async () => {
    const { cookie, displayName } = await signupAndGetUser();
    const recipeId = await getRealRecipeId(cookie);
    const commentBody = `Loved this one ${unique()}`;

    await fetch(`${BASE_URL}/api/recipes/${recipeId}/comments`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentBody }),
    }).then(drained);

    const res = await fetch(`${BASE_URL}/recipes/${recipeId}`, {
      headers: { Cookie: cookie },
    }).then(drained);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain(commentBody);
    expect(html).toContain(displayName);
  });
});

describe("DELETE /api/recipes/[recipeId]/comments/[commentId]", () => {
  it("rejects an unauthenticated request with 401", async () => {
    const res = await fetch(`${BASE_URL}/api/recipes/${NIL_UUID}/comments/${NIL_UUID}`, {
      method: "DELETE",
    }).then(drained);
    expect(res.status).toBe(401);
  });

  it("rejects a malformed comment id with 400", async () => {
    const { cookie } = await signupAndGetUser();
    const res = await fetch(`${BASE_URL}/api/recipes/${NIL_UUID}/comments/not-a-uuid`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    }).then(drained);
    expect(res.status).toBe(400);
  });

  it("deletes the author's own comment", async () => {
    const { cookie } = await signupAndGetUser();
    const recipeId = await getRealRecipeId(cookie);

    const createRes = await fetch(`${BASE_URL}/api/recipes/${recipeId}/comments`, {
      method: "POST",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ body: `Deletable comment ${unique()}` }),
    }).then(drained);
    const created = await createRes.json();

    const delRes = await fetch(
      `${BASE_URL}/api/recipes/${recipeId}/comments/${created.comment.commentId}`,
      { method: "DELETE", headers: { Cookie: cookie } }
    ).then(drained);
    expect(delRes.status).toBe(200);

    const { data } = await testSupabase
      .from("recipe_comments")
      .select("comment_id")
      .eq("comment_id", created.comment.commentId);

    expect(data?.length).toBe(0);
  });

  it("does not let a different user delete someone else's comment", async () => {
    const author = await signupAndGetUser();
    const recipeId = await getRealRecipeId(author.cookie);

    const createRes = await fetch(`${BASE_URL}/api/recipes/${recipeId}/comments`, {
      method: "POST",
      headers: { Cookie: author.cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ body: `Someone else's comment ${unique()}` }),
    }).then(drained);
    const created = await createRes.json();

    const otherUser = await signupAndGetUser();
    const delRes = await fetch(
      `${BASE_URL}/api/recipes/${recipeId}/comments/${created.comment.commentId}`,
      { method: "DELETE", headers: { Cookie: otherUser.cookie } }
    ).then(drained);
    // Deleting zero matching rows (not the author) is treated the same as
    // a successful no-op, same as favorites/ratings - but the comment
    // itself must still exist afterward.
    expect(delRes.status).toBe(200);

    const { data } = await testSupabase
      .from("recipe_comments")
      .select("comment_id")
      .eq("comment_id", created.comment.commentId);

    expect(data?.length).toBe(1);
  });
});
