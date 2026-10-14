import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { addFavorite, removeFavorite, RecipeNotFoundError } from "@/lib/favorites";
import { isUuid } from "@/lib/uuid";

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ recipeId: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  const { recipeId } = await params;
  if (!isUuid(recipeId)) {
    return NextResponse.json({ message: "Invalid recipe id." }, { status: 400 });
  }

  try {
    await addFavorite(session.userId, recipeId);
    return NextResponse.json({ message: "Favorited." });
  } catch (error) {
    if (error instanceof RecipeNotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    console.error("Failed to add favorite:", error);
    return NextResponse.json({ message: "Could not favorite this recipe." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ recipeId: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  const { recipeId } = await params;
  if (!isUuid(recipeId)) {
    return NextResponse.json({ message: "Invalid recipe id." }, { status: 400 });
  }

  try {
    await removeFavorite(session.userId, recipeId);
    return NextResponse.json({ message: "Unfavorited." });
  } catch (error) {
    console.error("Failed to remove favorite:", error);
    return NextResponse.json({ message: "Could not unfavorite this recipe." }, { status: 500 });
  }
}
