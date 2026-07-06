import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ACCESS_TOKEN_COOKIE } from "@/lib/cookies";

/**
 * The marketing site under `(marketing)` is the default landing experience
 * at `/`. Flip this to `true` to force `/` back into the app shell instead.
 */
const DASHBOARD_IS_LANDING_PAGE = false;

const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];
/**
 * Dashboard, Uploads, and the meeting workspace are reachable without an
 * account (Guest Mode) — they branch their own data source client-side
 * instead of being gated here. See `src/features/guest/`.
 */
const PROTECTED_PREFIXES = ["/live", "/downloads", "/search", "/settings"];

function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isAuthenticated = Boolean(
    request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
  );

  if (pathname === "/" && DASHBOARD_IS_LANDING_PAGE) {
    const destination = isAuthenticated ? "/dashboard" : "/login";
    return NextResponse.redirect(new URL(destination, request.url));
  }

  if (isProtectedPath(pathname) && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (AUTH_ROUTES.includes(pathname) && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/live/:path*",
    "/downloads/:path*",
    "/search/:path*",
    "/settings/:path*",
    "/login",
    "/register",
    "/forgot-password",
  ],
};
