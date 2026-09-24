import Link from "next/link";

/**
 * The one and only top bar for authenticated pages (/home, /account, and
 * any future ones). Always renders identically - no per-page variants or
 * conditional content - so the header can never drift out of alignment
 * between pages the way separately copy-pasted headers did before.
 */
export default function AppHeader() {
  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-8 py-5">
        <Link href="/home" className="text-4xl font-bold text-green-700">
          PantryCart
        </Link>

        <Link
          href="/account"
          className="rounded-lg bg-green-700 px-5 py-2.5 font-semibold text-white hover:bg-green-800"
        >
          Account
        </Link>
      </div>
    </header>
  );
}
