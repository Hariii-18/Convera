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

export type SummaryActionItemResponse = {
  text: string;
  owner: string | null;
  due_date: string | null;
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
