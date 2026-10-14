"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { CUISINES, DIETS, INTOLERANCES, RECIPE_BATCH_SIZE } from "@/lib/recipe-filters";
import { aggregateStars } from "@/lib/stars";

type Recipe = {
  id: number;
  recipeId: string | null;
  title: string;
  image: string | null;
};

type RatingSummary = {
  average: number;
  count: number;
  source: "local" | "spoonacular" | "none";
  userRating: number | null;
};

export default function RecipeSearch({
  initialRecipes,
  initialError,
  initialFavoriteIds,
  initialRatings,
}: {
  initialRecipes: Recipe[];
  initialError: string | null;
  initialFavoriteIds: string[];
  initialRatings: Record<string, RatingSummary>;
}) {
  const [recipes, setRecipes] = useState(initialRecipes);
  const [query, setQuery] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [diet, setDiet] = useState("");
  const [selectedIntolerances, setSelectedIntolerances] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialRecipes.length === RECIPE_BATCH_SIZE);
  const [offset, setOffset] = useState(initialRecipes.length);
  const [error, setError] = useState<string | null>(initialError);
  const [favoriteIds, setFavoriteIds] = useState(() => new Set(initialFavoriteIds));
  const [ratings, setRatings] = useState(initialRatings);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  function buildParams(requestOffset: number) {
    const params = new URLSearchParams();
    if (query) params.set("query", query);
    if (cuisine) params.set("cuisine", cuisine);
    if (diet) params.set("diet", diet);
    if (selectedIntolerances.length > 0) {
      params.set("intolerances", selectedIntolerances.join(","));
    }
    params.set("offset", String(requestOffset));
    return params;
  }

  // Optimistic: flips the star immediately, then reverts if the request
  // fails. recipeId is only null if caching that recipe into our DB failed
  // (see the comment on RecipeSummary in lib/recipes.ts) - there's nothing
  // to favorite against yet in that rare case, so the button is disabled.
  async function toggleFavorite(recipe: Recipe) {
    if (!recipe.recipeId) return;
    const recipeId = recipe.recipeId;
    const wasFavorited = favoriteIds.has(recipeId);

    setFavoriteIds((current) => {
      const next = new Set(current);
      if (wasFavorited) {
        next.delete(recipeId);
      } else {
        next.add(recipeId);
      }
      return next;
    });

    const res = await fetch(`/api/favorites/${recipeId}`, {
      method: wasFavorited ? "DELETE" : "PUT",
    }).catch(() => null);

    if (!res || !res.ok) {
      setFavoriteIds((current) => {
        const next = new Set(current);
        if (wasFavorited) {
          next.add(recipeId);
        } else {
          next.delete(recipeId);
        }
        return next;
      });
    }
  }

  function toggleIntolerance(value: string) {
    setSelectedIntolerances((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  }

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const res = await fetch(`/api/recipes/search?${buildParams(0).toString()}`);
    const body = await res.json().catch(() => null);
    setPending(false);

    if (!res.ok) {
      setError(body?.message ?? "Something went wrong. Please try again.");
      return;
    }

    setRecipes(body.recipes);
    setRatings(body.ratings ?? {});
    setOffset(body.recipes.length);
    setHasMore(body.recipes.length === RECIPE_BATCH_SIZE);
  }

  async function loadMore() {
    if (loadingMore || !hasMore) {
      return;
    }

    setLoadingMore(true);
    const res = await fetch(`/api/recipes/search?${buildParams(offset).toString()}`);
    const body = await res.json().catch(() => null);
    setLoadingMore(false);

    if (!res.ok) {
      setError(body?.message ?? "Something went wrong loading more recipes.");
      setHasMore(false);
      return;
    }

    // Dedupe by id: once a plain-text query's first page is cache-served
    // (see the comment on the cache-check in lib/recipes.ts), it can
    // occasionally share a recipe with a later live Spoonacular batch.
    // Filtering those out here avoids a duplicate card / React key clash.
    setRecipes((current) => {
      const seen = new Set(current.map((recipe) => recipe.id));
      const deduped = body.recipes.filter((recipe: Recipe) => !seen.has(recipe.id));
      return [...current, ...deduped];
    });
    setRatings((current) => ({ ...current, ...(body.ratings ?? {}) }));
    setOffset((current) => current + body.recipes.length);
    setHasMore(body.recipes.length === RECIPE_BATCH_SIZE);
  }

  // Keeps the IntersectionObserver's callback (set up once, below) always
  // calling the latest loadMore - which closes over the latest offset/
  // hasMore/filter state - without needing to tear down and recreate the
  // observer every time that state changes. Updated in an effect (not
  // during render) since mutating a ref during render is disallowed.
  const loadMoreRef = useRef(loadMore);
  useEffect(() => {
    loadMoreRef.current = loadMore;
  });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMoreRef.current();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleSearch} className="flex flex-col gap-4 rounded-lg border bg-white p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="query" className="text-sm font-medium text-gray-700">
            Search by name or ingredient
          </label>
          <input
            id="query"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="e.g. chicken parmesan"
            className="rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-700"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="cuisine" className="text-sm font-medium text-gray-700">
              Cuisine
            </label>
            <select
              id="cuisine"
              value={cuisine}
              onChange={(event) => setCuisine(event.target.value)}
              className="rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-700"
            >
              <option value="">Any</option>
              {CUISINES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="diet" className="text-sm font-medium text-gray-700">
              Diet
            </label>
            <select
              id="diet"
              value={diet}
              onChange={(event) => setDiet(event.target.value)}
              className="rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-700"
            >
              <option value="">Any</option>
              {DIETS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-gray-700">Allergies / Intolerances</span>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {INTOLERANCES.map((option) => (
              <label key={option} className="flex items-center gap-1.5 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={selectedIntolerances.includes(option)}
                  onChange={() => toggleIntolerance(option)}
                />
                {option}
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-lg bg-green-700 px-6 py-2.5 font-semibold text-white hover:bg-green-800 disabled:opacity-50"
        >
          {pending ? "Searching..." : "Search"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!error && !pending && recipes.length === 0 && (
        <p className="text-sm text-gray-500">No recipes found. Try different filters.</p>
      )}

      <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
        {recipes.map((recipe) => {
          const isFavorited = Boolean(recipe.recipeId && favoriteIds.has(recipe.recipeId));
          const rating = recipe.recipeId ? ratings[recipe.recipeId] : undefined;
          return (
            <div
              key={recipe.id}
              className="relative overflow-hidden rounded-lg border bg-white"
            >
              {/* Sibling of the Link below, not nested inside it - a
                  button inside an anchor is invalid HTML and would make
                  the heart's click also navigate. Heart (not star) so this
                  reads as distinct from the star rating once that's real. */}
              <button
                type="button"
                onClick={() => toggleFavorite(recipe)}
                disabled={!recipe.recipeId}
                aria-label={isFavorited ? "Remove from favorites" : "Add to favorites"}
                aria-pressed={isFavorited}
                className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-3xl leading-none text-red-500 shadow disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isFavorited ? "♥" : "♡"}
              </button>
              {recipe.recipeId ? (
                <Link href={`/recipes/${recipe.recipeId}`} className="block">
                  <div className="aspect-square bg-gray-200">
                    {recipe.image && (
                      // eslint-disable-next-line @next/next/no-img-element -- external third-party image URLs from Spoonacular, not worth configuring Next's image domains for a small thumbnail grid
                      <img
                        src={recipe.image}
                        alt={recipe.title}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <p className="px-3 pt-2 text-sm font-medium text-gray-900">{recipe.title}</p>
                  <p className="px-3 pb-2 text-xs text-gray-500">
                    <span className="text-yellow-500" aria-hidden="true">
                      {aggregateStars(rating?.average ?? 0)}
                    </span>{" "}
                    {!rating || rating.source === "none"
                      ? "No ratings"
                      : rating.source === "local"
                        ? `${rating.average} (${rating.count})`
                        : `${rating.average} (Spoonacular)`}
                  </p>
                </Link>
              ) : (
                <>
                  <div className="aspect-square bg-gray-200">
                    {recipe.image && (
                      // eslint-disable-next-line @next/next/no-img-element -- external third-party image URLs from Spoonacular, not worth configuring Next's image domains for a small thumbnail grid
                      <img
                        src={recipe.image}
                        alt={recipe.title}
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <p className="px-3 py-2 text-sm font-medium text-gray-900">{recipe.title}</p>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Sentinel element - the IntersectionObserver above fires loadMore()
          when this scrolls near the viewport, well before the user actually
          hits the bottom (rootMargin: "200px" triggers it early). */}
      <div ref={sentinelRef} className="h-1" />

      {loadingMore && <p className="text-center text-sm text-gray-500">Loading more recipes...</p>}
      {!hasMore && recipes.length > 0 && (
        <p className="text-center text-sm text-gray-400">You&apos;ve reached the end.</p>
      )}
    </div>
  );
}
