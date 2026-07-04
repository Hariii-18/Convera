function toDate(value: string | Date) {
  return value instanceof Date ? value : new Date(value);
}

/** "1h 12m", "42m", "38s" */
export function formatDuration(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return "—";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${Math.max(0, Math.floor(seconds))}s`;
}

/** "Jul 3, 2026" */
export function formatDate(value: string | Date) {
  return toDate(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** "just now", "5m ago", "3h ago", "2d ago", falling back to formatDate beyond a week */
export function formatRelativeTime(value: string | Date) {
  const date = toDate(value);
  const diffSeconds = Math.round((Date.now() - date.getTime()) / 1000);

  if (diffSeconds < 60) return "just now";
  if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
  if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
  if (diffSeconds < 604800) return `${Math.floor(diffSeconds / 86400)}d ago`;
  return formatDate(date);
}

/** Full, unambiguous timestamp for tooltips/titles. */
export function formatDateTime(value: string | Date) {
  return toDate(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "1.2 MB", "845 KB", "0 B" */
export function formatBytes(bytes?: number) {
  if (bytes === undefined) return "—";
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"] as const;
  const exponent = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** exponent;

  return `${exponent === 0 ? value : value.toFixed(1)} ${units[exponent]}`;
}

/** "12:34", "1:02:34" */
export function formatTimestamp(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const mm = hours > 0 ? String(minutes).padStart(2, "0") : String(minutes);
  const ss = String(secs).padStart(2, "0");

  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function countWords(text: string) {
  const trimmed = text.trim();
  return trimmed.length === 0 ? 0 : trimmed.split(/\s+/).length;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type TextSegment = { text: string; matched: boolean };

/**
 * Splits `text` around case-insensitive occurrences of `term` for
 * highlighting. Pure text processing — rendering the `matched` segments is
 * left to the caller.
 */
export function splitHighlight(text: string, term?: string): TextSegment[] {
  if (!term || term.trim().length === 0) {
    return [{ text, matched: false }];
  }

  const pattern = new RegExp(`(${escapeRegExp(term)})`, "gi");
  return text
    .split(pattern)
    .filter((part) => part.length > 0)
    .map((part) => ({
      text: part,
      matched: part.toLowerCase() === term.toLowerCase(),
    }));
}
