"""Format-agnostic conversation document model — the Conversation export's
analogue of `app.services.export.content.ExportDocument`, shaped for
speaker dialogue instead of Meeting Notes sections.

`build_conversation_export_document` is the single place that decides what
goes into a Conversation export: it turns a meeting's already
speaker-resolved transcript segments (`app.services.speaker_resolution`)
into turns — consecutive segments from the same `speaker_key` merged into
one turn, mirroring `groupIntoTurns` in
`src/components/meetings/conversation/group-into-turns.ts` exactly, so the
export always matches what the Conversation tab shows. Each exporter
(`ConversationPdfExporter`/`ConversationDocxExporter`) only decides how to
render a `ConversationExportDocument`; neither this module nor either
exporter ever touches `Transcript.segments` itself.
"""

from dataclasses import dataclass, field

from app.schemas.transcript import TranscriptSegmentRead
from app.services.export.content import TRANSCRIPT_DISCLAIMER, format_duration_label

# Re-exported so existing importers of `DISCLAIMER` from this module keep
# working — the wording itself lives once, in `content.py`
# (`TRANSCRIPT_DISCLAIMER`), shared with Meeting Notes exports.
DISCLAIMER = TRANSCRIPT_DISCLAIMER


@dataclass
class ConversationTurn:
    # The `speaker_key` consecutive segments were merged on, `None` for a
    # turn built from unattributed (legacy) segments — never merged with
    # any other turn, attributed or not.
    speaker_key: str | None
    # `None` when the underlying segment(s) have no resolved speaker at
    # all (legacy transcript, no diarization) — renderers omit the "Name:"
    # line entirely rather than inventing one, same as
    # `resolve_speaker_name` never fabricating a label for a `None` key.
    speaker_label: str | None
    # One entry per underlying segment's exact `text`, in order — never
    # joined/rewritten into a single blob, so each segment's text reaches
    # the rendered document unchanged.
    texts: list[str] = field(default_factory=list)


@dataclass
class ConversationExportDocument:
    brand: str
    meeting_title: str
    date_time_ist: str
    duration_label: str | None
    participants_label: str | None
    turns: list[ConversationTurn]
    disclaimer: str


def _group_into_turns(segments: list[TranscriptSegmentRead]) -> list[ConversationTurn]:
    turns: list[ConversationTurn] = []
    for segment in segments:
        text = segment.text.strip()
        if not text:
            continue
        previous = turns[-1] if turns else None
        if (
            previous is not None
            and segment.speaker_key is not None
            and previous.speaker_key == segment.speaker_key
        ):
            previous.texts.append(text)
        else:
            turns.append(
                ConversationTurn(
                    speaker_key=segment.speaker_key,
                    speaker_label=segment.speaker_name,
                    texts=[text],
                )
            )
    return turns


def build_conversation_export_document(
    meeting_title: str,
    date_time_ist: str,
    duration_seconds: int | None,
    participants_count: int | None,
    segments: list[TranscriptSegmentRead],
) -> ConversationExportDocument:
    participants_label = (
        f"{participants_count} participant{'s' if participants_count != 1 else ''}"
        if participants_count is not None
        else None
    )

    return ConversationExportDocument(
        brand="Converra",
        meeting_title=meeting_title,
        date_time_ist=date_time_ist,
        duration_label=format_duration_label(duration_seconds),
        participants_label=participants_label,
        turns=_group_into_turns(segments),
        disclaimer=DISCLAIMER,
    )
