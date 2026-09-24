-- Server-side session records, so logout (or a future "log out of all
-- devices" feature) can actually revoke a session immediately, rather than
-- only asking the browser to discard its copy of the cookie. The cookie
-- holds a signed JWT wrapping this row's id; every authenticated request
-- looks the id up here, so deleting the row invalidates any copy of the
-- token that was made before it was deleted.
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.sessions enable row level security;

grant select, insert, update, delete on public.sessions to service_role;
