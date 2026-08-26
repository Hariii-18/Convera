import type {
  InsightItemResponse,
  MeetingInsightsResponse,
} from "@/features/insights/types";
import type {
  InsightItem,
  MeetingInsightsData,
} from "@/components/meetings/info-panel/types";

function toInsightItems(
  items: InsightItemResponse[],
  meetingId: string,
  section: string,
): InsightItem[] {
  return items.map((item, index) => ({
    id: `${meetingId}-${section}-${index}`,
    text: item.text,
    detail: item.detail ?? undefined,
  }));
}

export function toMeetingInsights(
  response: MeetingInsightsResponse,
): MeetingInsightsData {
  return {
    hasSummary: response.has_summary,
    unresolvedIssues: toInsightItems(
      response.unresolved_issues,
      response.meeting_id,
      "unresolved",
    ),
    decisionUncertainty: toInsightItems(
      response.decision_uncertainty,
      response.meeting_id,
      "decision-uncertainty",
    ),
    riskSignals: toInsightItems(
      response.risk_signals,
      response.meeting_id,
      "risk",
    ),
    unansweredQuestions: toInsightItems(
      response.unanswered_questions,
      response.meeting_id,
      "question",
    ),
    followUpGaps: toInsightItems(
      response.follow_up_gaps,
      response.meeting_id,
      "follow-up",
    ),
  };
}
