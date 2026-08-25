"""Format-agnostic document model shared by every exporter.

`build_export_document` is the single place that decides *what* goes into an
export and in what order - each of `pdf_exporter`/`docx_exporter`/
`pptx_exporter` only decides *how* to render an `ExportDocument`. This is
what keeps `ExportService` from needing three duplicated data-building
pipelines: add or reorder a section here once, and every format picks it up.
"""

from dataclasses import dataclass
from typing import Any

from app.schemas.meeting_notes import MeetingNotesRead

_LONG_FORM_SECTIONS = {"Executive Summary", "Full Transcript"}

# Stable semantic identifiers, independent of `heading` text (which can carry
# a count suffix, e.g. "Action Items (3)"). PdfExporter/DocxExporter never
# read this - they keep rendering from `heading`/`lines`/`is_long_form`
# exactly as before - it exists purely so PptxExporter can pick a
# deterministic icon/layout per section without parsing `heading`.
SECTION_SUMMARY = "summary"
SECTION_DISCUSSION = "discussion"
SECTION_DECISIONS = "decisions"
SECTION_ACTIONS = "actions"
SECTION_RISKS = "risks"
SECTION_QUESTIONS = "questions"
SECTION_NEXT_STEPS = "next_steps"
SECTION_TIMELINE = "timeline"
SECTION_TRANSCRIPT = "transcript"


@dataclass
class ExportSection:
    heading: str
    # Pre-formatted lines. For most sections each line is one bullet point;
    # for `_LONG_FORM_SECTIONS` there is exactly one line of free-form prose
    # (paragraph breaks as "\n"), rendered as running text instead of a list.
    lines: list[str]
    kind: str = SECTION_DISCUSSION
    # Optional structured payload, populated only for sections whose bullets
    # come from multi-field records (discussion topics, action items) so a
    # richer renderer (PptxExporter) can lay out fields separately instead of
    # re-parsing the flattened `lines` strings. PdfExporter/DocxExporter never
    # read this field.
    items: list[dict[str, Any]] | None = None

    @property
    def is_long_form(self) -> bool:
        return self.heading in _LONG_FORM_SECTIONS


@dataclass
class ExportDocument:
    brand: str
    meeting_title: str
    date_time_ist: str
    duration_label: str | None
    participants_label: str | None
    sections: list[ExportSection]


def escape_xml(text: str) -> str:
    """Escapes the characters ReportLab's `Paragraph` markup treats as
    markup delimiters, so AI- or user-authored text containing `&`/`<`/`>`
    renders as literal text instead of being parsed as (invalid) tags.
    """
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def format_duration_label(seconds: int | None) -> str | None:
    if seconds is None:
        return None
    hours, remainder = divmod(int(seconds), 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours}h {minutes}m {secs}s"
    if minutes:
        return f"{minutes}m {secs}s"
    return f"{secs}s"


def format_segment_timestamp(seconds: float) -> str:
    total = int(seconds)
    hours, remainder = divmod(total, 3600)
    minutes, secs = divmod(remainder, 60)
    if hours:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def _action_item_line(item) -> str:
    meta = " · ".join(part for part in [item.owner, item.due_date, item.status] if part)
    return f"{item.text} ({meta})" if meta else item.text


def _speaker_prefix(speaker_name: str | None) -> str:
    return f"{speaker_name}: " if speaker_name else ""


def _full_transcript_text(notes: MeetingNotesRead) -> str:
    """Reconstructs the exported "Full Transcript" as speaker-labeled turns
    from `timestamped_discussion` (each segment's `speaker_key` already
    resolved to `speaker_name` — see `app.services.speaker_resolution`),
    grouping consecutive segments from the same speaker into one paragraph.
    Falls back to the verbatim `full_transcript` string — unchanged, exactly
    as `Transcript.transcript`/`normalized_transcript` was produced — when
    there's nothing to attribute: no segments, or none of them carry a
    resolved speaker (legacy transcript with no `speaker_key` at all). Never
    touches the stored transcript text itself either way.
    """
    segments = notes.timestamped_discussion
    if not segments or all(segment.speaker_name is None for segment in segments):
        return notes.full_transcript

    paragraphs: list[str] = []
    current_speaker: str | None = segments[0].speaker_name
    current_lines: list[str] = []
    for segment in segments:
        if segment.speaker_name != current_speaker and current_lines:
            paragraphs.append(f"{_speaker_prefix(current_speaker)}{' '.join(current_lines)}")
            current_lines = []
        current_speaker = segment.speaker_name
        text = segment.text.strip()
        if text:
            current_lines.append(text)
    if current_lines:
        paragraphs.append(f"{_speaker_prefix(current_speaker)}{' '.join(current_lines)}")
    return "\n\n".join(paragraphs)


def build_export_document(notes: MeetingNotesRead) -> ExportDocument:
    """Composes the shared export content from saved `MeetingNotes` — never
    from a fresh AI re-derivation, so every format reflects exactly what's
    currently saved (including edits). Sections with no data are omitted
    rather than rendered empty; nothing here invents content that isn't in
    `notes`.
    """
    sections: list[ExportSection] = []

    if notes.executive_summary:
        sections.append(
            ExportSection("Executive Summary", [notes.executive_summary], kind=SECTION_SUMMARY)
        )

    if notes.discussion_topics:
        sections.append(
            ExportSection(
                "Discussion Topics",
                [
                    f"{topic.title}: {topic.description}" if topic.description else topic.title
                    for topic in notes.discussion_topics
                ],
                kind=SECTION_DISCUSSION,
                items=[
                    {"title": topic.title, "description": topic.description}
                    for topic in notes.discussion_topics
                ],
            )
        )

    if notes.decisions:
        sections.append(
            ExportSection(
                "Decisions", [item.text for item in notes.decisions], kind=SECTION_DECISIONS
            )
        )

    if notes.action_items:
        sections.append(
            ExportSection(
                f"Action Items ({len(notes.action_items)})",
                [_action_item_line(item) for item in notes.action_items],
                kind=SECTION_ACTIONS,
                items=[
                    {
                        "text": item.text,
                        "owner": item.owner,
                        "due_date": item.due_date,
                        "status": item.status,
                    }
                    for item in notes.action_items
                ],
            )
        )

    if notes.risks:
        sections.append(
            ExportSection(
                "Risks / Blockers", [item.text for item in notes.risks], kind=SECTION_RISKS
            )
        )

    if notes.open_questions:
        sections.append(
            ExportSection(
                "Open Questions",
                [item.text for item in notes.open_questions],
                kind=SECTION_QUESTIONS,
            )
        )

    if notes.next_steps:
        sections.append(
            ExportSection(
                "Next Steps", [item.text for item in notes.next_steps], kind=SECTION_NEXT_STEPS
            )
        )

    if notes.timestamped_discussion:
        sections.append(
            ExportSection(
                "Detailed Discussion",
                [
                    f"[{format_segment_timestamp(segment.start)}] "
                    f"{_speaker_prefix(segment.speaker_name)}{segment.text}"
                    for segment in notes.timestamped_discussion
                ],
                kind=SECTION_TIMELINE,
                items=[
                    {
                        "timestamp": format_segment_timestamp(segment.start),
                        "text": f"{_speaker_prefix(segment.speaker_name)}{segment.text}",
                    }
                    for segment in notes.timestamped_discussion
                ],
            )
        )

    if notes.full_transcript:
        sections.append(
            ExportSection("Full Transcript", [_full_transcript_text(notes)], kind=SECTION_TRANSCRIPT)
        )

    participants_label = (
        f"{notes.participants_count} participant{'s' if notes.participants_count != 1 else ''}"
        if notes.participants_count is not None
        else None
    )

    return ExportDocument(
        brand="Converra",
        meeting_title=notes.title,
        date_time_ist=notes.date_time_ist,
        duration_label=format_duration_label(notes.duration_seconds),
        participants_label=participants_label,
        sections=sections,
    )
