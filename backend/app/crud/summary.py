import uuid

from sqlalchemy.orm import Session

from app.models.summary import Summary


def get_summary_by_meeting_id(db: Session, meeting_id: uuid.UUID) -> Summary | None:
    return db.query(Summary).filter(Summary.meeting_id == meeting_id).first()


def upsert_summary(
    db: Session,
    *,
    meeting_id: uuid.UUID,
    executive_summary: str,
    topics: list[dict],
    decisions: list[dict],
    action_items: list[dict],
    risks: list[dict],
    open_questions: list[dict],
    next_steps: list[dict],
) -> Summary:
    """Creates or replaces the summary for a meeting.

    A meeting has at most one summary, so regenerating it (e.g. via the
    Summary Viewer's "Regenerate" action) overwrites the prior result rather
    than leaving a stale row behind.
    """
    existing = get_summary_by_meeting_id(db, meeting_id)
    if existing is not None:
        existing.executive_summary = executive_summary
        existing.topics = topics
        existing.decisions = decisions
        existing.action_items = action_items
        existing.risks = risks
        existing.open_questions = open_questions
        existing.next_steps = next_steps
        db.commit()
        db.refresh(existing)
        return existing

    record = Summary(
        meeting_id=meeting_id,
        executive_summary=executive_summary,
        topics=topics,
        decisions=decisions,
        action_items=action_items,
        risks=risks,
        open_questions=open_questions,
        next_steps=next_steps,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
