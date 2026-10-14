import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";

export type FavoriteRecipe = {
  recipeId: string;
  // Null for a future user-created recipe (no spoonacular_id). Every
  // favorite today is Spoonacular-sourced, but the shape should already
  // allow for that without another migration.
  id: number | null;
  title: string;
  image: string | null;
};

// Postgres error code for a foreign key violation - thrown here when
// recipeId doesn't reference an existing recipes row (e.g. a bad id, or one
// that raced a delete). Callers use this to tell "recipe doesn't exist"
// apart from a generic database failure.
const FOREIGN_KEY_VIOLATION = "23503";

export class RecipeNotFoundError extends Error {
  constructor() {
    super("Recipe not found.");
  }
}

// Upsert instead of a plain insert so favoriting an already-favorited
// recipe (e.g. a doubled-up click, or two tabs open) is a harmless no-op
// rather than a unique-violation error.
export async function addFavorite(userId: string, recipeId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("favorites")
    .upsert({ user_id: userId, recipe_id: recipeId }, { onConflict: "user_id,recipe_id" });

  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      throw new RecipeNotFoundError();
    }
    throw new Error(`Failed to add favorite: ${error.message}`);
  }
}

// Deleting a favorite that doesn't exist is also a harmless no-op (Supabase
// doesn't error on a delete matching zero rows), which is the right
// behavior for an "unfavorite" action - the end state the caller wants
// (not favorited) is already true.
export async function removeFavorite(userId: string, recipeId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("favorites")
    .delete()
    .eq("user_id", userId)
    .eq("recipe_id", recipeId);

  if (error) {
    throw new Error(`Failed to remove favorite: ${error.message}`);
  }
}

// Lightweight: just the ids, for marking which of a batch of search results
// are already favorited. Kept separate from listFavorites (below) so the
// home page doesn't have to pull every favorited recipe's title/image just
// to check membership.
export async function listFavoriteRecipeIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin
    .from("favorites")
    .select("recipe_id")
    .eq("user_id", userId);

  if (error || !data) {
    return new Set();
  }

  return new Set(data.map((row) => row.recipe_id as string));
}

// Full recipe details for the profile page's favorites list, newest first.
export async function listFavorites(userId: string): Promise<FavoriteRecipe[]> {
  const { data, error } = await supabaseAdmin
    .from("favorites")
    .select("recipe_id, created_at, recipes(spoonacular_id, title, image_url)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data
    .filter((row) => row.recipes)
    .map((row) => {
      const recipe = row.recipes as unknown as {
        spoonacular_id: number | null;
        title: string;
        image_url: string | null;
      };
      return {
        recipeId: row.recipe_id as string,
        id: recipe.spoonacular_id,
        title: recipe.title,
        image: recipe.image_url,
      };
    });
}
