/**
 * API-shaped types (snake_case, matches the FastAPI response body) for the
 * AI Insights feature. See `@/features/insights/mappers` for the UI-shaped
 * types these get mapped into.
 */

export type InsightItemResponse = {
  text: string;
  detail: string | null;
};

export type MeetingInsightsResponse = {
  meeting_id: string;
  /** `false` when the meeting has no Summary yet — every section below is
   * then `[]`, which the UI renders as "generate a summary first" rather
   * than "nothing was found". */
  has_summary: boolean;
  unresolved_issues: InsightItemResponse[];
  decision_uncertainty: InsightItemResponse[];
  risk_signals: InsightItemResponse[];
  unanswered_questions: InsightItemResponse[];
  follow_up_gaps: InsightItemResponse[];
};
