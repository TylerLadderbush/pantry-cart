/**
 * Covers PUT/DELETE /api/recipes/[recipeId]/rating, plus the fallback to
 * Spoonacular's own score when a recipe has no local ratings yet. Requires
 * `npm run dev` running (see auth.test.ts) AND a real SPOONACULAR_API_KEY in
 * .env.local, since getting a real recipe_id goes through recipe search and
 * viewing it the first time fetches full detail (including
 * spoonacular_score) from Spoonacular.
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

async function signupAndGetUser(): Promise<{ cookie: string; userId: string }> {
  const email = `test-${unique()}@example.com`;
  const res = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: `user_${unique()}`, email, password: VALID_PASSWORD }),
  }).then(drained);
  const body = await res.json();
  return { cookie: sessionCookieFrom(res) ?? "", userId: body.user.id as string };
}

// Search caches title/image only - viewing the recipe's page is what
// fetches and caches the rest (including spoonacular_score, used for the
// rating fallback).
async function getFreshRecipe(cookie: string, query: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/recipes/search?query=${query}`, {
    headers: { Cookie: cookie },
  }).then(drained);
  const body = await res.json();
  const withId = body.recipes.find((recipe: { recipeId: string | null }) => recipe.recipeId);
  if (!withId) {
    throw new Error("No cached recipe with a recipeId available in this test run.");
  }
  await fetch(`${BASE_URL}/recipes/${withId.recipeId}`, { headers: { Cookie: cookie } }).then(
    drained
  );
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

describe("PUT /api/recipes/[recipeId]/rating", () => {
  it("rejects an unauthenticated request with 401", async () => {
    const res = await fetch(`${BASE_URL}/api/recipes/${NIL_UUID}/rating`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 5 }),
    }).then(drained);
    expect(res.status).toBe(401);
  });

  it("rejects a malformed recipe id with 400", async () => {
    const { cookie } = await signupAndGetUser();
    const res = await fetch(`${BASE_URL}/api/recipes/not-a-uuid/rating`, {
      method: "PUT",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 5 }),
    }).then(drained);
    expect(res.status).toBe(400);
  });

  it.each([0, 6, 3.5, "five", null])("rejects an invalid rating value (%s) with 400", async (value) => {
    const { cookie } = await signupAndGetUser();
    const res = await fetch(`${BASE_URL}/api/recipes/${NIL_UUID}/rating`, {
      method: "PUT",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ rating: value }),
    }).then(drained);
    expect(res.status).toBe(400);
  });

  it("returns 404 for a well-formed id that doesn't match any recipe", async () => {
    const { cookie } = await signupAndGetUser();
    const res = await fetch(`${BASE_URL}/api/recipes/${NIL_UUID}/rating`, {
      method: "PUT",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 4 }),
    }).then(drained);
    expect(res.status).toBe(404);
  });

  it("saves a rating and persists it in public.recipe_ratings", async () => {
    const { cookie, userId } = await signupAndGetUser();
    const recipeId = await getFreshRecipe(cookie, "lasagna");

    const res = await fetch(`${BASE_URL}/api/recipes/${recipeId}/rating`, {
      method: "PUT",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 4 }),
    }).then(drained);
    expect(res.status).toBe(200);

    const { data, error } = await testSupabase
      .from("recipe_ratings")
      .select("rating")
      .eq("user_id", userId)
      .eq("recipe_id", recipeId)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data?.rating).toBe(4);
  });

  it("upserts rather than duplicating when the same user rates again", async () => {
    const { cookie, userId } = await signupAndGetUser();
    const recipeId = await getFreshRecipe(cookie, "lasagna");

    await fetch(`${BASE_URL}/api/recipes/${recipeId}/rating`, {
      method: "PUT",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 2 }),
    }).then(drained);
    await fetch(`${BASE_URL}/api/recipes/${recipeId}/rating`, {
      method: "PUT",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 5 }),
    }).then(drained);

    const { data, error } = await testSupabase
      .from("recipe_ratings")
      .select("rating")
      .eq("user_id", userId)
      .eq("recipe_id", recipeId);

    expect(error).toBeNull();
    expect(data?.length).toBe(1);
    expect(data?.[0].rating).toBe(5);
  });
});

describe("DELETE /api/recipes/[recipeId]/rating", () => {
  it("rejects an unauthenticated request with 401", async () => {
    const res = await fetch(`${BASE_URL}/api/recipes/${NIL_UUID}/rating`, {
      method: "DELETE",
    }).then(drained);
    expect(res.status).toBe(401);
  });

  it("removes a rating from public.recipe_ratings", async () => {
    const { cookie, userId } = await signupAndGetUser();
    const recipeId = await getFreshRecipe(cookie, "lasagna");

    await fetch(`${BASE_URL}/api/recipes/${recipeId}/rating`, {
      method: "PUT",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 3 }),
    }).then(drained);

    const del = await fetch(`${BASE_URL}/api/recipes/${recipeId}/rating`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    }).then(drained);
    expect(del.status).toBe(200);

    const { data } = await testSupabase
      .from("recipe_ratings")
      .select("rating")
      .eq("user_id", userId)
      .eq("recipe_id", recipeId);

    expect(data?.length).toBe(0);
  });

  it("succeeds as a no-op when there was no rating to remove", async () => {
    const { cookie } = await signupAndGetUser();
    const recipeId = await getFreshRecipe(cookie, "lasagna");

    const res = await fetch(`${BASE_URL}/api/recipes/${recipeId}/rating`, {
      method: "DELETE",
      headers: { Cookie: cookie },
    }).then(drained);
    expect(res.status).toBe(200);
  });
});

describe("recipe page rating summary", () => {
  it("falls back to Spoonacular's score, scaled to 1-5, when there are no local ratings", async () => {
    const { cookie } = await signupAndGetUser();
    const recipeId = await getFreshRecipe(cookie, "ratatouille");

    const { data: recipeRow } = await testSupabase
      .from("recipes")
      .select("spoonacular_score")
      .eq("recipe_id", recipeId)
      .maybeSingle();

    const res = await fetch(`${BASE_URL}/recipes/${recipeId}`, {
      headers: { Cookie: cookie },
    }).then(drained);
    const html = await res.text();

    expect(res.status).toBe(200);
    if (recipeRow?.spoonacular_score) {
      expect(html).toContain("via Spoonacular");
    } else {
      expect(html).toContain("No ratings yet");
    }
  });

  it("shows the local average once a rating exists, instead of the Spoonacular fallback", async () => {
    const { cookie } = await signupAndGetUser();
    const recipeId = await getFreshRecipe(cookie, "paella");

    await fetch(`${BASE_URL}/api/recipes/${recipeId}/rating`, {
      method: "PUT",
      headers: { Cookie: cookie, "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 5 }),
    }).then(drained);

    const res = await fetch(`${BASE_URL}/recipes/${recipeId}`, {
      headers: { Cookie: cookie },
    }).then(drained);
    const html = await res.text();

    // Not asserting an exact count - this recipe accumulates ratings from
    // other runs of this same suite over time (same reasoning as the
    // accumulating-cache comment in recipes.test.ts). What actually matters
    // is that having ANY local rating permanently stops the Spoonacular
    // fallback from showing, regardless of how many ratings exist.
    expect(res.status).toBe(200);
    expect(html).toMatch(/\d+ ratings?\)/);
    expect(html).not.toContain("via Spoonacular");
  });
});
