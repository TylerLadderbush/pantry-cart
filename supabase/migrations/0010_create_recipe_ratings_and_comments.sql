-- One rating per user per recipe - a 1-5 star rating is a single current
-- opinion, not a history, so re-rating upserts the existing row rather than
-- creating a second one. Works for both Spoonacular and user-sourced
-- recipes identically, since both reference recipes.recipe_id.
create table public.recipe_ratings (
  user_id uuid not null references public.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(recipe_id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now(),
  primary key (user_id, recipe_id)
);

-- The composite primary key only efficiently serves lookups starting from
-- user_id - computing a recipe's average needs an index starting from
-- recipe_id instead.
create index recipe_ratings_recipe_id_idx on public.recipe_ratings (recipe_id);

-- Comments only ever come from our own users (never Spoonacular), and a
-- user can post more than one, so comment_id is a real surrogate key -
-- unlike favorites/ratings, (user_id, recipe_id) isn't unique here.
create table public.recipe_comments (
  comment_id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(recipe_id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index recipe_comments_recipe_id_idx on public.recipe_comments (recipe_id);
create index recipe_comments_user_id_idx on public.recipe_comments (user_id);

alter table public.recipe_ratings enable row level security;
alter table public.recipe_comments enable row level security;

-- Same model as every other table: only our server (service_role) can
-- touch these. No policies for anon/authenticated - all access goes
-- through our own Next.js routes, which enforce authorization in code.
grant select, insert, update, delete on public.recipe_ratings to service_role;
grant select, insert, update, delete on public.recipe_comments to service_role;
