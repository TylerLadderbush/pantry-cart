-- Case-insensitive text type so "User@x.com" and "user@x.com" (or "Tyler"/"tyler")
-- are treated as the same value for uniqueness checks.
create extension if not exists citext;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  username citext not null unique,
  email citext not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- This table is written to only from server-side code using the service role
-- key (which bypasses RLS). Enabling RLS with no policies denies all access
-- from the anon/authenticated client keys, so password hashes can never be
-- fetched directly by a browser through the Supabase API.
alter table public.users enable row level security;
