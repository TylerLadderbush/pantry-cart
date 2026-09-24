import { describe, expect, it } from "vitest";
import { LoginSchema, SignupSchema } from "../../lib/auth/definitions";

describe("SignupSchema", () => {
  const validPassword = "Sup3r$ecurePass!"; // 16 chars, uppercase + special

  it("accepts a well-formed signup", () => {
    const result = SignupSchema.safeParse({
      username: "valid_user-1",
      email: "user@example.com",
      password: validPassword,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a password shorter than 12 characters", () => {
    const result = SignupSchema.safeParse({
      username: "user1",
      email: "user@example.com",
      password: "Short1!",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a password at exactly the 12-character boundary", () => {
    const result = SignupSchema.safeParse({
      username: "user1",
      email: "user@example.com",
      password: "Abcdefghij1!", // exactly 12 chars, has uppercase + special
    });
    expect(result.success).toBe(true);
  });

  it("rejects a password with no uppercase letter", () => {
    const result = SignupSchema.safeParse({
      username: "user1",
      email: "user@example.com",
      password: "lowercase123!!!!",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a password with no special character", () => {
    const result = SignupSchema.safeParse({
      username: "user1",
      email: "user@example.com",
      password: "NoSpecialChar123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a username shorter than 3 characters", () => {
    const result = SignupSchema.safeParse({
      username: "ab",
      email: "user@example.com",
      password: validPassword,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a username longer than 32 characters", () => {
    const result = SignupSchema.safeParse({
      username: "a".repeat(33),
      email: "user@example.com",
      password: validPassword,
    });
    expect(result.success).toBe(false);
  });

  it("rejects usernames containing characters outside letters/numbers/underscore/hyphen", () => {
    const invalidUsernames = [
      "user name", // space
      "user@name", // @
      "<script>", // XSS-style payload
      "user;drop", // punctuation
      "user'name", // quote, SQL-injection-style payload
    ];

    for (const username of invalidUsernames) {
      const result = SignupSchema.safeParse({
        username,
        email: "user@example.com",
        password: validPassword,
      });
      expect(result.success, `expected "${username}" to be rejected`).toBe(false);
    }
  });

  it("rejects an invalid email format", () => {
    const result = SignupSchema.safeParse({
      username: "user1",
      email: "not-an-email",
      password: validPassword,
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    const result = SignupSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("strips fields that aren't part of the schema (no privilege-escalation surface)", () => {
    const result = SignupSchema.safeParse({
      username: "user1",
      email: "user@example.com",
      password: validPassword,
      role: "admin",
      password_hash: "already-hashed-value",
      id: "attacker-chosen-id",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty("role");
      expect(result.data).not.toHaveProperty("password_hash");
      expect(result.data).not.toHaveProperty("id");
    }
  });
});

describe("LoginSchema", () => {
  it("accepts a well-formed login", () => {
    const result = LoginSchema.safeParse({
      email: "user@example.com",
      password: "anything",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty password", () => {
    const result = LoginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects SQL-injection-style payloads in the email field (not a valid email shape)", () => {
    const result = LoginSchema.safeParse({
      email: "' OR '1'='1' --",
      password: "anything",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    const result = LoginSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
