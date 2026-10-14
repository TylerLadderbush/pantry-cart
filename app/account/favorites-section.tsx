"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

type FavoriteRecipe = {
  recipeId: string;
  id: number | null;
  title: string;
  image: string | null;
};

// How long an unfavorited recipe stays undo-able before it's gone from
// view for good - a safety net for an accidental click.
const UNDO_WINDOW_MS = 5000;

export default function FavoritesSection({
  initialFavorites,
}: {
  initialFavorites: FavoriteRecipe[];
}) {
  const [favorites, setFavorites] = useState(initialFavorites);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [undoRecipe, setUndoRecipe] = useState<FavoriteRecipe | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const visibleFavorites = useMemo(() => {
    if (!query.trim()) return favorites;
    const needle = query.trim().toLowerCase();
    return favorites.filter((recipe) => recipe.title.toLowerCase().includes(needle));
  }, [favorites, query]);

  async function removeFavorite(recipe: FavoriteRecipe) {
    const previous = favorites;
    setFavorites((current) => current.filter((item) => item.recipeId !== recipe.recipeId));

    const res = await fetch(`/api/favorites/${recipe.recipeId}`, { method: "DELETE" }).catch(
      () => null
    );
    if (!res || !res.ok) {
      setFavorites(previous);
      return;
    }

    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoRecipe(recipe);
    undoTimerRef.current = setTimeout(() => setUndoRecipe(null), UNDO_WINDOW_MS);
  }

  async function undoRemove() {
    if (!undoRecipe) return;
    const recipe = undoRecipe;

    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setUndoRecipe(null);
    setFavorites((current) => [recipe, ...current]);

    const res = await fetch(`/api/favorites/${recipe.recipeId}`, { method: "PUT" }).catch(
      () => null
    );
    if (!res || !res.ok) {
      // Re-favoriting failed server-side - don't leave a favorite showing
      // that isn't actually saved.
      setFavorites((current) => current.filter((item) => item.recipeId !== recipe.recipeId));
    }
  }

  return (
    <div className="ml-20 max-w-3xl">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-2xl font-bold">Favorite Recipes</h2>
        {!searchOpen && (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="rounded-lg border bg-white/70 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Search
          </button>
        )}
      </div>

      {searchOpen && (
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search your favorite recipes..."
          className="mb-4 w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-700"
        />
      )}

      {undoRecipe && (
        <div className="mb-4 flex items-center justify-between rounded-lg border bg-yellow-50 px-4 py-2 text-sm">
          <span>
            Removed &quot;{undoRecipe.title}&quot; from favorites.
          </span>
          <button
            type="button"
            onClick={undoRemove}
            className="font-semibold text-green-700 underline"
          >
            Undo
          </button>
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-lg border p-4">
        {favorites.length === 0 && (
          <p className="text-sm text-gray-500">
            You haven&apos;t favorited any recipes yet - look for the heart on a recipe card.
          </p>
        )}

        {favorites.length > 0 && visibleFavorites.length === 0 && (
          <p className="text-sm text-gray-500">No favorites match &quot;{query}&quot;.</p>
        )}

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {visibleFavorites.map((recipe) => (
            <div
              key={recipe.recipeId}
              className="relative overflow-hidden rounded-lg border bg-white"
            >
              {/* Sibling of the Link below, not nested inside it - a
                  button inside an anchor is invalid HTML and would make
                  the heart's click also navigate. */}
              <button
                type="button"
                onClick={() => removeFavorite(recipe)}
                aria-label="Remove from favorites"
                aria-pressed="true"
                className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-3xl leading-none text-red-500 shadow"
              >
                ♥
              </button>
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
                <p className="px-3 py-2 text-sm font-medium text-gray-900">{recipe.title}</p>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
