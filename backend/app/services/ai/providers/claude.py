"""Placeholder for a future Claude-backed `AIProvider`. Not implemented —
selecting `AI_PROVIDER=claude` raises in `factory.get_ai_provider` before
this class is ever constructed.
"""

from __future__ import annotations

from app.services.ai.base import (
    ActionItemsResult,
    AIProvider,
    StructuredSummaryResult,
    SummaryResult,
    TimelineResult,
    TranscriptChunk,
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

    def generate_timeline(self, chunks: list[TranscriptChunk]) -> TimelineResult:
        raise NotImplementedError

    def generate_structured_summary(
        self, text: str, *, language: str | None = None
    ) -> StructuredSummaryResult:
        raise NotImplementedError
