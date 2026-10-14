// Pure display formatting, shared by every place that renders a 1-5 star
// rating (the recipe detail page and the home page's search result cards).
export function aggregateStars(average: number): string {
  const full = Math.round(average);
  return "★".repeat(full) + "☆".repeat(5 - full);
}
