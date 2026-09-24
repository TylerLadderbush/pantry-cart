import * as z from "zod";

const usernameSchema = z
  .string()
  .trim()
  .min(3, { error: "Username must be at least 3 characters long." })
  .max(32, { error: "Username must be at most 32 characters long." })
  .regex(/^[a-zA-Z0-9_-]+$/, {
    error: "Username can only contain letters, numbers, underscores, and hyphens.",
  });

const emailSchema = z.email({ error: "Please enter a valid email." }).trim();

const displayNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Display name cannot be empty." })
  .max(50, { error: "Display name must be at most 50 characters long." });

export const SignupSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: z
    .string()
    .min(12, { error: "Password must be at least 12 characters long." })
    .regex(/[A-Z]/, { error: "Password must contain at least one uppercase letter." })
    .regex(/[^a-zA-Z0-9]/, { error: "Password must contain at least one special character." }),
});

export const LoginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, { error: "Password is required." }),
});

// username is intentionally excluded: it's the permanent handle set at
// signup and is never editable afterward (see 0004_add_display_name.sql).
// Both fields are optional so a client can update just one, but at least
// one must be present.
export const UpdateProfileSchema = z
  .object({
    email: emailSchema.optional(),
    display_name: displayNameSchema.optional(),
  })
  .refine((data) => data.email !== undefined || data.display_name !== undefined, {
    error: "At least one of email or display_name must be provided.",
  });

export type SessionPayload = {
  sessionId: string;
  expiresAt: number;
};
