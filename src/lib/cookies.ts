/**
 * The access token lives in a plain (non-httpOnly) cookie rather than only
 * localStorage so `proxy.ts` can read it at the edge for route protection.
 * Real authorization is still enforced by the backend verifying the JWT on
 * every request — this cookie only gates client-side navigation.
 */
export const ACCESS_TOKEN_COOKIE = "converra_access_token";

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name}=([^;]*)`),
  );
  const value = match?.[1];
  return value !== undefined ? decodeURIComponent(value) : undefined;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number) {
  if (typeof document === "undefined") return;
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax${secure}`;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getAccessTokenCookie(): string | undefined {
  return readCookie(ACCESS_TOKEN_COOKIE);
}

export function setAccessTokenCookie(token: string, maxAgeSeconds: number) {
  writeCookie(ACCESS_TOKEN_COOKIE, token, maxAgeSeconds);
}

export function clearAccessTokenCookie() {
  deleteCookie(ACCESS_TOKEN_COOKIE);
}
