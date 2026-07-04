import { isAxiosError } from "axios";

/**
 * The API returns errors as `{ error: { message, details } }` (see the
 * backend's global exception handlers). Unwrap that shape for display,
 * falling back to a generic message for network failures etc.
 */
export function extractErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (isAxiosError(error)) {
    const message = (
      error.response?.data as { error?: { message?: string } } | undefined
    )?.error?.message;
    if (message) return message;
  }
  return fallback;
}
