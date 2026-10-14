-- A user's favorited recipes. Deliberately a plain join table (no surrogate
-- id) since the only two things that ever matter are "does this pair exist"
-- and "when was it favorited" - a composite primary key on (user_id,
-- recipe_id) both prevents a recipe being favorited twice by the same user
-- and, since it's the leading column, efficiently serves "all of this
-- user's favorites" (the profile page's main query).
create table public.favorites (
  user_id uuid not null references public.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(recipe_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

-- The composite primary key only efficiently serves lookups starting from
-- user_id. recipe_id has no index of its own otherwise - needed for a
-- performant cascade when a recipe row is deleted, and for any future
-- "how many users favorited this recipe" query.
create index favorites_recipe_id_idx on public.favorites (recipe_id);

alter table public.favorites enable row level security;

-- Same model as every other table: only our server (service_role) can
-- touch this. No policies for anon/authenticated - all access goes through
-- our own Next.js routes, which enforce authorization in code.
grant select, insert, update, delete on public.favorites to service_role;
