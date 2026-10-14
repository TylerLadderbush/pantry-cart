// Loads .env.local into the vitest process the same way `next dev` loads it
// for the app itself. Without this, tests that need direct database access
// (e.g. verifying a caching side effect actually wrote a row, not just that
// the HTTP response looked right) would have no Supabase credentials
// available, since `npm test` and `npm run dev` are separate processes.
process.loadEnvFile(".env.local");
