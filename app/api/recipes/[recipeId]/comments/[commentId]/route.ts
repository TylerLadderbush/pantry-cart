import { NextResponse } from "next/server";
import { verifySession } from "@/lib/auth/session";
import { deleteComment } from "@/lib/comments";
import { isUuid } from "@/lib/uuid";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ recipeId: string; commentId: string }> }
) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  const { commentId } = await params;
  if (!isUuid(commentId)) {
    return NextResponse.json({ message: "Invalid comment id." }, { status: 400 });
  }

  try {
    await deleteComment(session.userId, commentId);
    return NextResponse.json({ message: "Comment deleted." });
  } catch (error) {
    console.error("Failed to delete comment:", error);
    return NextResponse.json({ message: "Could not delete the comment." }, { status: 500 });
  }
}
