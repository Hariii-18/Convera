"""Local LLM inference via Ollama's REST API (http://localhost:11434 by
default). Runs entirely on-device — no external API calls — which is why
this is the default `AI_PROVIDER`.
"""

from __future__ import annotations

import json
import logging
import re

import httpx

from app.core.config import get_settings
from app.services.ai.base import (
    ActionItem,
    ActionItemsResult,
    AIProvider,
    NormalizationResult,
    NormalizedSegment,
    StructuredSummaryResult,
    SummaryResult,
    SummaryTextItem,
    SummaryTopic,
    TimelineEvent,
    TimelineResult,
    TranscriptChunk,
    TranscriptTranslationResult,
    TranslatedSegment,
    TranslationResult,
)

logger = logging.getLogger("converra")

_JSON_ARRAY_RE = re.compile(r"\[.*\]", re.DOTALL)
_JSON_OBJECT_RE = re.compile(r"\{.*\}", re.DOTALL)


class OllamaProvider(AIProvider):
    def __init__(self) -> None:
        settings = get_settings()
        self._base_url = settings.ollama_base_url.rstrip("/")
        self._model = settings.ollama_model
        self._timeout = settings.ollama_request_timeout_seconds
        logger.info("Using Ollama provider (model=%s, base_url=%s)", self._model, self._base_url)

    def _generate(self, prompt: str) -> str:
        response = httpx.post(
            f"{self._base_url}/api/generate",
            json={"model": self._model, "prompt": prompt, "stream": False},
            timeout=self._timeout,
        )
        response.raise_for_status()
        return response.json().get("response", "").strip()

    @staticmethod
    def _parse_json_array(raw: str) -> list[dict] | None:
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, list) else None
        except json.JSONDecodeError:
            match = _JSON_ARRAY_RE.search(raw)
            if not match:
                return None
            try:
                parsed = json.loads(match.group(0))
                return parsed if isinstance(parsed, list) else None
            except json.JSONDecodeError:
                return None

    @staticmethod
    def _parse_json_object(raw: str) -> dict | None:
        try:
            parsed = json.loads(raw)
            return parsed if isinstance(parsed, dict) else None
        except json.JSONDecodeError:
            match = _JSON_OBJECT_RE.search(raw)
            if not match:
                return None
            try:
                parsed = json.loads(match.group(0))
                return parsed if isinstance(parsed, dict) else None
            except json.JSONDecodeError:
                return None

    def summarize(self, text: str, *, language: str | None = None) -> SummaryResult:
        language_hint = f" Write the summary in {language}." if language else ""
        prompt = (
            "Summarize the following transcript concisely, capturing the key points "
            f"and decisions.{language_hint}\n\nTranscript:\n{text}\n\nSummary:"
        )
        return SummaryResult(summary=self._generate(prompt))

    def translate(
        self,
        text: str,
        *,
        target_language: str,
        source_language: str | None = None,
    ) -> TranslationResult:
        source_hint = f" from {source_language}" if source_language else ""
        prompt = (
            f"Translate the following text{source_hint} into {target_language}. "
            "Return only the translated text, with no explanation.\n\n"
            f"Text:\n{text}\n\nTranslation:"
        )
        return TranslationResult(
            text=self._generate(prompt),
            target_language=target_language,
            source_language=source_language,
        )

    def extract_action_items(self, text: str) -> ActionItemsResult:
        prompt = (
            "Extract action items from the following transcript. Return a JSON array "
            'of objects with keys "text", "owner" (or null), and "due_date" (or null). '
            "Return only the JSON array, no other text.\n\n"
            f"Transcript:\n{text}\n\nJSON:"
        )
        raw = self._generate(prompt)
        parsed = self._parse_json_array(raw)
        if parsed is None:
            logger.warning("Ollama returned non-JSON action items response; returning no items")
            return ActionItemsResult(items=[])

        items = [
            ActionItem(
                text=str(entry.get("text", "")).strip(),
                owner=entry.get("owner"),
                due_date=entry.get("due_date"),
            )
            for entry in parsed
            if isinstance(entry, dict) and str(entry.get("text", "")).strip()
        ]
        return ActionItemsResult(items=items)

    def generate_timeline(
        self, chunks: list[TranscriptChunk], *, language: str | None = None
    ) -> TimelineResult:
        language_hint = f" Write every label in {language}." if language else ""
        transcript_block = "\n".join(f"[{chunk.start:.1f}s] {chunk.text}" for chunk in chunks)
        prompt = (
            "The following is a timestamped transcript. Identify key topic changes or "
            'notable moments. Return a JSON array of objects with keys "start" (the '
            'timestamp in seconds, as a number) and "label" (a short description). '
            f"Return only the JSON array, no other text.{language_hint}\n\n"
            f"Transcript:\n{transcript_block}\n\nJSON:"
        )
        raw = self._generate(prompt)
        parsed = self._parse_json_array(raw)
        if parsed is None:
            logger.warning("Ollama returned non-JSON timeline response; returning no events")
            return TimelineResult(events=[])

        events = [
            TimelineEvent(start=float(entry["start"]), label=str(entry.get("label", "")).strip())
            for entry in parsed
            if isinstance(entry, dict) and "start" in entry and str(entry.get("label", "")).strip()
        ]
        return TimelineResult(events=events)

    def generate_structured_summary(
        self, text: str, *, language: str | None = None
    ) -> StructuredSummaryResult:
        language_hint = f" Write all text in {language}." if language else ""
        prompt = (
            "Summarize the following meeting transcript. Return only a single JSON "
            "object (no markdown, no explanation) with exactly these keys:\n"
            '"executive_summary" (a concise paragraph string), '
            '"topics" (array of {"title", "description"}), '
            '"decisions" (array of {"text"}), '
            '"action_items" (array of {"text", "owner", "due_date"}, "owner" and '
            '"due_date" are strings or null), '
            '"risks" (array of {"text"}), '
            '"open_questions" (array of {"text"}), '
            '"next_steps" (array of {"text"}). '
            f"Use an empty array for a section with nothing notable.{language_hint}\n\n"
            "Never infer task status, ownership, deadlines, decisions, attendees, or "
            "commitments unless explicitly stated or strongly supported by the "
            "transcript. Never label or describe an action item's status (e.g. "
            "\"Not started\", \"In progress\", \"Completed\") unless the transcript "
            "explicitly states that status; if status is not stated, omit it "
            "entirely rather than guessing. Only place an item under \"decisions\" "
            "when the transcript clearly shows agreement, confirmation, or a "
            "finalized decision was reached; a suggestion, proposal, or idea that "
            "was merely discussed — without confirmed agreement — belongs in "
            "\"topics\" or \"next_steps\" instead, not \"decisions\". Preserve "
            "uncertainty instead of presenting ambiguous information as fact. When "
            "dates or times conflict or are unclear, preserve that uncertainty in "
            "the text rather than selecting one as a definite deadline. Do not "
            "invent facts to fill in missing summary sections; use an empty array "
            "or null instead. Refer to the transcript cleanup process as "
            "\"Transcript Normalization\", never \"Script Normalization\" or "
            "\"Script\".\n\n"
            f"Transcript:\n{text}\n\nJSON:"
        )
        raw = self._generate(prompt)
        parsed = self._parse_json_object(raw)
        if parsed is None:
            logger.warning("Ollama returned non-JSON structured summary response; returning empty sections")
            return StructuredSummaryResult(executive_summary="")

        def _text_items(key: str) -> list[SummaryTextItem]:
            entries = parsed.get(key)
            if not isinstance(entries, list):
                return []
            return [
                SummaryTextItem(text=str(entry.get("text", "")).strip())
                for entry in entries
                if isinstance(entry, dict) and str(entry.get("text", "")).strip()
            ]

        topics_raw = parsed.get("topics")
        topics = (
            [
                SummaryTopic(
                    title=str(entry.get("title", "")).strip(),
                    description=(str(entry["description"]).strip() if entry.get("description") else None),
                )
                for entry in topics_raw
                if isinstance(entry, dict) and str(entry.get("title", "")).strip()
            ]
            if isinstance(topics_raw, list)
            else []
        )

        action_items_raw = parsed.get("action_items")
        action_items = (
            [
                ActionItem(
                    text=str(entry.get("text", "")).strip(),
                    owner=entry.get("owner"),
                    due_date=entry.get("due_date"),
                )
                for entry in action_items_raw
                if isinstance(entry, dict) and str(entry.get("text", "")).strip()
            ]
            if isinstance(action_items_raw, list)
            else []
        )

        return StructuredSummaryResult(
            executive_summary=str(parsed.get("executive_summary", "")).strip(),
            topics=topics,
            decisions=_text_items("decisions"),
            action_items=action_items,
            risks=_text_items("risks"),
            open_questions=_text_items("open_questions"),
            next_steps=_text_items("next_steps"),
        )

    def normalize_transcript(
        self, segments: list[TranscriptChunk], *, language: str | None = None
    ) -> NormalizationResult:
        if not segments:
            return NormalizationResult(segments=[])

        language_hint = f" The speech may be in {language}." if language else ""
        indexed = [{"i": i, "text": segment.text} for i, segment in enumerate(segments)]
        prompt = (
            "You are cleaning up a raw speech-to-text transcript for readability. "
            "You will be given a JSON array of segments, each with an index \"i\" and "
            "raw \"text\". For each segment, fix punctuation, spacing, and obvious "
            "grammar or readability issues only. Apply a technical term or proper-name "
            "correction only when you are highly confident it is a mis-transcription "
            "(e.g. an obvious ASR error), not a rewording choice. Preserve Hindi, "
            "Telugu, English, and mixed-language speech exactly as spoken — do not "
            "translate or transliterate. Never add, remove, or reinterpret content, and "
            "never change meaning. If a segment needs no changes, return it unchanged. "
            f"Keep the same number of segments, in the same order.{language_hint}\n\n"
            "Return only a JSON array of objects with keys \"i\" (the original index) "
            "and \"text\" (the cleaned text). No markdown, no explanation.\n\n"
            f"Segments:\n{json.dumps(indexed, ensure_ascii=False)}\n\nJSON:"
        )
        raw = self._generate(prompt)
        parsed = self._parse_json_array(raw)
        if parsed is None:
            logger.warning("Ollama returned non-JSON normalization response; leaving segments unchanged")
            return NormalizationResult(segments=[])

        cleaned: list[NormalizedSegment] = []
        for entry in parsed:
            if not isinstance(entry, dict):
                continue
            try:
                index = int(entry["i"])
            except (KeyError, TypeError, ValueError):
                continue
            text = str(entry.get("text", "")).strip()
            if not (0 <= index < len(segments)) or not text:
                continue
            cleaned.append(NormalizedSegment(index=index, text=text))

        return NormalizationResult(segments=cleaned)

    def translate_transcript(
        self,
        segments: list[TranscriptChunk],
        *,
        target_language: str,
        source_language: str | None = None,
    ) -> TranscriptTranslationResult:
        if not segments:
            return TranscriptTranslationResult(segments=[])

        source_hint = f" from {source_language}" if source_language else ""
        indexed = [{"i": i, "text": segment.text} for i, segment in enumerate(segments)]
        prompt = (
            f"You are translating a speech-to-text transcript{source_hint} into "
            f"{target_language}. You will be given a JSON array of segments, each with "
            "an index \"i\" and raw \"text\". Translate each segment's text into "
            f"{target_language}, preserving meaning and tone as closely as possible. "
            "Never add, remove, or reinterpret content. If a segment is already in "
            f"{target_language}, return it unchanged. Keep the same number of "
            "segments, in the same order.\n\n"
            "Return only a JSON array of objects with keys \"i\" (the original index) "
            "and \"text\" (the translated text). No markdown, no explanation.\n\n"
            f"Segments:\n{json.dumps(indexed, ensure_ascii=False)}\n\nJSON:"
        )
        raw = self._generate(prompt)
        parsed = self._parse_json_array(raw)
        if parsed is None:
            logger.warning("Ollama returned non-JSON translation response; leaving segments unchanged")
            return TranscriptTranslationResult(segments=[])

        translated: list[TranslatedSegment] = []
        for entry in parsed:
            if not isinstance(entry, dict):
                continue
            try:
                index = int(entry["i"])
            except (KeyError, TypeError, ValueError):
                continue
            text = str(entry.get("text", "")).strip()
            if not (0 <= index < len(segments)) or not text:
                continue
            translated.append(TranslatedSegment(index=index, text=text))

        return TranscriptTranslationResult(segments=translated)
