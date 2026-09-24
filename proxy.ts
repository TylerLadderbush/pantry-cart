import { NextRequest, NextResponse } from "next/server";
import { hasOptimisticSession } from "@/lib/auth/optimistic-session";

// Add new routes here as they're built.
const protectedRoutes = ["/home", "/account"];
const publicRoutes = ["/login", "/signup", "/"];

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isProtectedRoute = protectedRoutes.includes(path);
  const isPublicRoute = publicRoutes.includes(path);

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
  matcher: ["/", "/login", "/signup", "/home", "/account"],
};
