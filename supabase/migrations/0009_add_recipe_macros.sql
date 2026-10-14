-- Macro breakdown to show alongside calories. Like calories, these only
-- come from Spoonacular's /information endpoint with includeNutrition=true
-- (see lib/recipe-detail.ts) - null until a recipe's detail page has been
-- viewed at least once.
alter table public.recipes
  add column protein_grams numeric,
  add column fat_grams numeric,
  add column carbs_grams numeric;
