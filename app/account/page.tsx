import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import AppHeader from "@/app/_components/app-header";
import AccountSidebar from "@/app/account/account-sidebar";
import ProfileSection from "@/app/account/profile-section";
import PasswordSection from "@/app/account/password-section";
import AvatarSection from "@/app/account/avatar-section";

const PLACEHOLDER_FAVORITE_COUNT = 6;

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-stone-50 text-gray-900">
      <AppHeader />

      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-8 py-10 md:flex-row">
        <AccountSidebar />

        <div className="flex flex-1 flex-col gap-12">
          <section id="profile" className="scroll-mt-24">
            <h1 className="mb-4 ml-20 text-2xl font-bold">Profile</h1>
            <div className="ml-20 max-w-3xl divide-y rounded-lg border">
              <AvatarSection initialAvatarUrl={user.avatar_url} />
              <ProfileSection initialUser={user} />
            </div>
          </section>

          <section id="security" className="scroll-mt-24">
            <h2 className="mb-4 ml-20 text-2xl font-bold">Security</h2>
            <PasswordSection />
          </section>

          <section id="favorites" className="scroll-mt-24">
            <h2 className="mb-4 text-2xl font-bold">Favorite Recipes</h2>
            <p className="mb-4 text-sm text-gray-500">
              Recipes aren&apos;t available yet - favorited recipes will show up here.
            </p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {Array.from({ length: PLACEHOLDER_FAVORITE_COUNT }).map((_, index) => (
                <div
                  key={index}
                  className="flex aspect-square items-center justify-center rounded-lg bg-gray-200 text-gray-500"
                >
                  Recipe
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
