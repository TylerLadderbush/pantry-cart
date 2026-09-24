"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "#profile", label: "Profile" },
  { href: "#favorites", label: "Favorite Recipes" },
];

export default function AccountSidebar() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <nav className="flex w-full flex-col gap-1 md:w-48 md:shrink-0">
      {NAV_ITEMS.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="rounded px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          {item.label}
        </a>
      ))}

      <hr className="my-2" />

      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="rounded px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        {loggingOut ? "Logging out..." : "Log Out"}
      </button>
    </nav>
  );
}
