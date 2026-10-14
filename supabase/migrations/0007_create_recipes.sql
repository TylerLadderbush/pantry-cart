-- A single recipes table serves two origins:
--   - Spoonacular-sourced (cached search/detail results): user_id is null,
--     spoonacular_id identifies the original Spoonacular recipe so repeat
--     fetches update the existing row instead of duplicating it.
--   - User-submitted: user_id is set, spoonacular_id stays null.
-- The check constraint keeps these two shapes from ever getting mixed up.
--
-- Most columns below mirror Spoonacular's /recipes/{id}/information response
-- field-for-field, captured now (even though most are unpopulated until the
-- future recipe detail page fetches them) so the schema doesn't need
-- revisiting later. extendedIngredients is the one exception - that's
-- represented by the separate ingredients/recipe_ingredients tables below,
-- not duplicated as a column here. analyzedInstructions is stored as jsonb
-- since its nested, variable shape (instruction sets -> steps -> optional
-- equipment/ingredients per step) doesn't fit a scalar or array column
-- without building several more normalized tables for data nothing uses yet.
create table public.recipes (
  recipe_id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  spoonacular_id bigint unique,
  source text not null check (source in ('spoonacular', 'user')),

  title text not null,
  image_url text,
  image_type text,
  summary text,
  instructions text,
  analyzed_instructions jsonb,

  servings integer,
  ready_in_minutes integer,
  preparation_minutes integer,
  cooking_minutes integer,

  cuisines text[],
  dish_types text[],
  diets text[],
  occasions text[],

  is_vegetarian boolean,
  is_vegan boolean,
  is_gluten_free boolean,
  is_dairy_free boolean,
  is_very_healthy boolean,
  is_cheap boolean,
  is_very_popular boolean,
  is_sustainable boolean,
  is_low_fodmap boolean,
  gaps text,

  calories integer,
  health_score integer,
  weight_watcher_smart_points integer,
  price_per_serving numeric,
  aggregate_likes integer,
  spoonacular_score numeric,

  source_url text,
  source_name text,
  credits_text text,
  license text,
  spoonacular_source_url text,
  language text,

  created_at timestamptz not null default now(),
  check (
    (source = 'user' and user_id is not null and spoonacular_id is null)
    or
    (source = 'spoonacular' and user_id is null and spoonacular_id is not null)
  )
);

-- Postgres never auto-indexes foreign key columns - without this, every
-- lookup/cascade involving user_id would be a full table scan.
create index recipes_user_id_idx on public.recipes (user_id);

create table public.ingredients (
  ingredient_id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  is_allergen boolean not null default false
);

-- Junction table: which ingredients (and how much of each) a recipe needs.
-- Shape matches Spoonacular's extendedIngredients entries: quantity/unit are
-- the structured amount, original_text is the raw ingredient line as
-- written (e.g. "2 cups flour, sifted"), and preparation mirrors their
-- "meta" array (e.g. ["diced", "chopped"]). Stays empty for now - populating
-- it is part of the future recipe detail page work, not today's
-- search/caching task.
create table public.recipe_ingredients (
  recipe_id uuid not null references public.recipes(recipe_id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(ingredient_id) on delete restrict,
  quantity numeric,
  unit text,
  original_text text,
  preparation text[],
  primary key (recipe_id, ingredient_id)
);

-- The composite primary key above already indexes (recipe_id, ingredient_id)
-- together, which covers "find ingredients for this recipe" efficiently
-- since recipe_id is the leading column. It does NOT help "find recipes
-- using this ingredient" (a real future use case - ingredient-based
-- search/shopping lists), which needs ingredient_id indexed on its own.
create index recipe_ingredients_ingredient_id_idx on public.recipe_ingredients (ingredient_id);

alter table public.recipes enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipe_ingredients enable row level security;

-- Same model as every other table: only our server (service_role) can
-- touch these. No policies for anon/authenticated - all access goes
-- through our own Next.js routes, which enforce authorization in code.
grant select, insert, update, delete on public.recipes to service_role;
grant select, insert, update, delete on public.ingredients to service_role;
grant select, insert, update, delete on public.recipe_ingredients to service_role;
