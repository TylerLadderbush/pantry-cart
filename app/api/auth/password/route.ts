import { NextRequest, NextResponse } from "next/server";
import { ChangePasswordSchema } from "@/lib/auth/definitions";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { verifySession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function PATCH(request: NextRequest) {
  const session = await verifySession();
  if (!session) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  const validatedFields = ChangePasswordSchema.safeParse(body);
  if (!validatedFields.success) {
    return NextResponse.json(
      { errors: validatedFields.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { currentPassword, newPassword } = validatedFields.data;

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("password_hash")
    .eq("id", session.userId)
    .maybeSingle();

  if (error || !user) {
    return NextResponse.json({ message: "Not authenticated." }, { status: 401 });
  }

  const currentPasswordMatches = await verifyPassword(currentPassword, user.password_hash);
  if (!currentPasswordMatches) {
    return NextResponse.json(
      { errors: { currentPassword: ["Current password is incorrect."] } },
      { status: 400 }
    );
  }

  const newPasswordHash = await hashPassword(newPassword);

  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update({ password_hash: newPasswordHash })
    .eq("id", session.userId);

  if (updateError) {
    console.error("Password update failed:", updateError);
    return NextResponse.json(
      { message: "An error occurred while changing your password." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
