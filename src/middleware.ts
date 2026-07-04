import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * The marketing site under `(marketing)` is fully built but not ready to
 * launch. Until then, `/` redirects to the app shell so the dashboard is
 * the default landing experience. Flip this to `false` to restore the
 * marketing homepage at `/`.
 */
const DASHBOARD_IS_LANDING_PAGE = true;

export function middleware(request: NextRequest) {
  if (DASHBOARD_IS_LANDING_PAGE) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/",
};
