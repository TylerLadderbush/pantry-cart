import { notFound, redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import { getRecipeDetail } from "@/lib/recipe-detail";
import { getRatingSummary } from "@/lib/ratings";
import { getComments } from "@/lib/comments";
import AppHeader from "@/app/_components/app-header";
import RatingAndComments from "@/app/recipes/[recipeId]/rating-and-comments";
import InstructionsChecklist from "@/app/recipes/[recipeId]/instructions-checklist";

function formatNumber(value: number | null, suffix = ""): string {
  if (value === null) return "—";
  return `${value}${suffix}`;
}

function formatGrams(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value)}g`;
}

export default async function RecipePage({
  params,
}: {
  params: Promise<{ recipeId: string }>;
}) {
  const session = await verifySession();
  if (!session) {
    redirect("/login");
  }

  const { recipeId } = await params;
  const recipe = await getRecipeDetail(recipeId);

  if (!recipe) {
    notFound();
  }

  const [ratingSummary, comments] = await Promise.all([
    getRatingSummary(recipeId, session.userId, recipe.spoonacularScore),
    getComments(recipeId),
  ]);

  // Spoonacular's description/instructions are author-formatted HTML from a
  // trusted third-party API - safe to render directly. A future
  // user-authored recipe (source === "user") must never go through the
  // dangerouslySetInnerHTML path, since that field would then hold
  // arbitrary user input.
  const isTrustedHtml = recipe.source === "spoonacular";

  return (
    <main className="min-h-screen bg-stone-50 text-gray-900">
      <AppHeader />

      <article className="mx-auto max-w-7xl px-8 py-10">
        <div className="relative mb-6 flex flex-col items-center gap-4 text-center sm:block sm:min-h-56">
          {recipe.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- external third-party image URL from Spoonacular
            <img
              src={recipe.imageUrl}
              alt={recipe.title}
              className="h-56 w-56 shrink-0 rounded-lg border object-cover sm:absolute sm:left-0 sm:top-0"
            />
          )}
          <div className="mx-auto max-w-2xl">
            <h1 className="text-3xl font-bold">{recipe.title}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {recipe.source === "spoonacular" ? "From Spoonacular" : "User recipe"}
            </p>

            <div className="mt-4 grid grid-cols-2 gap-4 text-center text-sm sm:grid-cols-4">
              <div>
                <p className="text-gray-500">Servings</p>
                <p className="font-medium">{formatNumber(recipe.servings)}</p>
              </div>
              <div>
                <p className="text-gray-500">Ready in</p>
                <p className="font-medium">{formatNumber(recipe.readyInMinutes, " min")}</p>
              </div>
              <div>
                <p className="text-gray-500">Prep time</p>
                <p className="font-medium">{formatNumber(recipe.preparationMinutes, " min")}</p>
              </div>
              <div>
                <p className="text-gray-500">Cook time</p>
                <p className="font-medium">{formatNumber(recipe.cookingMinutes, " min")}</p>
              </div>
              <div>
                <p className="text-gray-500">Calories</p>
                <p className="font-medium">{formatNumber(recipe.calories, " kcal")}</p>
              </div>
              <div>
                <p className="text-gray-500">Protein</p>
                <p className="font-medium">{formatGrams(recipe.proteinGrams)}</p>
              </div>
              <div>
                <p className="text-gray-500">Fat</p>
                <p className="font-medium">{formatGrams(recipe.fatGrams)}</p>
              </div>
              <div>
                <p className="text-gray-500">Carbs</p>
                <p className="font-medium">{formatGrams(recipe.carbsGrams)}</p>
              </div>
            </div>
          </div>
        </div>

        {recipe.summary && (
          <section className="mb-6 rounded-lg border bg-white p-4">
            <h2 className="mb-2 text-lg font-semibold">Description</h2>
            {isTrustedHtml ? (
              <div
                className="text-sm text-gray-700"
                dangerouslySetInnerHTML={{ __html: recipe.summary }}
              />
            ) : (
              <p className="whitespace-pre-wrap text-sm text-gray-700">{recipe.summary}</p>
            )}
          </section>
        )}

        {recipe.ingredients.length > 0 && (
          <section className="mb-6 rounded-lg border bg-white p-4">
            <h2 className="mb-2 text-lg font-semibold">Ingredients</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
              {recipe.ingredients.map((ingredient) => (
                <li key={ingredient.ingredientId}>
                  {ingredient.originalText ??
                    [ingredient.quantity, ingredient.unit, ingredient.name]
                      .filter(Boolean)
                      .join(" ")}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mb-6 rounded-lg border bg-white p-4">
          <h2 className="mb-2 text-lg font-semibold">Instructions</h2>
          {recipe.analyzedInstructions && recipe.analyzedInstructions.length > 0 ? (
            <InstructionsChecklist instructionSets={recipe.analyzedInstructions} />
          ) : recipe.instructions ? (
            isTrustedHtml ? (
              <div
                className="text-sm text-gray-700"
                dangerouslySetInnerHTML={{ __html: recipe.instructions }}
              />
            ) : (
              <p className="whitespace-pre-wrap text-sm text-gray-700">{recipe.instructions}</p>
            )
          ) : (
            <p className="text-sm text-gray-500">No instructions available.</p>
          )}
        </section>

        <RatingAndComments
          recipeId={recipe.recipeId}
          currentUserId={session.userId}
          initialRating={ratingSummary}
          initialComments={comments}
        />
      </article>
    </main>
  );
}
