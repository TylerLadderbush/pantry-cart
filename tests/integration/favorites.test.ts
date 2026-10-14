/**
 * Covers favoriting (PUT/DELETE /api/favorites/[recipeId]). Requires
 * `npm run dev` running (see auth.test.ts) AND a real SPOONACULAR_API_KEY in
 * .env.local, since getting a real recipe_id to favorite against goes
 * through the recipe search endpoint rather than inserting a fixture row
 * directly.
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

async function signupAndGetUser() {
  const email = `test-${unique()}@example.com`;
  const res = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: `user_${unique()}`, email, password: VALID_PASSWORD }),
  }).then(drained);
  const body = await res.json();
  return { cookie: sessionCookieFrom(res) ?? "", userId: body.user.id as string };
}

// Favoriting needs a real recipe_id, which only exists once a recipe has
// been cached via a search (see lib/recipes.ts) - there's no fixture table
// to insert into directly.
async function getRealRecipeId(cookie: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/recipes/search?query=soup`, {
    headers: { Cookie: cookie },
  }).then(drained);
  const body = await res.json();
  const withId = body.recipes.find((recipe: { recipeId: string | null }) => recipe.recipeId);
  if (!withId) {
    throw new Error("No cached recipe with a recipeId available to favorite in this test run.");
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

describe("PUT /api/favorites/[recipeId]", () => {
  it("rejects an unauthenticated request with 401", async () => {
    const res = await fetch(`${BASE_URL}/api/favorites/${NIL_UUID}`, { method: "PUT" }).then(
      drained
    );
    expect(res.status).toBe(401);
  });

  it("rejects a malformed recipe id with 400", async () => {
    const { cookie } = await signupAndGetUser();
    const res = await fetch(`${BASE_URL}/api/favorites/not-a-uuid`, {
      method: "PUT",
      headers: { Cookie: cookie },
    }).then(drained);
    expect(res.status).toBe(400);
  });

  it("returns 404 for a well-formed id that doesn't match any recipe", async () => {
    const { cookie } = await signupAndGetUser();
    const res = await fetch(`${BASE_URL}/api/favorites/${NIL_UUID}`, {
      method: "PUT",
      headers: { Cookie: cookie },
    }).then(drained);
    expect(res.status).toBe(404);
  });

  it("favorites a real recipe and persists it in public.favorites", async () => {
    const { cookie, userId } = await signupAndGetUser();
    const recipeId = await getRealRecipeId(cookie);

    const res = await fetch(`${BASE_URL}/api/favorites/${recipeId}`, {
      method: "PUT",
      headers: { Cookie: cookie },
    }).then(drained);
    expect(res.status).toBe(200);

    const { data, error } = await testSupabase
      .from("favorites")
      .select("user_id, recipe_id")
      .eq("user_id", userId)
      .eq("recipe_id", recipeId)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
  });

  it("is idempotent - favoriting the same recipe twice doesn't duplicate the row", async () => {
    const { cookie, userId } = await signupAndGetUser();
    const recipeId = await getRealRecipeId(cookie);

    await fetch(`${BASE_URL}/api/favorites/${recipeId}`, {
      method: "PUT",
      headers: { Cookie: cookie },
    }).then(drained);
    const second = await fetch(`${BASE_URL}/api/favorites/${recipeId}`, {
      method: "PUT",
      headers: { Cookie: cookie },
    }).then(drained);
    expect(second.status).toBe(200);

    const { data, error } = await testSupabase
      .from("favorites")
      .select("recipe_id")
      .eq("user_id", userId)
      .eq("recipe_id", recipeId);

    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });
});

describe("DELETE /api/favorites/[recipeId]", () => {
  it("rejects an unauthenticated request with 401", async () => {
    const res = await fetch(`${BASE_URL}/api/favorites/${NIL_UUID}`, { method: "DELETE" }).then(
      drained
    );
    expect(res.status).toBe(401);
  });

  it("rejects a malformed recipe id with 400", async () => {
    const { cookie } = await signupAndGetUser();
    const res = await fetch(`${BASE_URL}/api/favorites/not-a-uuid`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    }).then(drained);
    expect(res.status).toBe(400);
  });

  it("succeeds as a no-op when the recipe was never favorited", async () => {
    const { cookie } = await signupAndGetUser();
    const recipeId = await getRealRecipeId(cookie);

    const res = await fetch(`${BASE_URL}/api/favorites/${recipeId}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    }).then(drained);
    expect(res.status).toBe(200);
  });

  it("removes a favorite from public.favorites", async () => {
    const { cookie, userId } = await signupAndGetUser();
    const recipeId = await getRealRecipeId(cookie);

    await fetch(`${BASE_URL}/api/favorites/${recipeId}`, {
      method: "PUT",
      headers: { Cookie: cookie },
    }).then(drained);

    const del = await fetch(`${BASE_URL}/api/favorites/${recipeId}`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    }).then(drained);
    expect(del.status).toBe(200);

    const { data, error } = await testSupabase
      .from("favorites")
      .select("recipe_id")
      .eq("user_id", userId)
      .eq("recipe_id", recipeId);

    expect(error).toBeNull();
    expect(data?.length).toBe(0);
  });
});

describe("favorites isolation between users", () => {
  it("doesn't let one user's favorite show up for another user", async () => {
    const userA = await signupAndGetUser();
    const recipeId = await getRealRecipeId(userA.cookie);

    await fetch(`${BASE_URL}/api/favorites/${recipeId}`, {
      method: "PUT",
      headers: { Cookie: userA.cookie },
    }).then(drained);

    const userB = await signupAndGetUser();

    const { data, error } = await testSupabase
      .from("favorites")
      .select("recipe_id")
      .eq("user_id", userB.userId)
      .eq("recipe_id", recipeId);

    expect(error).toBeNull();
    expect(data?.length).toBe(0);
  });
});
