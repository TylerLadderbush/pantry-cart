import "server-only";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { RecipeNotFoundError } from "@/lib/favorites";
import { DEFAULT_AVATAR_PATH } from "@/lib/avatar";

export type RecipeComment = {
  commentId: string;
  userId: string;
  displayName: string;
  avatarUrl: string;
  body: string;
  createdAt: string;
};

const MIN_COMMENT_LENGTH = 1;
const MAX_COMMENT_LENGTH = 2000;

// Comments only ever come from our own users - unlike ratings, there's no
// Spoonacular equivalent to fall back to, so this is the same for both
// recipe sources with no branching needed.
export async function getComments(recipeId: string): Promise<RecipeComment[]> {
  const { data, error } = await supabaseAdmin
    .from("recipe_comments")
    .select("comment_id, user_id, body, created_at, users(display_name, avatar_url)")
    .eq("recipe_id", recipeId)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((row) => {
    const user = row.users as unknown as {
      display_name: string;
      avatar_url: string | null;
    } | null;

    return {
      commentId: row.comment_id as string,
      userId: row.user_id as string,
      displayName: user?.display_name ?? "Unknown",
      avatarUrl: user?.avatar_url ?? DEFAULT_AVATAR_PATH,
      body: row.body as string,
      createdAt: row.created_at as string,
    };
  });
}

// Returns the trimmed body on success, or null if it fails validation -
// callers turn a null into a 400 response.
export function validateCommentBody(body: unknown): string | null {
  if (typeof body !== "string") return null;
  const trimmed = body.trim();
  if (trimmed.length < MIN_COMMENT_LENGTH || trimmed.length > MAX_COMMENT_LENGTH) return null;
  return trimmed;
}

export async function addComment(
  userId: string,
  recipeId: string,
  body: string
): Promise<RecipeComment> {
  const { data: user } = await supabaseAdmin
    .from("users")
    .select("display_name, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  const { data, error } = await supabaseAdmin
    .from("recipe_comments")
    .insert({ user_id: userId, recipe_id: recipeId, body })
    .select("comment_id, created_at")
    .single();

  if (error || !data) {
    if (error?.code === "23503") {
      throw new RecipeNotFoundError();
    }
    throw new Error(`Failed to add comment: ${error?.message}`);
  }

  return {
    commentId: data.comment_id,
    userId,
    displayName: user?.display_name ?? "Unknown",
    avatarUrl: user?.avatar_url ?? DEFAULT_AVATAR_PATH,
    body,
    createdAt: data.created_at,
  };
}

// Scoped to the author via the user_id match - deleting zero rows (not the
// author's comment, or it doesn't exist) is treated as success rather than
// an error, same as unfavoriting something not favorited.
export async function deleteComment(userId: string, commentId: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("recipe_comments")
    .delete()
    .eq("comment_id", commentId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(`Failed to delete comment: ${error.message}`);
  }
}
