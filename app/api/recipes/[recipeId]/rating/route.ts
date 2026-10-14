import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { setRating, removeRating } from "@/lib/ratings";
import { RecipeNotFoundError } from "@/lib/favorites";
import { isUuid } from "@/lib/uuid";

export async function PUT(
  request: Request,
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

  const body = await request.json().catch(() => null);
  const rating = body?.rating;
  if (typeof rating !== "number" || !Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ message: "Rating must be an integer from 1 to 5." }, { status: 400 });
  }

  try {
    await setRating(session.userId, recipeId, rating);
    return NextResponse.json({ message: "Rating saved." });
  } catch (error) {
    if (error instanceof RecipeNotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    console.error("Failed to save rating:", error);
    return NextResponse.json({ message: "Could not save your rating." }, { status: 500 });
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
    await removeRating(session.userId, recipeId);
    return NextResponse.json({ message: "Rating removed." });
  } catch (error) {
    console.error("Failed to remove rating:", error);
    return NextResponse.json({ message: "Could not remove your rating." }, { status: 500 });
  }
}
