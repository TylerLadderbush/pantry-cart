import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/dal";
import { listFavorites } from "@/lib/favorites";
import AppHeader from "@/app/_components/app-header";
import AccountTabs from "@/app/account/account-tabs";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const favorites = await listFavorites(user.id);

  return (
    <main className="min-h-screen bg-stone-50 text-gray-900">
      <AppHeader />
      <AccountTabs user={user} favorites={favorites} />
    </main>
  );
}
