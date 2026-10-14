// Filter option lists for the recipe search UI, matching Spoonacular's
// documented accepted values for these parameters. No "server-only" guard
// here since these are just option lists, safe to import from client
// components for rendering dropdowns/checkboxes.

// How many recipes to fetch per batch for infinite scroll - divides evenly
// into the grid at every breakpoint (2/3/4 columns) and keeps each
// scroll-triggered fetch small, which is the point: limit how much gets
// pulled from Spoonacular per request rather than over-fetching upfront.
export const RECIPE_BATCH_SIZE = 12;

export const CUISINES = [
  "African",
  "American",
  "British",
  "Cajun",
  "Caribbean",
  "Chinese",
  "Eastern European",
  "European",
  "French",
  "German",
  "Greek",
  "Indian",
  "Irish",
  "Italian",
  "Japanese",
  "Jewish",
  "Korean",
  "Latin American",
  "Mediterranean",
  "Mexican",
  "Middle Eastern",
  "Nordic",
  "Southern",
  "Spanish",
  "Thai",
  "Vietnamese",
];

export const DIETS = [
  "Gluten Free",
  "Ketogenic",
  "Vegetarian",
  "Lacto-Vegetarian",
  "Ovo-Vegetarian",
  "Vegan",
  "Pescetarian",
  "Paleo",
  "Primal",
  "Low FODMAP",
  "Whole30",
];

export const INTOLERANCES = [
  "Dairy",
  "Egg",
  "Gluten",
  "Grain",
  "Peanut",
  "Seafood",
  "Sesame",
  "Shellfish",
  "Soy",
  "Sulfite",
  "Tree Nut",
  "Wheat",
];
