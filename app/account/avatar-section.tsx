"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import {
  ALLOWED_AVATAR_MIME_TYPES,
  DEFAULT_AVATAR_PATH,
  MAX_AVATAR_UPLOAD_BYTES,
  formatMaxAvatarSize,
} from "@/lib/avatar";

export default function AvatarSection({ initialAvatarUrl }: { initialAvatarUrl: string | null }) {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    if (!ALLOWED_AVATAR_MIME_TYPES.includes(file.type)) {
      setError("Please choose a PNG, JPEG, or WebP image.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_AVATAR_UPLOAD_BYTES) {
      setError(`Image must be smaller than ${formatMaxAvatarSize()}.`);
      event.target.value = "";
      return;
    }

    setPending(true);
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/account/avatar", { method: "POST", body: formData });
    const body = await res.json().catch(() => null);
    setPending(false);
    event.target.value = "";

    if (!res.ok) {
      setError(body?.message ?? "Something went wrong. Please try again.");
      return;
    }

    setAvatarUrl(body.avatar_url);
    router.refresh();
  }

  async function handleDelete() {
    setPending(true);
    setError(null);

    const res = await fetch("/api/account/avatar", { method: "DELETE" });
    const body = await res.json().catch(() => null);
    setPending(false);

    if (!res.ok) {
      setError(body?.message ?? "Something went wrong. Please try again.");
      return;
    }

    setAvatarUrl(null);
    router.refresh();
  }

  return (
    <div className="px-4 py-4">
      <div className="flex items-center gap-4">
        <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element -- small fixed-size avatar, not worth Next's image pipeline */}
          <img
            src={avatarUrl ?? DEFAULT_AVATAR_PATH}
            alt="Profile picture"
            className="h-full w-full object-cover"
          />
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={pending}
          className="text-base font-bold text-green-700 hover:underline disabled:opacity-50"
        >
          {pending ? "Working..." : "Update Profile Picture"}
        </button>

        {avatarUrl && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={pending}
            className="text-base font-bold text-red-600 hover:underline disabled:opacity-50"
          >
            Delete
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_AVATAR_MIME_TYPES.join(",")}
        onChange={handleFileChange}
        className="hidden"
      />

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
