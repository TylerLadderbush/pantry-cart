import { NextRequest, NextResponse } from "next/server";
import { UpdateProfileSchema } from "@/lib/auth/definitions";
import { verifySession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET() {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("id, username, display_name, email, created_at")
    .eq("id", session.userId)
    .maybeSingle();

  if (error || !user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({ authenticated: true, user });
}

export async function PATCH(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  const validatedFields = UpdateProfileSchema.safeParse(body);
  if (!validatedFields.success) {
    const { fieldErrors, formErrors } = validatedFields.error.flatten();
    if (formErrors.length > 0) {
      return NextResponse.json({ message: formErrors[0] }, { status: 400 });
    }
    return NextResponse.json({ errors: fieldErrors }, { status: 400 });
  }

  // Only the fields actually provided are updated - username is never
  // included since it's immutable after signup.
  const updates: { email?: string; display_name?: string } = {};
  if (validatedFields.data.email !== undefined) {
    updates.email = validatedFields.data.email;
  }
  if (validatedFields.data.display_name !== undefined) {
    updates.display_name = validatedFields.data.display_name;
  }

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .update(updates)
    .eq("id", session.userId)
    .select("id, username, display_name, email, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { errors: { email: ["This email is already taken."] } },
        { status: 409 }
      );
    }

    console.error("Profile update failed:", error);
    return NextResponse.json(
      { message: "An error occurred while updating your profile." },
      { status: 500 }
    );
  }

  return NextResponse.json({ user });
}
