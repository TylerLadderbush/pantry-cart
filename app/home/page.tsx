import { redirect } from "next/navigation";
import { verifySession } from "@/lib/auth/session";
import AppHeader from "@/app/_components/app-header";

const PLACEHOLDER_RECIPE_COUNT = 12;

export default async function HomePage() {
  const session = await verifySession();
  if (!session) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-stone-50 text-gray-900">
      <AppHeader />

      <section className="mx-auto max-w-6xl px-8 py-10">
        <h1 className="mb-6 text-2xl font-bold">Home Page</h1>

        {/* Placeholder recipe cards - infinite scroll and real recipe data are not wired up yet */}
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: PLACEHOLDER_RECIPE_COUNT }).map((_, index) => (
            <div
              key={index}
              className="flex aspect-square items-center justify-center rounded-lg bg-gray-200 text-gray-500"
            >
              Recipe
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
