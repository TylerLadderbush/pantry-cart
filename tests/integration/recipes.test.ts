/**
 * Covers recipe search (GET /api/recipes/search), which proxies Spoonacular's
 * complexSearch endpoint. Requires `npm run dev` running (see auth.test.ts)
 * AND a real SPOONACULAR_API_KEY in .env.local - these tests make real,
 * rate-limited calls against Spoonacular's free tier, so keep this suite
 * focused rather than adding many redundant search variations.
 *
 * The caching tests search for common terms (e.g. "pasta") that accumulate
 * cached rows across every test run over time - that's expected and
 * harmless (same real-recipe-data growth the cache is designed for), so
 * these tests only assert things that stay true regardless of how many
 * times the suite has run before (e.g. "no duplicate row for this id"
 * rather than "exactly N rows exist").
 */
import { beforeAll, describe, expect, it } from "vitest";
import { testSupabase } from "../supabase-test-client";
import { RECIPE_BATCH_SIZE } from "../../lib/recipe-filters";

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

beforeAll(async () => {
  try {
    await fetch(BASE_URL, { signal: AbortSignal.timeout(3000) }).then(drained);
  } catch {
    throw new Error(
      `Could not reach ${BASE_URL}. Start the dev server first with \`npm run dev\`, then rerun \`npm test\`.`
    );
  }
});

describe("GET /api/recipes/search", () => {
  it("rejects an unauthenticated request with 401", async () => {
    const res = await fetch(`${BASE_URL}/api/recipes/search`).then(drained);
    expect(res.status).toBe(401);
  });

  it("returns a list of recipes for an authenticated request with no filters", async () => {
    const cookie = await signupAndGetCookie();

    const res = await fetch(`${BASE_URL}/api/recipes/search`, {
      headers: { Cookie: cookie ?? "" },
    }).then(drained);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.recipes)).toBe(true);
    expect(body.recipes.length).toBeGreaterThan(0);
    expect(body.recipes[0]).toHaveProperty("id");
    expect(body.recipes[0]).toHaveProperty("title");
  });

  it("applies query and filter parameters", async () => {
    const cookie = await signupAndGetCookie();

    const params = new URLSearchParams({
      query: "chicken",
      cuisine: "Italian",
      diet: "Gluten Free",
      intolerances: "Dairy",
    });

    const res = await fetch(`${BASE_URL}/api/recipes/search?${params.toString()}`, {
      headers: { Cookie: cookie ?? "" },
    }).then(drained);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(Array.isArray(body.recipes)).toBe(true);
  });

  it("returns consistent results for the same plain-text query across repeated calls", async () => {
    const cookie = await signupAndGetCookie();

    const first = await fetch(`${BASE_URL}/api/recipes/search?query=pasta`, {
      headers: { Cookie: cookie ?? "" },
    }).then(drained);
    const firstBody = await first.json();

    const second = await fetch(`${BASE_URL}/api/recipes/search?query=pasta`, {
      headers: { Cookie: cookie ?? "" },
    }).then(drained);
    const secondBody = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(secondBody.recipes).toEqual(firstBody.recipes);
  });
});

describe("GET /api/recipes/search pagination", () => {
  it("caps a single batch at RECIPE_BATCH_SIZE regardless of a client-requested number", async () => {
    const cookie = await signupAndGetCookie();

    const res = await fetch(`${BASE_URL}/api/recipes/search?number=100`, {
      headers: { Cookie: cookie ?? "" },
    }).then(drained);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.recipes.length).toBeLessThanOrEqual(RECIPE_BATCH_SIZE);
  });

  it("returns a mostly different batch for a later offset", async () => {
    // Not asserting zero overlap: once a plain-text query has accumulated
    // enough cached rows, offset=0 can be served from our cache in an order
    // that doesn't match Spoonacular's true ranking, so a recipe from
    // Spoonacular's real page 2 can occasionally also appear in our
    // cache-served page 1. That's an accepted tradeoff of reactive caching
    // (see the comment on the cache-check in lib/recipes.ts) - what this
    // test actually guards against is offset being ignored entirely, which
    // would make every batch identical.
    const cookie = await signupAndGetCookie();

    const first = await fetch(`${BASE_URL}/api/recipes/search?query=soup&offset=0`, {
      headers: { Cookie: cookie ?? "" },
    }).then(drained);
    const firstBody = await first.json();

    const second = await fetch(
      `${BASE_URL}/api/recipes/search?query=soup&offset=${RECIPE_BATCH_SIZE}`,
      { headers: { Cookie: cookie ?? "" } }
    ).then(drained);
    const secondBody = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const firstIds = new Set(firstBody.recipes.map((recipe: { id: number }) => recipe.id));
    const overlap = secondBody.recipes.filter((recipe: { id: number }) => firstIds.has(recipe.id));
    expect(overlap.length).toBeLessThan(secondBody.recipes.length);
  });

  it("treats a negative offset as 0 instead of passing it through", async () => {
    const cookie = await signupAndGetCookie();

    const withNegativeOffset = await fetch(`${BASE_URL}/api/recipes/search?query=soup&offset=-5`, {
      headers: { Cookie: cookie ?? "" },
    }).then(drained);
    const negativeBody = await withNegativeOffset.json();

    const withZeroOffset = await fetch(`${BASE_URL}/api/recipes/search?query=soup&offset=0`, {
      headers: { Cookie: cookie ?? "" },
    }).then(drained);
    const zeroBody = await withZeroOffset.json();

    expect(withNegativeOffset.status).toBe(200);
    expect(negativeBody.recipes).toEqual(zeroBody.recipes);
  });
});

describe("recipe caching (public.recipes)", () => {
  it("caches a plain-text search's results as source='spoonacular' rows", async () => {
    const cookie = await signupAndGetCookie();

    const res = await fetch(`${BASE_URL}/api/recipes/search?query=pasta`, {
      headers: { Cookie: cookie ?? "" },
    }).then(drained);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.recipes.length).toBeGreaterThan(0);

    const firstResult = body.recipes[0];
    const { data, error } = await testSupabase
      .from("recipes")
      .select("spoonacular_id, title, image_url, source, user_id")
      .eq("spoonacular_id", firstResult.id)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data?.source).toBe("spoonacular");
    expect(data?.user_id).toBeNull();
    expect(data?.title).toBe(firstResult.title);
  });

  it("upserts rather than duplicating a recipe that resurfaces in a later search", async () => {
    const cookie = await signupAndGetCookie();

    const res = await fetch(`${BASE_URL}/api/recipes/search?query=pasta`, {
      headers: { Cookie: cookie ?? "" },
    }).then(drained);
    const body = await res.json();
    const recipeId = body.recipes[0].id;

    // Search again - the same recipe will very likely resurface in results
    // for the same query, which should update the existing row, not insert
    // a second one.
    await fetch(`${BASE_URL}/api/recipes/search?query=pasta`, {
      headers: { Cookie: cookie ?? "" },
    }).then(drained);

    const { data, error } = await testSupabase
      .from("recipes")
      .select("recipe_id")
      .eq("spoonacular_id", recipeId);

    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });
});

describe("GET /api/recipes/search batched ratings", () => {
  it("includes a rating summary for every recipe with a recipeId, in one response", async () => {
    const cookie = await signupAndGetCookie();

    const res = await fetch(`${BASE_URL}/api/recipes/search?query=soup`, {
      headers: { Cookie: cookie ?? "" },
    }).then(drained);
    const body = await res.json();

    expect(res.status).toBe(200);
    const recipeIdsWithIds = body.recipes
      .map((recipe: { recipeId: string | null }) => recipe.recipeId)
      .filter((id: string | null): id is string => id !== null);

    for (const recipeId of recipeIdsWithIds) {
      expect(body.ratings).toHaveProperty(recipeId);
      expect(["local", "spoonacular", "none"]).toContain(body.ratings[recipeId].source);
    }
  });

  it("reflects a real local rating instead of falling back once one exists", async () => {
    const cookie = await signupAndGetCookie();

    const first = await fetch(`${BASE_URL}/api/recipes/search?query=soup`, {
      headers: { Cookie: cookie ?? "" },
    }).then(drained);
    const firstBody = await first.json();
    const target = firstBody.recipes.find(
      (recipe: { recipeId: string | null }) => recipe.recipeId
    );
    if (!target) throw new Error("No recipe with a recipeId available in this test run.");

    await fetch(`${BASE_URL}/api/recipes/${target.recipeId}/rating`, {
      method: "PUT",
      headers: { Cookie: cookie ?? "", "Content-Type": "application/json" },
      body: JSON.stringify({ rating: 5 }),
    }).then(drained);

    const second = await fetch(`${BASE_URL}/api/recipes/search?query=soup`, {
      headers: { Cookie: cookie ?? "" },
    }).then(drained);
    const secondBody = await second.json();

    expect(secondBody.ratings[target.recipeId].source).toBe("local");
    expect(secondBody.ratings[target.recipeId].count).toBeGreaterThanOrEqual(1);
  });

  it("backfills missing detail in one bulk call so recipes don't show as having no rating data at all", async () => {
    const cookie = await signupAndGetCookie();

    const res = await fetch(`${BASE_URL}/api/recipes/search?query=enchiladas`, {
      headers: { Cookie: cookie ?? "" },
    }).then(drained);
    const body = await res.json();
    expect(res.status).toBe(200);

    const { data: recipeRows } = await testSupabase
      .from("recipes")
      .select("recipe_id, spoonacular_id")
      .in(
        "recipe_id",
        body.recipes
          .map((recipe: { recipeId: string | null }) => recipe.recipeId)
          .filter((id: string | null): id is string => id !== null)
      );

    // Every spoonacular-sourced result should have had its detail (and
    // therefore spoonacular_score) backfilled by now, so none of them
    // should be stuck at "none" purely because search caching only ever
    // stores title/image.
    for (const row of recipeRows ?? []) {
      if (row.spoonacular_id) {
        expect(body.ratings[row.recipe_id].source).not.toBe("none");
      }
    }
  });
});
