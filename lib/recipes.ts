import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

const SPOONACULAR_SEARCH_URL = "https://api.spoonacular.com/recipes/complexSearch";

const apiKey = process.env.SPOONACULAR_API_KEY;
if (!apiKey) {
  throw new Error("SPOONACULAR_API_KEY environment variable is not set.");
}

// Next's own fetch cache for the exact same search for an hour - a cheap
// first line of defense, though on serverless it's per-instance and not
// guaranteed to persist between requests. The database cache below (via
// public.recipes) is what actually persists indefinitely and is shared
// across every instance and every user.
const CACHE_SECONDS = 60 * 60;

export type RecipeSearchParams = {
  query?: string;
  cuisine?: string;
  diet?: string;
  intolerances?: string;
  number?: number;
  offset?: number;
};

export type RecipeSummary = {
  id: number;
  // Our own internal recipes.recipe_id - what favorites/ratings/comments
  // actually reference, as opposed to `id` (spoonacular_id), which only
  // identifies the recipe to Spoonacular. Null on the rare occasion the
  // upsert that would have assigned it failed (see cacheRecipes) - callers
  // should treat a null recipeId as "can't be favorited yet".
  recipeId: string | null;
  title: string;
  image: string | null;
};

type SpoonacularResult = {
  id: number;
  title: string;
  image: string | null;
};

export async function searchRecipes(params: RecipeSearchParams): Promise<RecipeSummary[]> {
  const requestedNumber = params.number ?? 20;
  const offset = params.offset ?? 0;
  const hasFilters = Boolean(params.cuisine || params.diet || params.intolerances);

  // Only trust our own cache for the first batch (offset 0) of a plain-text
  // search with no filters. Two reasons: Spoonacular's basic search response
  // (what fetchFromSpoonacular stores) doesn't include cuisine/diet/
  // intolerance data per recipe, so we can't verify a cached recipe still
  // satisfies a filtered search; and our cache has no stable, Spoonacular-
  // matching sort order to make "page 2 of cached results" meaningful, so
  // every infinite-scroll batch past the first always goes straight to
  // Spoonacular (still caching whatever comes back for future reuse).
  if (params.query && !hasFilters && offset === 0) {
    const cached = await getCachedRecipesByTitle(params.query, requestedNumber);
    if (cached.length >= requestedNumber) {
      return cached;
    }
  }

  const results = await fetchFromSpoonacular(params, requestedNumber, offset);
  return await cacheRecipes(results);
}

async function getCachedRecipesByTitle(query: string, limit: number): Promise<RecipeSummary[]> {
  const { data, error } = await supabaseAdmin
    .from("recipes")
    .select("recipe_id, spoonacular_id, title, image_url")
    .eq("source", "spoonacular")
    .ilike("title", `%${query}%`)
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    id: row.spoonacular_id as number,
    recipeId: row.recipe_id as string,
    title: row.title,
    image: row.image_url,
  }));
}

async function fetchFromSpoonacular(
  params: RecipeSearchParams,
  number: number,
  offset: number
): Promise<SpoonacularResult[]> {
  const url = new URL(SPOONACULAR_SEARCH_URL);
  url.searchParams.set("apiKey", apiKey as string);
  url.searchParams.set("number", String(number));
  url.searchParams.set("offset", String(offset));
  if (params.query) url.searchParams.set("query", params.query);
  if (params.cuisine) url.searchParams.set("cuisine", params.cuisine);
  if (params.diet) url.searchParams.set("diet", params.diet);
  if (params.intolerances) url.searchParams.set("intolerances", params.intolerances);

  const res = await fetch(url.toString(), {
    next: { revalidate: CACHE_SECONDS },
  });

  if (!res.ok) {
    throw new Error(`Spoonacular API request failed with status ${res.status}`);
  }

  const data = await res.json();
  const results: unknown = data.results;

  if (!Array.isArray(results)) {
    return [];
  }

  return results.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    image: recipe.image ?? null,
  }));
}

// Upserts by spoonacular_id so a recipe that resurfaces in a later search
// updates the existing cached row instead of creating a duplicate, and
// returns each recipe's recipe_id (read back via .select()) so callers can
// favorite/rate/comment on it. Failures here are logged but never thrown -
// caching is a performance optimization, not something that should break a
// search response if it fails - but that does mean recipeId comes back null
// for every recipe in that batch, since without a cached row there's no
// internal id to favorite against yet.
async function cacheRecipes(recipes: SpoonacularResult[]): Promise<RecipeSummary[]> {
  if (recipes.length === 0) {
    return [];
  }

  const rows = recipes.map((recipe) => ({
    spoonacular_id: recipe.id,
    source: "spoonacular" as const,
    title: recipe.title,
    image_url: recipe.image,
  }));

  const { data, error } = await supabaseAdmin
    .from("recipes")
    .upsert(rows, { onConflict: "spoonacular_id" })
    .select("recipe_id, spoonacular_id");

  if (error || !data) {
    console.error("Failed to cache recipes:", error);
    return recipes.map((recipe) => ({ ...recipe, recipeId: null }));
  }

  const recipeIdBySpoonacularId = new Map(data.map((row) => [row.spoonacular_id, row.recipe_id]));
  return recipes.map((recipe) => ({
    ...recipe,
    recipeId: recipeIdBySpoonacularId.get(recipe.id) ?? null,
  }));
}
