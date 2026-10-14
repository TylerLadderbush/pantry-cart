import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { RecipeNotFoundError } from "@/lib/favorites";

export type RatingSummary = {
  // Always 1-5, whichever source it came from - lets the UI render both
  // with the same star widget.
  average: number;
  count: number;
  // "local": at least one of our own users has rated it - "spoonacular":
  // no local ratings yet, so Spoonacular's own score is shown as a
  // stand-in - "none": neither exists (e.g. a brand new user recipe).
  source: "local" | "spoonacular" | "none";
  userRating: number | null;
};

const SPOONACULAR_SCORE_MAX = 100;
const STAR_SCALE_MAX = 5;

function scaleSpoonacularScore(score: number): number {
  return Math.round((score / SPOONACULAR_SCORE_MAX) * STAR_SCALE_MAX * 10) / 10;
}

function summarizeRatings(
  ratings: { rating: number; userId: string }[],
  userId: string | null,
  spoonacularScore: number | null
): RatingSummary {
  const userRating = userId ? ratings.find((row) => row.userId === userId)?.rating ?? null : null;

  if (ratings.length > 0) {
    const total = ratings.reduce((sum, row) => sum + row.rating, 0);
    const average = Math.round((total / ratings.length) * 10) / 10;
    return { average, count: ratings.length, source: "local", userRating };
  }

  if (spoonacularScore !== null) {
    return { average: scaleSpoonacularScore(spoonacularScore), count: 0, source: "spoonacular", userRating: null };
  }

  return { average: 0, count: 0, source: "none", userRating: null };
}

// spoonacularScore is passed in rather than fetched here - it's already
// cached on the recipes row from the one-time /information fetch the
// recipe detail page triggers (see lib/recipe-detail.ts), so no extra
// Spoonacular call is needed just to show a fallback rating.
export async function getRatingSummary(
  recipeId: string,
  userId: string | null,
  spoonacularScore: number | null
): Promise<RatingSummary> {
  const { data, error } = await supabaseAdmin
    .from("recipe_ratings")
    .select("rating, user_id")
    .eq("recipe_id", recipeId);

  if (error || !data) {
    return { average: 0, count: 0, source: "none", userRating: null };
  }

  return summarizeRatings(
    data.map((row) => ({ rating: row.rating as number, userId: row.user_id as string })),
    userId,
    spoonacularScore
  );
}

// Batched version for a page of search results - two queries total
// (ratings + spoonacular_score), regardless of how many recipe ids are
// passed in, so showing ratings on the home page's results grid doesn't
// turn into one query per card.
export async function getRatingSummaries(
  recipeIds: string[],
  userId: string | null
): Promise<Record<string, RatingSummary>> {
  if (recipeIds.length === 0) {
    return {};
  }

  const [ratingsResult, recipesResult] = await Promise.all([
    supabaseAdmin.from("recipe_ratings").select("recipe_id, rating, user_id").in("recipe_id", recipeIds),
    supabaseAdmin.from("recipes").select("recipe_id, spoonacular_score").in("recipe_id", recipeIds),
  ]);

  const spoonacularScoreByRecipeId = new Map(
    (recipesResult.data ?? []).map((row) => [
      row.recipe_id as string,
      row.spoonacular_score as number | null,
    ])
  );

  const ratingsByRecipeId = new Map<string, { rating: number; userId: string }[]>();
  for (const row of ratingsResult.data ?? []) {
    const recipeId = row.recipe_id as string;
    const list = ratingsByRecipeId.get(recipeId) ?? [];
    list.push({ rating: row.rating as number, userId: row.user_id as string });
    ratingsByRecipeId.set(recipeId, list);
  }

  const summaries: Record<string, RatingSummary> = {};
  for (const recipeId of recipeIds) {
    summaries[recipeId] = summarizeRatings(
      ratingsByRecipeId.get(recipeId) ?? [],
      userId,
      spoonacularScoreByRecipeId.get(recipeId) ?? null
    );
  }

  return summaries;
}

export async function setRating(userId: string, recipeId: string, rating: number): Promise<void> {
  const { error } = await supabaseAdmin
    .from("recipe_ratings")
    .upsert({ user_id: userId, recipe_id: recipeId, rating }, { onConflict: "user_id,recipe_id" });

  if (error) {
    if (error.code === "23503") {
      throw new RecipeNotFoundError();
    }
    throw new Error(`Failed to set rating: ${error.message}`);
  }
}

export async function removeRating(userId: string, recipeId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("recipe_ratings")
    .delete()
    .eq("user_id", userId)
    .eq("recipe_id", recipeId);

  if (error) {
    throw new Error(`Failed to remove rating: ${error.message}`);
  }
}
