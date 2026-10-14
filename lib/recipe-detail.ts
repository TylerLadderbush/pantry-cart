import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/uuid";

const SPOONACULAR_RECIPE_URL = "https://api.spoonacular.com/recipes";

const apiKey = process.env.SPOONACULAR_API_KEY;
if (!apiKey) {
  throw new Error("SPOONACULAR_API_KEY environment variable is not set.");
}

export type RecipeIngredient = {
  ingredientId: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  originalText: string | null;
  preparation: string[] | null;
};

type AnalyzedInstructionStep = {
  number: number;
  step: string;
};

type AnalyzedInstructionSet = {
  name: string;
  steps: AnalyzedInstructionStep[];
};

export type RecipeDetail = {
  recipeId: string;
  userId: string | null;
  spoonacularId: number | null;
  source: "spoonacular" | "user";
  title: string;
  imageUrl: string | null;
  imageType: string | null;
  summary: string | null;
  instructions: string | null;
  analyzedInstructions: AnalyzedInstructionSet[] | null;
  servings: number | null;
  readyInMinutes: number | null;
  preparationMinutes: number | null;
  cookingMinutes: number | null;
  cuisines: string[] | null;
  dishTypes: string[] | null;
  diets: string[] | null;
  occasions: string[] | null;
  isVegetarian: boolean | null;
  isVegan: boolean | null;
  isGlutenFree: boolean | null;
  isDairyFree: boolean | null;
  isVeryHealthy: boolean | null;
  isCheap: boolean | null;
  isVeryPopular: boolean | null;
  isSustainable: boolean | null;
  isLowFodmap: boolean | null;
  gaps: string | null;
  calories: number | null;
  proteinGrams: number | null;
  fatGrams: number | null;
  carbsGrams: number | null;
  healthScore: number | null;
  weightWatcherSmartPoints: number | null;
  pricePerServing: number | null;
  aggregateLikes: number | null;
  spoonacularScore: number | null;
  sourceUrl: string | null;
  sourceName: string | null;
  creditsText: string | null;
  license: string | null;
  spoonacularSourceUrl: string | null;
  language: string | null;
  createdAt: string;
  ingredients: RecipeIngredient[];
};

type RecipeRow = {
  recipe_id: string;
  user_id: string | null;
  spoonacular_id: number | null;
  source: "spoonacular" | "user";
  title: string;
  image_url: string | null;
  image_type: string | null;
  summary: string | null;
  instructions: string | null;
  analyzed_instructions: unknown;
  servings: number | null;
  ready_in_minutes: number | null;
  preparation_minutes: number | null;
  cooking_minutes: number | null;
  cuisines: string[] | null;
  dish_types: string[] | null;
  diets: string[] | null;
  occasions: string[] | null;
  is_vegetarian: boolean | null;
  is_vegan: boolean | null;
  is_gluten_free: boolean | null;
  is_dairy_free: boolean | null;
  is_very_healthy: boolean | null;
  is_cheap: boolean | null;
  is_very_popular: boolean | null;
  is_sustainable: boolean | null;
  is_low_fodmap: boolean | null;
  gaps: string | null;
  calories: number | null;
  protein_grams: number | null;
  fat_grams: number | null;
  carbs_grams: number | null;
  health_score: number | null;
  weight_watcher_smart_points: number | null;
  price_per_serving: number | null;
  aggregate_likes: number | null;
  spoonacular_score: number | null;
  source_url: string | null;
  source_name: string | null;
  credits_text: string | null;
  license: string | null;
  spoonacular_source_url: string | null;
  language: string | null;
  created_at: string;
};

type SpoonacularExtendedIngredient = {
  name: string;
  aisle?: string | null;
  amount?: number | null;
  unit?: string | null;
  original?: string | null;
  meta?: string[] | null;
};

// Fetches a single recipe for the recipe detail page, handling both sources:
//   - source = 'user': every column was already filled in when the recipe
//     was created, so the DB row is returned as-is - no external call.
//   - source = 'spoonacular': recipe search only ever caches title/image_url
//     (see cacheRecipes in lib/recipes.ts). The first time anyone opens this
//     recipe's page, the rest of its data is fetched from Spoonacular's
//     /information endpoint here and persisted; every later visit, by
//     anyone, reads straight from the DB with no further Spoonacular call.
//     `summary` being null is the signal that this hasn't happened yet.
export async function getRecipeDetail(recipeId: string): Promise<RecipeDetail | null> {
  if (!isUuid(recipeId)) {
    return null;
  }

  const { data: row, error } = await supabaseAdmin
    .from("recipes")
    .select("*")
    .eq("recipe_id", recipeId)
    .maybeSingle();

  if (error || !row) {
    return null;
  }

  let recipe = row as RecipeRow;

  if (recipe.source === "spoonacular" && recipe.summary === null && recipe.spoonacular_id) {
    try {
      await fetchAndCacheSpoonacularDetail(recipeId, recipe.spoonacular_id);
      const { data: refreshed } = await supabaseAdmin
        .from("recipes")
        .select("*")
        .eq("recipe_id", recipeId)
        .maybeSingle();
      if (refreshed) {
        recipe = refreshed as RecipeRow;
      }
    } catch (detailError) {
      // Caching the fuller detail is best-effort - if Spoonacular is down
      // or rate-limited, still show whatever the recipe already has
      // (at minimum title/image from search) rather than erroring the page.
      console.error("Failed to fetch recipe detail from Spoonacular:", detailError);
    }
  }

  const ingredients = await getRecipeIngredients(recipeId);
  return mapRecipeRow(recipe, ingredients);
}

async function getRecipeIngredients(recipeId: string): Promise<RecipeIngredient[]> {
  const { data, error } = await supabaseAdmin
    .from("recipe_ingredients")
    .select("ingredient_id, quantity, unit, original_text, preparation, ingredients(name)")
    .eq("recipe_id", recipeId);

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    ingredientId: row.ingredient_id as string,
    name: (row.ingredients as unknown as { name: string } | null)?.name ?? "",
    quantity: row.quantity,
    unit: row.unit,
    originalText: row.original_text,
    preparation: row.preparation,
  }));
}

function mapRecipeRow(row: RecipeRow, ingredients: RecipeIngredient[]): RecipeDetail {
  return {
    recipeId: row.recipe_id,
    userId: row.user_id,
    spoonacularId: row.spoonacular_id,
    source: row.source,
    title: row.title,
    imageUrl: row.image_url,
    imageType: row.image_type,
    summary: row.summary,
    instructions: row.instructions,
    analyzedInstructions: Array.isArray(row.analyzed_instructions)
      ? (row.analyzed_instructions as AnalyzedInstructionSet[])
      : null,
    servings: row.servings,
    readyInMinutes: row.ready_in_minutes,
    preparationMinutes: row.preparation_minutes,
    cookingMinutes: row.cooking_minutes,
    cuisines: row.cuisines,
    dishTypes: row.dish_types,
    diets: row.diets,
    occasions: row.occasions,
    isVegetarian: row.is_vegetarian,
    isVegan: row.is_vegan,
    isGlutenFree: row.is_gluten_free,
    isDairyFree: row.is_dairy_free,
    isVeryHealthy: row.is_very_healthy,
    isCheap: row.is_cheap,
    isVeryPopular: row.is_very_popular,
    isSustainable: row.is_sustainable,
    isLowFodmap: row.is_low_fodmap,
    gaps: row.gaps,
    calories: row.calories,
    proteinGrams: row.protein_grams,
    fatGrams: row.fat_grams,
    carbsGrams: row.carbs_grams,
    healthScore: row.health_score,
    weightWatcherSmartPoints: row.weight_watcher_smart_points,
    pricePerServing: row.price_per_serving,
    aggregateLikes: row.aggregate_likes,
    spoonacularScore: row.spoonacular_score,
    sourceUrl: row.source_url,
    sourceName: row.source_name,
    creditsText: row.credits_text,
    license: row.license,
    spoonacularSourceUrl: row.spoonacular_source_url,
    language: row.language,
    createdAt: row.created_at,
    ingredients,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- third-party JSON, shape verified against the real API rather than fully typed
type SpoonacularRecipeInfo = any;

function buildRecipeUpdatePayload(data: SpoonacularRecipeInfo) {
  const nutrients: { name: string; amount: number }[] = Array.isArray(data.nutrition?.nutrients)
    ? data.nutrition.nutrients
    : [];
  const findNutrient = (name: string) => nutrients.find((nutrient) => nutrient.name === name);
  const caloriesNutrient = findNutrient("Calories");
  const proteinNutrient = findNutrient("Protein");
  const fatNutrient = findNutrient("Fat");
  const carbsNutrient = findNutrient("Carbohydrates");

  return {
    title: data.title,
    image_url: data.image ?? null,
    image_type: data.imageType ?? null,
    summary: data.summary ?? null,
    instructions: data.instructions ?? null,
    analyzed_instructions: Array.isArray(data.analyzedInstructions)
      ? data.analyzedInstructions
      : null,
    servings: data.servings ?? null,
    ready_in_minutes: data.readyInMinutes ?? null,
    preparation_minutes: data.preparationMinutes ?? null,
    cooking_minutes: data.cookingMinutes ?? null,
    cuisines: data.cuisines ?? null,
    dish_types: data.dishTypes ?? null,
    diets: data.diets ?? null,
    occasions: data.occasions ?? null,
    is_vegetarian: data.vegetarian ?? null,
    is_vegan: data.vegan ?? null,
    is_gluten_free: data.glutenFree ?? null,
    is_dairy_free: data.dairyFree ?? null,
    is_very_healthy: data.veryHealthy ?? null,
    is_cheap: data.cheap ?? null,
    is_very_popular: data.veryPopular ?? null,
    is_sustainable: data.sustainable ?? null,
    is_low_fodmap: data.lowFodmap ?? null,
    gaps: data.gaps ?? null,
    calories: caloriesNutrient ? Math.round(caloriesNutrient.amount) : null,
    protein_grams: proteinNutrient ? proteinNutrient.amount : null,
    fat_grams: fatNutrient ? fatNutrient.amount : null,
    carbs_grams: carbsNutrient ? carbsNutrient.amount : null,
    health_score: data.healthScore ?? null,
    weight_watcher_smart_points: data.weightWatcherSmartPoints ?? null,
    price_per_serving: data.pricePerServing ?? null,
    aggregate_likes: data.aggregateLikes ?? null,
    spoonacular_score: data.spoonacularScore ?? null,
    source_url: data.sourceUrl ?? null,
    source_name: data.sourceName ?? null,
    credits_text: data.creditsText ?? null,
    license: data.license ?? null,
    spoonacular_source_url: data.spoonacularSourceUrl ?? null,
    language: data.language ?? null,
  };
}

// Applies one Spoonacular /information-shaped object to one recipe row -
// shared by the single-recipe fetch (recipe detail page) and the bulk
// backfill (search results missing a rating), so both stay in sync.
async function cacheRecipeDetailFromSpoonacularInfo(
  recipeId: string,
  data: SpoonacularRecipeInfo
): Promise<void> {
  const { error: updateError } = await supabaseAdmin
    .from("recipes")
    .update(buildRecipeUpdatePayload(data))
    .eq("recipe_id", recipeId);

  if (updateError) {
    throw new Error(`Failed to save recipe detail: ${updateError.message}`);
  }

  const ingredients: SpoonacularExtendedIngredient[] = Array.isArray(data.extendedIngredients)
    ? data.extendedIngredients
    : [];

  for (const ingredient of ingredients) {
    await upsertRecipeIngredient(recipeId, ingredient);
  }
}

async function fetchAndCacheSpoonacularDetail(
  recipeId: string,
  spoonacularId: number
): Promise<void> {
  const url = new URL(`${SPOONACULAR_RECIPE_URL}/${spoonacularId}/information`);
  url.searchParams.set("apiKey", apiKey as string);
  // Needed to get calories - unlike most other fields, nutrition data isn't
  // included in the base /information response.
  url.searchParams.set("includeNutrition", "true");

  const res = await fetch(url.toString(), {
    // A recipe's own detail changes far less often than search result
    // listings - cache a day rather than the hour used for search.
    next: { revalidate: 60 * 60 * 24 },
  });

  if (!res.ok) {
    throw new Error(`Spoonacular detail request failed with status ${res.status}`);
  }

  const data = await res.json();
  await cacheRecipeDetailFromSpoonacularInfo(recipeId, data);
}

// Bulk-fills recipes that are missing their Spoonacular detail (and
// therefore a real rating to fall back to) in ONE Spoonacular call via
// informationBulk, instead of one call per recipe - used wherever many
// recipes are shown at once (the home page's search results), as opposed
// to fetchAndCacheSpoonacularDetail above, which handles a single recipe
// (the recipe detail page). `summary IS NULL` is the same "not yet
// detail-fetched" signal used everywhere else in this file.
export async function backfillMissingRatingData(recipeIds: string[]): Promise<void> {
  if (recipeIds.length === 0) {
    return;
  }

  const { data: candidates, error } = await supabaseAdmin
    .from("recipes")
    .select("recipe_id, spoonacular_id")
    .in("recipe_id", recipeIds)
    .eq("source", "spoonacular")
    .is("summary", null)
    .not("spoonacular_id", "is", null);

  if (error || !candidates || candidates.length === 0) {
    return;
  }

  try {
    const recipeIdBySpoonacularId = new Map(
      candidates.map((row) => [row.spoonacular_id as number, row.recipe_id as string])
    );

    const url = new URL(`${SPOONACULAR_RECIPE_URL}/informationBulk`);
    url.searchParams.set("apiKey", apiKey as string);
    url.searchParams.set("ids", candidates.map((row) => row.spoonacular_id).join(","));
    url.searchParams.set("includeNutrition", "true");

    const res = await fetch(url.toString(), {
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!res.ok) {
      throw new Error(`Spoonacular bulk detail request failed with status ${res.status}`);
    }

    const results: SpoonacularRecipeInfo[] = await res.json();
    for (const item of results) {
      const recipeId = recipeIdBySpoonacularId.get(item.id);
      if (recipeId) {
        await cacheRecipeDetailFromSpoonacularInfo(recipeId, item);
      }
    }
  } catch (bulkError) {
    // Best-effort, same as the single-recipe path - a Spoonacular outage
    // here should never break the page that triggered it.
    console.error("Failed to backfill missing recipe rating data:", bulkError);
  }
}

async function upsertRecipeIngredient(
  recipeId: string,
  ingredient: SpoonacularExtendedIngredient
): Promise<void> {
  const { data: ingredientRow, error: ingredientError } = await supabaseAdmin
    .from("ingredients")
    .upsert({ name: ingredient.name, category: ingredient.aisle ?? null }, { onConflict: "name" })
    .select("ingredient_id")
    .single();

  if (ingredientError || !ingredientRow) {
    console.error("Failed to cache ingredient:", ingredientError);
    return;
  }

  const { error: linkError } = await supabaseAdmin.from("recipe_ingredients").upsert(
    {
      recipe_id: recipeId,
      ingredient_id: ingredientRow.ingredient_id,
      quantity: ingredient.amount ?? null,
      unit: ingredient.unit ?? null,
      original_text: ingredient.original ?? null,
      preparation: ingredient.meta && ingredient.meta.length > 0 ? ingredient.meta : null,
    },
    { onConflict: "recipe_id,ingredient_id" }
  );

  if (linkError) {
    console.error("Failed to link recipe ingredient:", linkError);
  }
}
