"""Provider-agnostic contract for AI-backed features (summarization,
translation, action-item extraction, timeline generation).

Every provider (Ollama today; OpenAI/Gemini/Claude later) implements
`AIProvider` and is selected via `AI_PROVIDER` — see
`factory.get_ai_provider`. Nothing above this layer should depend on which
provider is configured.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class TranscriptChunk:
    start: float
    end: float
    text: str


@dataclass
class SummaryResult:
    summary: str


@dataclass
class TranslationResult:
    text: str
    target_language: str
    source_language: str | None = None


@dataclass
class ActionItem:
    text: str
    owner: str | None = None
    due_date: str | None = None


@dataclass
class ActionItemsResult:
    items: list[ActionItem] = field(default_factory=list)


@dataclass
class TimelineEvent:
    start: float
    label: str


@dataclass
class TimelineResult:
    events: list[TimelineEvent] = field(default_factory=list)


@dataclass
class SummaryTopic:
    title: str
    description: str | None = None


@dataclass
class SummaryTextItem:
    text: str


@dataclass
class NormalizedSegment:
    """One segment's cleaned-up text, keyed back to its position in the raw
    segment list so the caller can re-attach the original start/end
    timestamps without trusting the model to echo them back correctly.
    """

    index: int
    text: str


@dataclass
class NormalizationResult:
    segments: list[NormalizedSegment] = field(default_factory=list)


@dataclass
class TranslatedSegment:
    """One segment's translated text, keyed back to its position in the raw
    segment list so the caller can re-attach the original start/end
    timestamps without trusting the model to echo them back correctly.
    """

    index: int
    text: str


@dataclass
class TranscriptTranslationResult:
    segments: list[TranslatedSegment] = field(default_factory=list)


@dataclass
class StructuredSummaryResult:
    """The Local Summary Engine's output: an executive summary plus the six
    section lists rendered by the Summary Viewer (see
    `app/components/meetings/summary`).
    """

    executive_summary: str
    topics: list[SummaryTopic] = field(default_factory=list)
    decisions: list[SummaryTextItem] = field(default_factory=list)
    action_items: list[ActionItem] = field(default_factory=list)
    risks: list[SummaryTextItem] = field(default_factory=list)
    open_questions: list[SummaryTextItem] = field(default_factory=list)
    next_steps: list[SummaryTextItem] = field(default_factory=list)


class AIProvider(ABC):
    """A text-generation backend for AI features. Instances may hold network
    clients or heavyweight state in `__init__`, so callers should get one via
    `get_ai_provider()` (cached) rather than constructing providers directly.
    """

    @abstractmethod
    def summarize(self, text: str, *, language: str | None = None) -> SummaryResult:
        """Produces a concise summary of `text`."""
        raise NotImplementedError

    @abstractmethod
    def translate(
        self,
        text: str,
        *,
        target_language: str,
        source_language: str | None = None,
    ) -> TranslationResult:
        """Translates `text` into `target_language`."""
        raise NotImplementedError

    @abstractmethod
    def extract_action_items(self, text: str) -> ActionItemsResult:
        """Extracts action items (tasks, owners, due dates) from `text`."""
        raise NotImplementedError

    @abstractmethod
    def generate_timeline(self, chunks: list[TranscriptChunk]) -> TimelineResult:
        """Generates labeled timeline events from transcript chunks."""
        raise NotImplementedError

    @abstractmethod
    def generate_structured_summary(
        self, text: str, *, language: str | None = None
    ) -> StructuredSummaryResult:
        """Produces a sectioned summary (executive summary, discussion topics,
        decisions, action items, risks, open questions, next steps) of `text`.
        """
        raise NotImplementedError

    @abstractmethod
    def normalize_transcript(
        self, segments: list[TranscriptChunk], *, language: str | None = None
    ) -> NormalizationResult:
        """Cleans up punctuation, spacing, and obvious grammar issues in each
        segment's text for readability, applying conservative technical/proper
        -name corrections only when context is strong. Must never invent
        content or change meaning, and must preserve Hindi/Telugu/English and
        mixed-language speech as spoken. Segment order/count and timestamps
        are the caller's responsibility to preserve — this returns text only.
        """
        raise NotImplementedError

    @abstractmethod
    def translate_transcript(
        self,
        segments: list[TranscriptChunk],
        *,
        target_language: str,
        source_language: str | None = None,
    ) -> TranscriptTranslationResult:
        """Translates each segment's text into `target_language`. Must never
        invent content or change meaning. Segment order/count and timestamps
        are the caller's responsibility to preserve — this returns text only.
        """
        raise NotImplementedError
