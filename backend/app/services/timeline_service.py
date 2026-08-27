"""Generates and persists Timeline events for a meeting.

Reuses the existing `AIProvider.generate_timeline` (see
`app.services.ai.base`) — no second timeline prompt/model. Provider
selection reuses `get_summary_ai_provider()` (`SUMMARY_AI_PROVIDER`,
OpenAI by default) rather than `get_ai_provider()` (the `AI_PROVIDER` axis,
Ollama by default): Timeline generation previously ran on `get_ai_provider`,
whose default (Ollama, a local server) requires an Ollama instance that
isn't part of this deployment, so every Timeline generation silently failed
(caught below, leaving `timeline_events` empty forever) while Summary
generation succeeded on the same transcript via OpenAI. Both `OpenAIProvider`
and `OllamaProvider` implement `generate_timeline`, so this follows whichever
cloud/local provider Summary generation is already configured to use.
"""

import logging
import uuid

from sqlalchemy.orm import Session

from app.crud.summary import set_timeline_events
from app.crud.transcript import get_transcript_by_meeting_id
from app.models.summary import Summary
from app.services.ai import TranscriptChunk, get_summary_ai_provider

logger = logging.getLogger("converra")


def generate_timeline_for_meeting(db: Session, meeting_id: uuid.UUID, summary: Summary) -> Summary:
    """Builds transcript chunks from the meeting's transcript (normalized
    when available) and asks the configured `AIProvider` for timeline
    events, persisting the result on `summary.timeline_events`.

    Never raises: a missing transcript, an unimplemented/unreachable
    provider, or malformed AI output all leave `timeline_events` as `[]`
    (or whatever it already was) rather than failing the caller. Timeline
    generation is an enhancement over the Summary, not a prerequisite for
    it, so it must never block `run_post_transcription_pipeline` or Live
    Meeting finalization — the Timeline tab shows an honest empty state
    instead.
    """
    transcript = get_transcript_by_meeting_id(db, meeting_id)
    if transcript is None:
        return summary

    segments = transcript.normalized_segments or transcript.segments
    chunks = [
        TranscriptChunk(start=segment["start"], end=segment["end"], text=segment["text"])
        for segment in segments
        if segment.get("text", "").strip()
    ]
    if not chunks:
        return summary

    try:
        result = get_summary_ai_provider().generate_timeline(chunks)
    except Exception as exc:
        logger.warning(
            "Timeline generation failed for meeting %s, leaving timeline empty (retryable): %s",
            meeting_id,
            exc,
        )
        return summary

    events = [
        {"start": event.start, "label": event.label}
        for event in sorted(result.events, key=lambda e: e.start)
        if event.label.strip()
    ]
    return set_timeline_events(db, summary, events)
