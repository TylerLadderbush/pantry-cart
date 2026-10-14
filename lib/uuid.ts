// Shared by every route/function that takes a recipe_id, user_id, etc. in a
// URL param or request body - rejecting a malformed id here means it never
// reaches Postgres as an "invalid input syntax for type uuid" error.
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}
