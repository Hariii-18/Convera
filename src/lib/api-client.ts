import axios from "axios";

import { clearAccessTokenCookie, getAccessTokenCookie } from "@/lib/cookies";
import { useAuthStore } from "@/store/auth-store";

export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

// Prevents a hung/unreachable backend from leaving a request pending
// forever (e.g. the live-meeting stop call leaving the UI stuck on
// "Stopping…" with no feedback). File uploads override this per-request
// since they can legitimately take longer on slow connections.
const DEFAULT_TIMEOUT_MS = 30_000;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: DEFAULT_TIMEOUT_MS,
});

apiClient.interceptors.request.use((config) => {
  const token = getAccessTokenCookie();
  if (token) {
    config.headers.set("Authorization", `Bearer ${token}`);
  }
  return config;
});

// `/auth/login` and `/auth/register` return 401/other errors for a rejected
// *attempt* (wrong password, etc.) — that says nothing about an existing
// session's token, so it must never be treated as "the session is invalid."
// Every other 401 comes from the backend's `get_current_user` dependency
// rejecting the bearer token itself (missing, expired, or otherwise
// invalid), which is the only case that should end the session.
const AUTH_ATTEMPT_PATHS = ["/auth/login", "/auth/register"];

function isAuthAttemptRequest(url?: string): boolean {
  return Boolean(url) && AUTH_ATTEMPT_PATHS.some((path) => url!.includes(path));
}

// Guards against redirecting more than once when several requests 401 back
// to back (e.g. a page that fires off several queries at once right as the
// token expires) — the first one already sends the browser to /login.
let isRedirectingToLogin = false;

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isSessionInvalidated =
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      !isAuthAttemptRequest(error.config?.url);

    if (isSessionInvalidated) {
      clearAccessTokenCookie();
      useAuthStore.getState().clearUser();

      if (typeof window !== "undefined" && !isRedirectingToLogin) {
        const onAuthPage = ["/login", "/register", "/forgot-password"].includes(
          window.location.pathname,
        );
        if (!onAuthPage) {
          isRedirectingToLogin = true;
          window.location.assign("/login");
        }
      }
    }

    return Promise.reject(error);
  },
);
