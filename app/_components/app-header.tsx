import Link from "next/link";
import { DEFAULT_AVATAR_PATH } from "@/lib/avatar";
import { getCurrentUser } from "@/lib/auth/dal";

/**
 * The one and only top bar for authenticated pages (/home, /account, and
 * any future ones). Always renders identically - no per-page variants or
 * conditional content - so the header can never drift out of alignment
 * between pages the way separately copy-pasted headers did before. It
 * fetches its own data (rather than taking props) so every page that
 * renders it is guaranteed the same result, with nothing for a page to
 * forget to pass in.
 */
export default async function AppHeader() {
  const user = await getCurrentUser();
  const avatarUrl = user?.avatar_url ?? null;

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-8 py-5">
        <Link href="/home" className="text-4xl font-bold text-green-700">
          PantryCart
        </Link>

        <Link
          href="/account"
          aria-label="Account"
          className="h-12 w-12 shrink-0 overflow-hidden rounded-full border"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- small fixed-size avatar, not worth Next's image pipeline */}
          <img
            src={avatarUrl ?? DEFAULT_AVATAR_PATH}
            alt="Account"
            className="h-full w-full object-cover"
          />
        </Link>
      </div>
    </header>
  );
}
