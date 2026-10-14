import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { searchRecipes } from "@/lib/recipes";
import { listFavoriteRecipeIds } from "@/lib/favorites";
import { getRatingSummaries } from "@/lib/ratings";
import { backfillMissingRatingData } from "@/lib/recipe-detail";
import { RECIPE_BATCH_SIZE } from "@/lib/recipe-filters";
import AppHeader from "@/app/_components/app-header";
import RecipeSearch from "@/app/home/recipe-search";

export default async function HomePage() {
  const session = await verifySession();
  if (!session) {
    redirect("/login");
  }

  let initialRecipes: Awaited<ReturnType<typeof searchRecipes>> = [];
  let initialError: string | null = null;
  try {
    initialRecipes = await searchRecipes({ number: RECIPE_BATCH_SIZE, offset: 0 });
  } catch (error) {
    console.error("Initial recipe search failed:", error);
    initialError = "Couldn't load recipes right now. Try searching below.";
  }

  const favoriteIds = await listFavoriteRecipeIds(session.userId);
  const recipeIds = initialRecipes
    .map((recipe) => recipe.recipeId)
    .filter((recipeId): recipeId is string => recipeId !== null);

  // One bulk Spoonacular call (if any are actually missing it) instead of
  // one per recipe, so the very first batch shown on page load already
  // has real ratings instead of "no ratings yet" from partial caching.
  await backfillMissingRatingData(recipeIds);
  const ratings = await getRatingSummaries(recipeIds, session.userId);

  return (
    <main className="min-h-screen bg-stone-50 text-gray-900">
      <AppHeader />

      <section className="mx-auto max-w-7xl px-8 py-10">
        <h1 className="mb-6 text-2xl font-bold"></h1>
        <RecipeSearch
          initialRecipes={initialRecipes}
          initialError={initialError}
          initialFavoriteIds={Array.from(favoriteIds)}
          initialRatings={ratings}
        />
      </section>
    </main>
  );
}
