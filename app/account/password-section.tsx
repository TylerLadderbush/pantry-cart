"use client";

import { useState, type FormEvent } from "react";

type FieldErrors = {
  currentPassword?: string[];
  newPassword?: string[];
};

export default function PasswordSection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPasswords, setShowPasswords] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setSuccessMessage(null);
    setPending(true);

    const res = await fetch("/api/auth/password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    const body = await res.json().catch(() => null);
    setPending(false);

    if (!res.ok) {
      if (body?.errors) {
        setFieldErrors(body.errors);
      } else {
        setFormError(body?.message ?? "Something went wrong. Please try again.");
      }
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setSuccessMessage("Password changed.");
  }

  return (
    <div className="ml-20 max-w-3xl rounded-lg border p-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="currentPassword" className="text-sm text-gray-500">
            Current Password
          </label>
          <input
            id="currentPassword"
            name="currentPassword"
            type={showPasswords ? "text" : "password"}
            required
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className="rounded border px-3 py-2"
          />
          {fieldErrors.currentPassword?.map((message) => (
            <p key={message} className="text-sm text-red-600">
              {message}
            </p>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="newPassword" className="text-sm text-gray-500">
            New Password
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type={showPasswords ? "text" : "password"}
            required
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            className="rounded border px-3 py-2"
          />
          {fieldErrors.newPassword?.map((message) => (
            <p key={message} className="text-sm text-red-600">
              {message}
            </p>
          ))}
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-500">
          <input
            type="checkbox"
            checked={showPasswords}
            onChange={(event) => setShowPasswords(event.target.checked)}
          />
          Show passwords
        </label>

        {formError && <p className="text-sm text-red-600">{formError}</p>}
        {successMessage && <p className="text-sm text-green-700">{successMessage}</p>}

        <button
          type="submit"
          disabled={pending}
          className="self-start rounded bg-green-700 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Saving..." : "Change Password"}
        </button>
      </form>
    </div>
  );
}
