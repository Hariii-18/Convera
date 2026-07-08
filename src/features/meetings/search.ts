import type { Meeting } from "@/components/meetings/types";

/**
 * Simple client-side title match. There's no backend search endpoint yet, so
 * this filters whatever meeting list has already been fetched — no semantic
 * search, just a case-insensitive substring match.
 */
export function searchMeetings(meetings: Meeting[], query: string, limit?: number): Meeting[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const matches = meetings.filter((meeting) =>
    meeting.title.toLowerCase().includes(trimmed),
  );

  return limit ? matches.slice(0, limit) : matches;
}
