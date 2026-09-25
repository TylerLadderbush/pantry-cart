import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import {
  ALLOWED_AVATAR_MIME_TYPES,
  AVATAR_OUTPUT_SIZE,
  MAX_AVATAR_UPLOAD_BYTES,
  formatMaxAvatarSize,
} from "@/lib/avatar";
import { verifySession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

const BUCKET = "avatars";

function pathFor(userId: string) {
  return `${userId}.webp`;
}

export async function POST(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "No image file was provided." }, { status: 400 });
  }

  if (!ALLOWED_AVATAR_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { message: "Please upload a PNG, JPEG, or WebP image." },
      { status: 400 }
    );
  }

  if (file.size > MAX_AVATAR_UPLOAD_BYTES) {
    return NextResponse.json(
      { message: `Image must be smaller than ${formatMaxAvatarSize()}.` },
      { status: 400 }
    );
  }

  const inputBuffer = Buffer.from(await file.arrayBuffer());

  let outputBuffer: Buffer;
  try {
    outputBuffer = await sharp(inputBuffer)
      .resize(AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE, { fit: "cover" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch {
    return NextResponse.json({ message: "That file isn't a valid image." }, { status: 400 });
  }

  const path = pathFor(session.userId);

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, outputBuffer, { contentType: "image/webp", upsert: true });

  if (uploadError) {
    console.error("Avatar upload failed:", uploadError);
    return NextResponse.json(
      { message: "An error occurred while uploading your photo." },
      { status: 500 }
    );
  }

  const {
    data: { publicUrl },
  } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);

  // Cache-bust so the browser doesn't keep showing a stale image after a
  // re-upload to the same deterministic path.
  const avatarUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update({ avatar_url: avatarUrl })
    .eq("id", session.userId);

  if (updateError) {
    console.error("Avatar URL save failed:", updateError);
    return NextResponse.json(
      { message: "An error occurred while saving your photo." },
      { status: 500 }
    );
  }

  return NextResponse.json({ avatar_url: avatarUrl });
}

export async function DELETE() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  const path = pathFor(session.userId);

  const { error: removeError } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
  if (removeError) {
    console.error("Avatar removal failed:", removeError);
    return NextResponse.json(
      { message: "An error occurred while removing your photo." },
      { status: 500 }
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update({ avatar_url: null })
    .eq("id", session.userId);

  if (updateError) {
    console.error("Avatar URL clear failed:", updateError);
    return NextResponse.json(
      { message: "An error occurred while removing your photo." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
