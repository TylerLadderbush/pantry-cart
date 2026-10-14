/**
 * Covers GET /recipes/[recipeId] - the recipe detail page. Requires
 * `npm run dev` running (see auth.test.ts) AND a real SPOONACULAR_API_KEY in
 * .env.local, since getting a real recipe_id to view goes through the
 * recipe search endpoint, and viewing a never-before-opened Spoonacular
 * recipe triggers a real call to Spoonacular's /information endpoint (see
 * lib/recipe-detail.ts).
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

async function signupAndGetCookie(): Promise<string> {
  const email = `test-${unique()}@example.com`;
  const res = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: `user_${unique()}`, email, password: VALID_PASSWORD }),
  }).then(drained);
  return sessionCookieFrom(res) ?? "";
}

// Search caches title/image only (see lib/recipes.ts) - a recipeId from
// here is exactly the "detail not fetched yet, or already cached from an
// earlier test run" state the page needs to handle either way.
async function getRealRecipe(cookie: string): Promise<{ recipeId: string; title: string }> {
  const res = await fetch(`${BASE_URL}/api/recipes/search?query=soup`, {
    headers: { Cookie: cookie },
  }).then(drained);
  const body = await res.json();
  const withId = body.recipes.find((recipe: { recipeId: string | null }) => recipe.recipeId);
  if (!withId) {
    throw new Error("No cached recipe with a recipeId available to view in this test run.");
  }
  return { recipeId: withId.recipeId as string, title: withId.title as string };
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

describe("GET /recipes/[recipeId]", () => {
  it("returns 404 for a malformed (non-uuid) recipe id", async () => {
    const cookie = await signupAndGetCookie();
    const res = await fetch(`${BASE_URL}/recipes/not-a-uuid`, {
      headers: { Cookie: cookie },
    }).then(drained);
    expect(res.status).toBe(404);
  });

  it("returns 404 for a well-formed id that doesn't match any recipe", async () => {
    const cookie = await signupAndGetCookie();
    const res = await fetch(`${BASE_URL}/recipes/${NIL_UUID}`, {
      headers: { Cookie: cookie },
    }).then(drained);
    expect(res.status).toBe(404);
  });

  it("renders a real recipe's title and the placeholder rating/comments section", async () => {
    const cookie = await signupAndGetCookie();
    const { recipeId, title } = await getRealRecipe(cookie);

    const res = await fetch(`${BASE_URL}/recipes/${recipeId}`, {
      headers: { Cookie: cookie },
    }).then(drained);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain(title);
    expect(html).toContain("Rating");
  });

  it("populates full recipe detail and at least one ingredient after being viewed", async () => {
    const cookie = await signupAndGetCookie();
    const { recipeId } = await getRealRecipe(cookie);

    const res = await fetch(`${BASE_URL}/recipes/${recipeId}`, {
      headers: { Cookie: cookie },
    }).then(drained);
    expect(res.status).toBe(200);

    const { data: recipeRow, error: recipeError } = await testSupabase
      .from("recipes")
      .select("summary, servings")
      .eq("recipe_id", recipeId)
      .maybeSingle();

    expect(recipeError).toBeNull();
    expect(recipeRow?.summary).not.toBeNull();

    const { data: ingredientRows, error: ingredientError } = await testSupabase
      .from("recipe_ingredients")
      .select("recipe_id")
      .eq("recipe_id", recipeId);

    expect(ingredientError).toBeNull();
    expect(ingredientRows?.length).toBeGreaterThan(0);
  });

  it("does not duplicate ingredient links when the same recipe is viewed twice", async () => {
    const cookie = await signupAndGetCookie();
    const { recipeId } = await getRealRecipe(cookie);

    await fetch(`${BASE_URL}/recipes/${recipeId}`, { headers: { Cookie: cookie } }).then(drained);

    const { data: firstView } = await testSupabase
      .from("recipe_ingredients")
      .select("recipe_id, ingredient_id")
      .eq("recipe_id", recipeId);

    await fetch(`${BASE_URL}/recipes/${recipeId}`, { headers: { Cookie: cookie } }).then(drained);

    const { data: secondView } = await testSupabase
      .from("recipe_ingredients")
      .select("recipe_id, ingredient_id")
      .eq("recipe_id", recipeId);

    expect(secondView?.length).toBe(firstView?.length);
  });

  it("user-sourced recipes are returned as-is, with no Spoonacular call attempted", async () => {
    const cookie = await signupAndGetCookie();

    // Simulates the shape a future user-created recipe row will have -
    // user-recipe creation itself isn't built yet (see REQUIREMENTS.md Week
    // 7), but the detail page's source branching needs to already handle
    // it correctly.
    const { data: user } = await testSupabase
      .from("users")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: userRecipe, error: insertError } = await testSupabase
      .from("recipes")
      .insert({
        user_id: user?.id,
        source: "user",
        title: `Test User Recipe ${unique()}`,
        summary: "A hand-written summary, not HTML.",
      })
      .select("recipe_id, title")
      .single();

    expect(insertError).toBeNull();

    const res = await fetch(`${BASE_URL}/recipes/${userRecipe!.recipe_id}`, {
      headers: { Cookie: cookie },
    }).then(drained);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(html).toContain(userRecipe!.title);
    expect(html).toContain("User recipe");

    await testSupabase.from("recipes").delete().eq("recipe_id", userRecipe!.recipe_id);
  });
});
