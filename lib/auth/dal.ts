import "server-only";

import { cache } from "react";
import { verifySession } from "@/lib/auth/session";
import { supabaseAdmin } from "@/lib/supabase/admin";

export type CurrentUser = {
  id: string;
  username: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
  created_at: string;
};

// The single canonical way to fetch "who is currently logged in and what's
// their profile." Wrapped in cache() so that the page and the shared header
// it renders can each call this independently without doubling the number
// of database queries - see verifySession() for why this is safe.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await verifySession();
  if (!session) {
    return null;
  }

  const { data: user, error } = await supabaseAdmin
    .from("users")
    .select("id, username, display_name, email, avatar_url, created_at")
    .eq("id", session.userId)
    .maybeSingle();

  if (error || !user) {
    return null;
  }

  return user;
});
