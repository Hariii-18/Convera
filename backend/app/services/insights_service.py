"""Derives AI Insights for a meeting from its already-generated Summary —
no new AI call, no new provider, and no re-summarization of the transcript.

Every section here either applies a small, literal heuristic to text the
Summary Engine already extracted from the transcript (an uncertainty-keyword
scan over `decisions`; a missing-owner/overdue-due-date check over
`action_items`) or cross-references two Summary sections against each other
by literal keyword overlap (`_related_text`) — e.g. "does this risk have a
matching action item or next step", "does this open question overlap an
already-recorded decision". Cross-referencing only ever reports which
already-extracted text overlaps which other already-extracted text; it never
asserts a fact the transcript didn't already produce, and a risk/question
with no match is reported as exactly that (no related item found), not
silently dropped. Nothing here calls an `AIProvider`, so there is nothing to
hallucinate beyond what Summary generation already grounded in the
transcript.
"""

import re
import uuid
from datetime import datetime

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
    "pending approval",
    "may change",
    "might change",
    "could change",
    "tentative",
    "tentatively",
    "unclear",
    "unsure",
    "uncertain",
    "revisit",
    "circle back",
    "follow up on this",
    "still deciding",
    "still discussing",
    "haven't decided",
    "hadn't decided",
    "not sure yet",
    "not 100%",
    "up in the air",
    "subject to change",
    "provisional",
    "if possible",
    "depends on",
    "waiting to hear",
    "waiting on confirmation",
    "assuming",
    "probably",
    "likely",
    "in theory",
)

# Ignored when comparing two Summary text items for a shared subject —
# common enough in ordinary English that overlap on these alone would be a
# false positive, not a genuine topical match.
_STOPWORDS = frozenset(
    """
    the a an and or but for with from this that these those will would should
    could have has had been being are were was not yet also into onto over
    under about after before during which what when where who whom whose how
    why then than there their they them its our your you our we us to of in
    on at by as is be do does did can just need needs going get gets got
    """.split()
)

_WORD_PATTERN = re.compile(r"[a-zA-Z']{3,}")

_DUE_DATE_FORMATS = ("%Y-%m-%d",)


def _significant_words(text: str) -> set[str]:
    """Lowercased words of at least 3 letters, minus `_STOPWORDS` — the unit
    `_related_text` compares two pieces of Summary text on.
    """
    return {word for word in _WORD_PATTERN.findall(text.lower()) if word not in _STOPWORDS}


def _related_text(target: str, candidates: list[str]) -> str | None:
    """Finds the `candidates` entry with the most significant-word overlap
    with `target`, requiring at least 2 shared words (1 when `target` itself
    has 2 or fewer) so a single common word doesn't count as a match.
    Returns `None` when nothing clears that bar — an honest "no related item
    found" rather than a guessed match.
    """
    target_words = _significant_words(target)
    if not target_words:
        return None

    threshold = 1 if len(target_words) <= 2 else 2
    best_candidate: str | None = None
    best_overlap = 0
    for candidate in candidates:
        overlap = len(target_words & _significant_words(candidate))
        if overlap >= threshold and overlap > best_overlap:
            best_candidate = candidate
            best_overlap = overlap
    return best_candidate


def _parse_due_date(value: str) -> datetime | None:
    """Parses only unambiguous machine-written dates (`YYYY-MM-DD`, the
    format `SummaryActionItemRead.due_date` is documented to hold when it's
    structured at all) — never guesses at free text a user or the AI typed,
    so an unparseable value is silently skipped rather than misread.
    """
    value = value.strip()
    for date_format in _DUE_DATE_FORMATS:
        try:
            return datetime.strptime(value, date_format)
        except ValueError:
            continue
    return None


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
    today = datetime.utcnow()
    for action_item in summary.action_items:
        text = str(action_item.get("text", "")).strip()
        if not text:
            continue

        gaps: list[str] = []
        if not action_item.get("owner"):
            gaps.append("no owner assigned")

        due_date_raw = action_item.get("due_date")
        if not due_date_raw:
            gaps.append("no due date")
        elif action_item.get("status") != "completed":
            parsed_due_date = _parse_due_date(str(due_date_raw))
            if parsed_due_date is not None and parsed_due_date < today:
                gaps.append(f"overdue since {parsed_due_date.date().isoformat()}")

        if gaps:
            items.append(InsightItemRead(text=text, detail=", ".join(gaps).capitalize()))
    return items


def _derive_risk_signals(summary: Summary) -> list[InsightItemRead]:
    """Every `risks` entry, cross-referenced against `action_items` and
    `next_steps` for a matching follow-up (`_related_text`) so a reader can
    immediately tell which risks already have a plan attached and which
    don't — rather than a flat list identical to the Summary tab's own Risks
    section.
    """
    follow_up_candidates = [
        str(item.get("text", "")).strip()
        for item in (*summary.action_items, *summary.next_steps)
        if str(item.get("text", "")).strip()
    ]

    items: list[InsightItemRead] = []
    for risk in summary.risks:
        text = str(risk.get("text", "")).strip()
        if not text:
            continue
        related = _related_text(text, follow_up_candidates)
        detail = (
            f'Related follow-up: "{related}"'
            if related
            else "No related action item or next step found — may be unmitigated"
        )
        items.append(InsightItemRead(text=text, detail=detail))
    return items


def _derive_unanswered_questions(summary: Summary) -> list[InsightItemRead]:
    """Every `open_questions` entry, cross-referenced against `decisions`
    for a matching resolution (`_related_text`) so a reader can immediately
    tell which questions may already have been settled elsewhere in the
    Summary and which are still genuinely open — rather than a flat list
    identical to the Summary tab's own Open Questions section.
    """
    decision_candidates = [
        str(decision.get("text", "")).strip()
        for decision in summary.decisions
        if str(decision.get("text", "")).strip()
    ]

    items: list[InsightItemRead] = []
    for question in summary.open_questions:
        text = str(question.get("text", "")).strip()
        if not text:
            continue
        related = _related_text(text, decision_candidates)
        detail = (
            f'May be addressed by decision: "{related}"'
            if related
            else "No related decision found — still open"
        )
        items.append(InsightItemRead(text=text, detail=detail))
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

    # `unresolved_issues` stays a simple type-tagged concatenation (not the
    # cross-referenced versions below) — it exists only for a caller that
    # wants a single "how much is outstanding" count (see
    # `AIInsightsCard`'s comment on why it isn't rendered as its own
    # section), so it isn't worth computing twice.
    unresolved_issues = [
        InsightItemRead(text=str(item.get("text", "")).strip(), detail="Open question")
        for item in summary.open_questions
        if str(item.get("text", "")).strip()
    ] + [
        InsightItemRead(text=str(item.get("text", "")).strip(), detail="Flagged risk")
        for item in summary.risks
        if str(item.get("text", "")).strip()
    ]

    return MeetingInsightsRead(
        meeting_id=meeting_id,
        has_summary=True,
        unresolved_issues=unresolved_issues,
        decision_uncertainty=_derive_decision_uncertainty(summary),
        risk_signals=_derive_risk_signals(summary),
        unanswered_questions=_derive_unanswered_questions(summary),
        follow_up_gaps=_derive_follow_up_gaps(summary),
    )
