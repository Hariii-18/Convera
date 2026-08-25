/**
 * API-shaped types (snake_case, matches the FastAPI response body) for the
 * timeline feature. See `@/features/timeline/mappers` for the UI-shaped
 * types these get mapped into.
 */

export type TimelineEventResponse = {
  start: number;
  title: string;
  description: string | null;
};

export type TimelineResponse = {
  meeting_id: string;
  events: TimelineEventResponse[];
};
