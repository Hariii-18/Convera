"""Derives AI Insights for a meeting from its already-generated Summary —
no new AI call, no new provider, and no re-summarization of the transcript.

Every section here either passes through text the Summary Engine already
extracted from the transcript (`risks`, `open_questions` — see
`app.services.ai.providers.openai._STRUCTURED_SUMMARY_SYSTEM_PROMPT`, which
already forbids inventing facts) or applies a small, literal heuristic on
top of that same text (an uncertainty-keyword scan over `decisions`; a
missing-owner/due-date check over `action_items`). Nothing here calls an
`AIProvider`, so there is nothing to hallucinate beyond what Summary
generation already grounded in the transcript.
"""

import uuid

from sqlalchemy.orm import Session

from app.crud.summary import get_summary_by_meeting_id
from app.models.summary import Summary
from app.schemas.insights import InsightItemRead, MeetingInsightsRead

# Literal hedge/uncertainty phrases only — never a sentiment/NLU model, so a
# match always points back at a specific substring in the AI-extracted
# decision text a reader can verify themselves.
_UNCERTAINTY_MARKERS = (
    "tbd",
    "to be decided",
    "to be confirmed",
    "not finalized",
    "not finalised",
    "not confirmed",
    "not final",
    "pending confirmation",
    "may change",
    "might change",
    "tentative",
    "unclear",
    "unsure",
    "revisit",
    "still deciding",
    "haven't decided",
    "hadn't decided",
    "not sure yet",
    "up in the air",
    "subject to change",
    "provisional",
)


def _empty(meeting_id: uuid.UUID) -> MeetingInsightsRead:
    return MeetingInsightsRead(
        meeting_id=meeting_id,
        has_summary=False,
        unresolved_issues=[],
        decision_uncertainty=[],
        risk_signals=[],
        unanswered_questions=[],
        follow_up_gaps=[],
    )


def _find_uncertainty_marker(text: str) -> str | None:
    lowered = text.lower()
    for marker in _UNCERTAINTY_MARKERS:
        if marker in lowered:
            return marker
    return None


def _derive_decision_uncertainty(summary: Summary) -> list[InsightItemRead]:
    items: list[InsightItemRead] = []
    for decision in summary.decisions:
        text = str(decision.get("text", "")).strip()
        if not text:
            continue
        marker = _find_uncertainty_marker(text)
        if marker:
            items.append(
                InsightItemRead(
                    text=text,
                    detail=f'Recorded as a decision, but contains uncertain language ("{marker}")',
                )
            )
    return items


def _derive_follow_up_gaps(summary: Summary) -> list[InsightItemRead]:
    items: list[InsightItemRead] = []
    for action_item in summary.action_items:
        text = str(action_item.get("text", "")).strip()
        if not text:
            continue
        missing = []
        if not action_item.get("owner"):
            missing.append("no owner assigned")
        if not action_item.get("due_date"):
            missing.append("no due date")
        if missing:
            items.append(InsightItemRead(text=text, detail=", ".join(missing).capitalize()))
    return items


def get_meeting_insights(db: Session, meeting_id: uuid.UUID) -> MeetingInsightsRead:
    """Builds a `MeetingInsightsRead` purely from the meeting's Summary row.

    Returns `has_summary=False` with every section empty when no Summary
    exists yet (unprocessed meeting, or a meeting whose Summary generation
    hasn't run) — the same "honest empty state, not an error" contract as
    `GET /meetings/{id}/timeline`. Caller is responsible for the
    ownership/existence check on the meeting itself.
    """
    summary = get_summary_by_meeting_id(db, meeting_id)
    if summary is None:
        return _empty(meeting_id)

    unresolved_issues = [
        InsightItemRead(text=str(item.get("text", "")).strip(), detail="Open question")
        for item in summary.open_questions
        if str(item.get("text", "")).strip()
    ] + [
        InsightItemRead(text=str(item.get("text", "")).strip(), detail="Flagged risk")
        for item in summary.risks
        if str(item.get("text", "")).strip()
    ]

    risk_signals = [
        InsightItemRead(text=str(item.get("text", "")).strip())
        for item in summary.risks
        if str(item.get("text", "")).strip()
    ]

    unanswered_questions = [
        InsightItemRead(text=str(item.get("text", "")).strip())
        for item in summary.open_questions
        if str(item.get("text", "")).strip()
    ]

    return MeetingInsightsRead(
        meeting_id=meeting_id,
        has_summary=True,
        unresolved_issues=unresolved_issues,
        decision_uncertainty=_derive_decision_uncertainty(summary),
        risk_signals=risk_signals,
        unanswered_questions=unanswered_questions,
        follow_up_gaps=_derive_follow_up_gaps(summary),
    )
