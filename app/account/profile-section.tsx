"use client";

import { useState } from "react";

type User = {
  id: string;
  username: string;
  display_name: string;
  email: string;
  created_at: string;
};

type EditableField = "display_name" | "email";

const FIELD_LABELS: Record<EditableField, string> = {
  display_name: "Display Name",
  email: "Email",
};

export default function ProfileSection({ initialUser }: { initialUser: User }) {
  const [values, setValues] = useState({
    display_name: initialUser.display_name,
    email: initialUser.email,
  });
  const [editingField, setEditingField] = useState<EditableField | null>(null);
  const [draft, setDraft] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<EditableField, string[]>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function startEditing(field: EditableField) {
    setEditingField(field);
    setDraft(values[field]);
    setFieldErrors({});
    setFormError(null);
  }

  function cancelEditing() {
    setEditingField(null);
    setFormError(null);
    setFieldErrors({});
  }

  async function saveField(field: EditableField) {
    setPending(true);
    setFormError(null);
    setFieldErrors({});

    const res = await fetch("/api/auth/me", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: draft }),
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

    setValues((current) => ({ ...current, [field]: body.user[field] }));
    setEditingField(null);
  }

  return (
    <div className="divide-y rounded-lg border">
      <div className="flex items-center justify-between gap-4 px-4 py-4">
        <div>
          <p className="text-sm text-gray-500">Username</p>
          <p className="font-medium">{initialUser.username}</p>
        </div>
        <span className="text-xs text-gray-400">Permanent</span>
      </div>

      {(["display_name", "email"] as EditableField[]).map((field) => (
        <div key={field} className="flex items-center justify-between gap-4 px-4 py-4">
          <div className="flex-1">
            <p className="text-sm text-gray-500">{FIELD_LABELS[field]}</p>

            {editingField === field ? (
              <div className="mt-1 flex flex-col gap-2">
                <input
                  type={field === "email" ? "email" : "text"}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  className="rounded border px-3 py-2"
                  autoFocus
                />
                {fieldErrors[field]?.map((message) => (
                  <p key={message} className="text-sm text-red-600">
                    {message}
                  </p>
                ))}
                {formError && <p className="text-sm text-red-600">{formError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => saveField(field)}
                    disabled={pending}
                    className="rounded bg-green-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    {pending ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEditing}
                    disabled={pending}
                    className="rounded border px-3 py-1.5 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="font-medium">{values[field]}</p>
            )}
          </div>

          {editingField !== field && (
            <button
              type="button"
              onClick={() => startEditing(field)}
              className="rounded border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Edit
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
