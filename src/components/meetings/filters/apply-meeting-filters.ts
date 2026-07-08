import type { Meeting } from "@/components/meetings/types";
import type { MeetingFiltersState } from "@/components/meetings/filters/types";

/**
 * Client-side filtering — the backend's `GET /meetings` doesn't accept
 * status/date/source query params yet, so this filters the already-fetched
 * meeting list instead.
 */
export function applyMeetingFilters(
  meetings: Meeting[],
  filters: MeetingFiltersState,
): Meeting[] {
  const from = filters.dateFrom ? new Date(filters.dateFrom) : null;
  const to = filters.dateTo ? new Date(filters.dateTo) : null;
  if (to) to.setHours(23, 59, 59, 999);

  return meetings.filter((meeting) => {
    if (filters.statuses.length > 0 && !filters.statuses.includes(meeting.status)) {
      return false;
    }

    if (
      filters.sourceTypes.length > 0 &&
      (!meeting.sourceType || !filters.sourceTypes.includes(meeting.sourceType))
    ) {
      return false;
    }

    const createdAt = new Date(meeting.createdAt);
    if (from && createdAt < from) return false;
    if (to && createdAt > to) return false;

    return true;
  });
}
