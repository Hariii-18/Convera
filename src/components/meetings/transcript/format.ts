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
    .map((part) => ({ text: part, matched: part.toLowerCase() === term.toLowerCase() }));
}
