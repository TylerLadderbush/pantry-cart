import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { addComment, validateCommentBody } from "@/lib/comments";
import { RecipeNotFoundError } from "@/lib/favorites";
import { isUuid } from "@/lib/uuid";

export async function POST(
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

  const requestBody = await request.json().catch(() => null);
  const body = validateCommentBody(requestBody?.body);
  if (body === null) {
    return NextResponse.json(
      { message: "Comment must be between 1 and 2000 characters." },
      { status: 400 }
    );
  }

  try {
    const comment = await addComment(session.userId, recipeId, body);
    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    if (error instanceof RecipeNotFoundError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }
    console.error("Failed to add comment:", error);
    return NextResponse.json({ message: "Could not post your comment." }, { status: 500 });
  }
}
