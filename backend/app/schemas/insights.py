import uuid

from pydantic import BaseModel


class InsightItemRead(BaseModel):
    """One derived insight: the grounding text plus a short, non-invented
    explanation of why it was surfaced (e.g. which Summary section it came
    from, or what heuristic flagged it). Never contains text the AI provider
    didn't already produce in the Summary — see
    `app.services.insights_service`.
    """

    text: str
    detail: str | None = None


class MeetingInsightsRead(BaseModel):
    meeting_id: uuid.UUID
    # False when the meeting has no Summary yet — every section below is
    # then `[]`, which the frontend renders as "generate a summary first"
    # rather than "no insights found".
    has_summary: bool
    unresolved_issues: list[InsightItemRead]
    decision_uncertainty: list[InsightItemRead]
    risk_signals: list[InsightItemRead]
    unanswered_questions: list[InsightItemRead]
    follow_up_gaps: list[InsightItemRead]
