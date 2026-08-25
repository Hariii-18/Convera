/**
 * API-shaped types (snake_case, matches the FastAPI response body) for the
 * summaries feature. See `@/features/summaries/mappers` for the UI-shaped
 * types these get mapped into.
 */

export type SummaryTopicResponse = {
  title: string;
  description: string | null;
};

export type SummaryTextItemResponse = {
  text: string;
};

/** Mirrors `app.schemas.summary.ActionItemStatus` — explicit allowed values
 * only, never inferred. */
export type SummaryActionItemStatusResponse =
  | "not-started"
  | "in-progress"
  | "completed"
  | "blocked";

export type SummaryActionItemResponse = {
  text: string;
  owner: string | null;
  due_date: string | null;
  status: SummaryActionItemStatusResponse | null;
};

/** Body for `PATCH /summaries/action-items/{index}`. Every field is
 * optional — only the ones supplied are changed (mirrors
 * `MeetingNotesActionItemInput`'s partial-update contract on the backend). */
export type SummaryActionItemUpdateRequest = {
  text?: string;
  owner?: string | null;
  due_date?: string | null;
  status?: SummaryActionItemStatusResponse | null;
};

export type SummaryResponse = {
  id: string;
  meeting_id: string;
  executive_summary: string;
  topics: SummaryTopicResponse[];
  decisions: SummaryTextItemResponse[];
  action_items: SummaryActionItemResponse[];
  risks: SummaryTextItemResponse[];
  open_questions: SummaryTextItemResponse[];
  next_steps: SummaryTextItemResponse[];
  created_at: string;
  updated_at: string;
};
