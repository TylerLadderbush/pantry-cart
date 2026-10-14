"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CurrentUser } from "@/lib/auth/dal";
import type { FavoriteRecipe } from "@/lib/favorites";
import ProfileSection from "@/app/account/profile-section";
import PasswordSection from "@/app/account/password-section";
import AvatarSection from "@/app/account/avatar-section";
import FavoritesSection from "@/app/account/favorites-section";

const TABS = [
  { id: "favorites", label: "Favorite Recipes" },
  { id: "profile", label: "Profile" },
  { id: "security", label: "Security" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AccountTabs({
  user,
  favorites,
}: {
  user: CurrentUser;
  favorites: FavoriteRecipe[];
}) {
  // Defaults to favorites rather than the first tab - that's the content
  // people land on this page to see most often.
  const [activeTab, setActiveTab] = useState<TabId>("favorites");
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-8 px-8 py-10 md:flex-row">
      <nav className="flex w-full flex-col gap-1 md:w-36 md:shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            aria-current={activeTab === tab.id}
            className={`-ml-3 rounded px-3 py-2 text-left text-sm font-medium ${
              activeTab === tab.id
                ? "bg-gray-100 text-gray-900"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {tab.label}
          </button>
        ))}

        <hr className="my-2" />

        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="-ml-3 rounded px-3 py-2 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          {loggingOut ? "Logging out..." : "Log Out"}
        </button>
      </nav>

      <div className="flex-1">
        {activeTab === "profile" && (
          <section>
            <h1 className="mb-4 ml-20 text-2xl font-bold">Profile</h1>
            <div className="ml-20 max-w-3xl divide-y rounded-lg border">
              <AvatarSection initialAvatarUrl={user.avatar_url} />
              <ProfileSection initialUser={user} />
            </div>
          </section>
        )}

        {activeTab === "security" && (
          <section>
            <h2 className="mb-4 ml-20 text-2xl font-bold">Security</h2>
            <PasswordSection />
          </section>
        )}

        {activeTab === "favorites" && (
          <section>
            <FavoritesSection initialFavorites={favorites} />
          </section>
        )}
      </div>
    </div>
  );
}
