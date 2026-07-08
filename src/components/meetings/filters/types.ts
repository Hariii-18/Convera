import type { MeetingStatus } from "@/components/meetings/types";
import type { MeetingSourceId } from "@/components/meetings/meeting-source";

export type MeetingFiltersState = {
  statuses: MeetingStatus[];
  sourceTypes: MeetingSourceId[];
  /** Inclusive, "yyyy-mm-dd" (native `<input type="date">` format) or null when unset. */
  dateFrom: string | null;
  dateTo: string | null;
};

export const defaultMeetingFilters: MeetingFiltersState = {
  statuses: [],
  sourceTypes: [],
  dateFrom: null,
  dateTo: null,
};

export function countActiveMeetingFilters(filters: MeetingFiltersState): number {
  return (
    filters.statuses.length +
    filters.sourceTypes.length +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0)
  );
}
