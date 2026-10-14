import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { searchRecipes } from "@/lib/recipes";
import { getRatingSummaries } from "@/lib/ratings";
import { backfillMissingRatingData } from "@/lib/recipe-detail";
import { RECIPE_BATCH_SIZE } from "@/lib/recipe-filters";

export async function GET(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const offsetParam = Number.parseInt(searchParams.get("offset") ?? "0", 10);
  const offset = Number.isFinite(offsetParam) && offsetParam >= 0 ? offsetParam : 0;

  try {
    const recipes = await searchRecipes({
      query: searchParams.get("query") ?? undefined,
      cuisine: searchParams.get("cuisine") ?? undefined,
      diet: searchParams.get("diet") ?? undefined,
      intolerances: searchParams.get("intolerances") ?? undefined,
      number: RECIPE_BATCH_SIZE,
      offset,
    });

    const recipeIds = recipes
      .map((recipe) => recipe.recipeId)
      .filter((recipeId): recipeId is string => recipeId !== null);

    // One bulk Spoonacular call (if any are actually missing it) instead of
    // one per recipe, so this batch's ratings reflect real data rather than
    // "no ratings yet" just because search caching only stores title/image.
    await backfillMissingRatingData(recipeIds);
    const ratings = await getRatingSummaries(recipeIds, session.userId);

    return NextResponse.json({ recipes, ratings });
  } catch (error) {
    console.error("Recipe search failed:", error);
    return NextResponse.json(
      { message: "Something went wrong while searching for recipes. Please try again." },
      { status: 502 }
    );
  }
}
