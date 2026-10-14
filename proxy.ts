import { NextRequest, NextResponse } from "next/server";
import { hasOptimisticSession } from "@/lib/auth/optimistic-session";

// Add new routes here as they're built. A route also protects its own
// nested paths (e.g. "/recipes" covers "/recipes/abc-123"), not just an
// exact match.
const protectedRoutes = ["/home", "/account", "/recipes"];
const publicRoutes = ["/login", "/signup", "/"];

function matchesRoute(path: string, routes: string[]) {
  return routes.some((route) => path === route || path.startsWith(`${route}/`));
}

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtectedRoute = matchesRoute(path, protectedRoutes);
  const isPublicRoute = matchesRoute(path, publicRoutes);

  const hasSession = await hasOptimisticSession(request.cookies.get("session")?.value);

  if (isProtectedRoute && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isPublicRoute && hasSession) {
    return NextResponse.redirect(new URL("/home", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/signup", "/home", "/account", "/recipes/:path*"],
};
