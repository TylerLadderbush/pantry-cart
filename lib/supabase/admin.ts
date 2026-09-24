import "server-only";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !secretKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY environment variables must be set.");
}

// Uses the secret key, which bypasses Row Level Security. This client must
// only ever be imported from server-side code (Route Handlers, Server
// Actions) and never exposed to the browser.
export const supabaseAdmin = createClient(supabaseUrl, secretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
