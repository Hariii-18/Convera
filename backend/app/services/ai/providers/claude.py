"""Placeholder for a future Claude-backed `AIProvider`. Not implemented —
selecting `AI_PROVIDER=claude` raises in `factory.get_ai_provider` before
this class is ever constructed.
"""

from __future__ import annotations

from app.services.ai.base import (
    ActionItemsResult,
    AIProvider,
    NormalizationResult,
    StructuredSummaryResult,
    SummaryResult,
    TimelineResult,
    TranscriptChunk,
    TranscriptTranslationResult,
    TranslationResult,
)


class ClaudeProvider(AIProvider):
    def __init__(self) -> None:
        raise NotImplementedError("ClaudeProvider is not implemented yet.")

    def summarize(self, text: str, *, language: str | None = None) -> SummaryResult:
        raise NotImplementedError

    def translate(
        self,
        text: str,
        *,
        target_language: str,
        source_language: str | None = None,
    ) -> TranslationResult:
        raise NotImplementedError

    def extract_action_items(self, text: str) -> ActionItemsResult:
        raise NotImplementedError

    def generate_timeline(
        self, chunks: list[TranscriptChunk], *, language: str | None = None
    ) -> TimelineResult:
        raise NotImplementedError

    def generate_structured_summary(
        self, text: str, *, language: str | None = None
    ) -> StructuredSummaryResult:
        raise NotImplementedError

    def normalize_transcript(
        self, segments: list[TranscriptChunk], *, language: str | None = None
    ) -> NormalizationResult:
        raise NotImplementedError

    def translate_transcript(
        self,
        segments: list[TranscriptChunk],
        *,
        target_language: str,
        source_language: str | None = None,
    ) -> TranscriptTranslationResult:
        raise NotImplementedError
