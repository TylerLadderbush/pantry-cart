"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setPending(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.message ?? "Something went wrong. Please try again.");
      return;
    }

    router.push("/home");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-6 py-12 text-gray-900">
      <Link href="/" className="mb-8 text-3xl font-bold text-green-700">
        PantryCart
      </Link>

      <div className="w-full max-w-sm rounded-2xl border bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-bold text-green-700">Log In</h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded border px-3 py-2 pr-9 focus:outline-none focus:ring-2 focus:ring-green-700"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className={`absolute inset-y-0 right-2 flex items-center bg-transparent ${
                  showPassword ? "opacity-100" : "opacity-40"
                }`}
              >
                👁️
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-lg bg-green-700 px-4 py-2.5 font-semibold text-white transition hover:bg-green-800 disabled:opacity-50"
          >
            {pending ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-green-700 underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
