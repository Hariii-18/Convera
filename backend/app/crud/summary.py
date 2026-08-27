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


def update_action_item(
    db: Session, summary: Summary, index: int, updates: dict
) -> Summary | None:
    """Applies a partial edit to one entry of `summary.action_items`, keyed
    by its position in the list — the same identity scheme the frontend
    already derives its `ActionItemData.id` from (`{summary.id}-action-item-
    {index}`, see `features/summaries/mappers.toSummary`), so no new id needs
    inventing. Returns `None` if `index` is out of range.

    Only `text`/`owner`/`due_date`/`status` are recognized (matching
    `SummaryActionItemUpdate`); a field absent from `updates` (i.e. not sent
    by the client — see `SummaryActionItemUpdate`'s `exclude_unset` contract)
    leaves that item's current value untouched. `text` is never cleared to
    blank/`null` since it's required content on `SummaryActionItemRead`
    (unlike `owner`/`due_date`/`status`, which are legitimately nullable).

    Reassigns `summary.action_items` to a new list (rather than mutating the
    existing one in place) so SQLAlchemy's change tracking on the plain
    `JSONB` column picks it up, matching `upsert_summary`/`set_timeline_events`.
    """
    items = list(summary.action_items)
    if index < 0 or index >= len(items):
        return None

    item = dict(items[index])
    for field in ("owner", "due_date", "status"):
        if field in updates:
            item[field] = updates[field]
    if "text" in updates:
        text = updates["text"]
        if isinstance(text, str) and text.strip():
            item["text"] = text

    items[index] = item
    summary.action_items = items
    db.commit()
    db.refresh(summary)
    return summary


def set_timeline_events(db: Session, summary: Summary, events: list[dict]) -> Summary:
    """Persists the generated timeline events onto a meeting's existing
    Summary row. Separate from `upsert_summary` since timeline generation
    runs as its own pipeline step against an already-created Summary (see
    `app.services.timeline_service`).
    """
    summary.timeline_events = events
    db.commit()
    db.refresh(summary)
    return summary
