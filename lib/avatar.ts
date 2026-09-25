export const MAX_AVATAR_UPLOAD_BYTES = 2 * 1024 * 1024; // 2MB
export const ALLOWED_AVATAR_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const AVATAR_OUTPUT_SIZE = 400; // pixels, square

// Shown whenever a user's avatar_url is null (never uploaded one, or
// removed it). The file at public/default-avatar.webp is resized to
// AVATAR_OUTPUT_SIZE and compressed the same way uploaded avatars are.
export const DEFAULT_AVATAR_PATH = "/default-avatar.webp";

export function formatMaxAvatarSize(): string {
  return `${MAX_AVATAR_UPLOAD_BYTES / (1024 * 1024)}MB`;
}
