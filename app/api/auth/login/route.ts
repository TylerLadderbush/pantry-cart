import { NextRequest, NextResponse } from "next/server";
import { LoginSchema } from "@/lib/auth/definitions";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

const INVALID_CREDENTIALS_MESSAGE = "Invalid email or password.";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const validatedFields = LoginSchema.safeParse(body);
  if (!validatedFields.success) {
    return NextResponse.json(
      { errors: validatedFields.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { email, password } = validatedFields.data;

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("id, username, display_name, email, password_hash, created_at")
    .eq("email", email)
    .maybeSingle();

  if (error || !user) {
    return NextResponse.json({ message: INVALID_CREDENTIALS_MESSAGE }, { status: 401 });
  }

  const passwordMatches = await verifyPassword(password, user.password_hash);
  if (!passwordMatches) {
    return NextResponse.json({ message: INVALID_CREDENTIALS_MESSAGE }, { status: 401 });
  }

  await createSession(user.id);

  return NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      display_name: user.display_name,
      email: user.email,
      created_at: user.created_at,
    },
  });
}
