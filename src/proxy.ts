import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { ACCESS_TOKEN_COOKIE } from "@/lib/cookies";

/**
 * The marketing site under `(marketing)` is fully built but not ready to
 * launch. Until then, `/` redirects into the app shell so the dashboard is
 * the default landing experience. Flip this to `false` to restore the
 * marketing homepage at `/`.
 */
const DASHBOARD_IS_LANDING_PAGE = true;

const AUTH_ROUTES = ["/login", "/register", "/forgot-password"];
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/meetings",
  "/uploads",
  "/live",
  "/downloads",
  "/search",
  "/settings",
];

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
    "/dashboard/:path*",
    "/meetings/:path*",
    "/uploads/:path*",
    "/live/:path*",
    "/downloads/:path*",
    "/search/:path*",
    "/settings/:path*",
    "/login",
    "/register",
    "/forgot-password",
  ],
};
