import { NextRequest, NextResponse } from "next/server";
import { SignupSchema } from "@/lib/auth/definitions";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const validatedFields = SignupSchema.safeParse(body);
  if (!validatedFields.success) {
    return NextResponse.json(
      { errors: validatedFields.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { username, email, password } = validatedFields.data;
  const passwordHash = await hashPassword(password);

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .insert({ username, display_name: username, email, password_hash: passwordHash })
    .select("id, username, display_name, email, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      const field = error.message.includes("users_username_key") ? "username" : "email";
      return NextResponse.json(
        { errors: { [field]: [`This ${field} is already taken.`] } },
        { status: 409 }
      );
    }

    console.error("Signup insert failed:", error);
    return NextResponse.json(
      { message: "An error occurred while creating your account." },
      { status: 500 }
    );
  }

  await createSession(user.id);

  return NextResponse.json({ user }, { status: 201 });
}
