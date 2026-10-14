"use client";

import { useState, type FormEvent } from "react";
import { aggregateStars } from "@/lib/stars";

type RatingSummary = {
  average: number;
  count: number;
  source: "local" | "spoonacular" | "none";
  userRating: number | null;
};

type Comment = {
  commentId: string;
  userId: string;
  displayName: string;
  avatarUrl: string;
  body: string;
  createdAt: string;
};

const STAR_VALUES = [1, 2, 3, 4, 5];

export default function RatingAndComments({
  recipeId,
  currentUserId,
  initialRating,
  initialComments,
}: {
  recipeId: string;
  currentUserId: string;
  initialRating: RatingSummary;
  initialComments: Comment[];
}) {
  const [rating, setRating] = useState(initialRating);
  const [comments, setComments] = useState(initialComments);
  const [commentBody, setCommentBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Optimistic math: moves the user's old contribution (if any) out of the
  // running total and the new one in, so the displayed average updates
  // immediately without waiting on a full page reload. This also correctly
  // handles the Spoonacular-fallback -> real-local-average transition,
  // since a "spoonacular" source always has count 0, making its average's
  // contribution to the total zero regardless of its value.
  async function submitRating(newRating: number) {
    const previous = rating;
    const hadRating = previous.userRating !== null;
    const newCount = hadRating ? previous.count : previous.count + 1;
    const totalBefore = previous.average * previous.count;
    const adjustedTotal = hadRating
      ? totalBefore - (previous.userRating ?? 0) + newRating
      : totalBefore + newRating;
    const newAverage = Math.round((adjustedTotal / newCount) * 10) / 10;

    setRating({ average: newAverage, count: newCount, source: "local", userRating: newRating });
    setError(null);

    const res = await fetch(`/api/recipes/${recipeId}/rating`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating: newRating }),
    }).catch(() => null);

    if (!res || !res.ok) {
      setRating(previous);
      setError("Could not save your rating. Please try again.");
    }
  }

  async function submitComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!commentBody.trim()) return;

    setPosting(true);
    setError(null);

    const res = await fetch(`/api/recipes/${recipeId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: commentBody }),
    }).catch(() => null);
    const resBody = await res?.json().catch(() => null);
    setPosting(false);

    if (!res || !res.ok) {
      setError(resBody?.message ?? "Could not post your comment. Please try again.");
      return;
    }

    setComments((current) => [resBody.comment, ...current]);
    setCommentBody("");
  }

  async function removeComment(commentId: string) {
    const previous = comments;
    setComments((current) => current.filter((comment) => comment.commentId !== commentId));

    const res = await fetch(`/api/recipes/${recipeId}/comments/${commentId}`, {
      method: "DELETE",
    }).catch(() => null);

    if (!res || !res.ok) {
      setComments(previous);
    }
  }

  return (
    <section className="rounded-lg border bg-white p-4">
      <h2 className="mb-2 text-lg font-semibold">Rating & Comments</h2>

      <div className="mb-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl text-yellow-500" aria-hidden="true">
            {aggregateStars(rating.average)}
          </span>
          <span className="text-sm text-gray-500">
            {rating.source === "local" && `${rating.average} / 5 (${rating.count} rating${rating.count === 1 ? "" : "s"})`}
            {rating.source === "spoonacular" && `${rating.average} / 5 (via Spoonacular - no ratings yet)`}
            {rating.source === "none" && "No ratings yet"}
          </span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm text-gray-500">Your rating:</span>
          <div className="flex items-center gap-1">
            {STAR_VALUES.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => submitRating(value)}
                aria-label={`Rate ${value} star${value === 1 ? "" : "s"}`}
                className="text-2xl leading-none text-yellow-500"
              >
                {rating.userRating !== null && value <= rating.userRating ? "★" : "☆"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <form onSubmit={submitComment} className="mb-4 flex flex-col gap-2">
        <textarea
          value={commentBody}
          onChange={(event) => setCommentBody(event.target.value)}
          placeholder="Share your thoughts on this recipe..."
          className="rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
          rows={2}
          maxLength={2000}
        />
        <button
          type="submit"
          disabled={posting || !commentBody.trim()}
          className="self-start rounded bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
        >
          {posting ? "Posting..." : "Post comment"}
        </button>
      </form>

      {comments.length === 0 && <p className="text-sm text-gray-500">No comments yet.</p>}

      <ul className="flex flex-col gap-3">
        {comments.map((comment) => (
          <li key={comment.commentId} className="flex gap-3 rounded border p-3 text-sm">
            {/* eslint-disable-next-line @next/next/no-img-element -- small fixed-size avatar, not worth Next's image pipeline */}
            <img
              src={comment.avatarUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full border object-cover"
            />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-gray-900">{comment.displayName}</p>
                {comment.userId === currentUserId && (
                  <button
                    type="button"
                    onClick={() => removeComment(comment.commentId)}
                    className="text-xs text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                )}
              </div>
              <p className="text-gray-700">{comment.body}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
