import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !secretKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env.local for tests that verify database side effects directly."
  );
}

// A standalone client for tests only - intentionally not importing
// lib/supabase/admin.ts, since that file has a "server-only" guard that
// throws when imported outside Next's server-component resolution, which
// plain Node/vitest doesn't provide.
export const testSupabase = createClient(supabaseUrl, secretKey);
