"""Cloud LLM inference via OpenAI's Chat Completions API. Used for Summary
generation (see `app.services.ai.factory.get_summary_ai_provider`) and
Normalization (see `app.services.ai.factory.get_normalization_ai_provider`)
so neither depends on a local Ollama server / model resources.

`generate_structured_summary` and `normalize_transcript` are implemented.
Translation keeps running through the Ollama provider (`ai_provider`
setting) and is out of scope for this provider — calling `translate`,
`translate_transcript`, `summarize`, or `extract_action_items` raises
`NotImplementedError`.
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
    TimelineResult,
    TranscriptChunk,
    TranscriptTranslationResult,
    TranslationResult,
)

logger = logging.getLogger("converra")

_JSON_OBJECT_RE = re.compile(r"\{.*\}", re.DOTALL)

_NORMALIZATION_SYSTEM_PROMPT = (
    "You are cleaning up a raw speech-to-text transcript for readability. "
    "You will be given a JSON array of segments, each with an index \"i\" and "
    "raw \"text\". For each segment, fix punctuation, spacing, and obvious "
    "grammar or readability issues only. Apply a technical term or proper-name "
    "correction only when you are highly confident it is a mis-transcription "
    "(e.g. an obvious ASR error), not a rewording choice. Preserve Hindi, "
    "Telugu, English, and mixed-language speech exactly as spoken — do not "
    "translate or transliterate. Never add, remove, or reinterpret content, and "
    "never change meaning. If a segment needs no changes, return it unchanged. "
    "Keep the same number of segments, in the same order.\n\n"
    "Return only a single JSON object (no markdown, no explanation) with "
    'exactly one key "segments": an array of objects with keys "i" (the '
    'original index) and "text" (the cleaned text).'
)

_STRUCTURED_SUMMARY_SYSTEM_PROMPT = (
    "You summarize meeting transcripts. Return only a single JSON object (no "
    "markdown, no explanation) with exactly these keys:\n"
    '"executive_summary" (a concise paragraph string), '
    '"topics" (array of {"title", "description"}), '
    '"decisions" (array of {"text"}), '
    '"action_items" (array of {"text", "owner", "due_date"}, "owner" and '
    '"due_date" are strings or null), '
    '"risks" (array of {"text"}), '
    '"open_questions" (array of {"text"}), '
    '"next_steps" (array of {"text"}). '
    "Use an empty array for a section with nothing notable.\n"
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
    "\"Script\"."
)


class OpenAIProvider(AIProvider):
    def __init__(self) -> None:
        settings = get_settings()
        if not settings.openai_api_key:
            raise RuntimeError(
                "OPENAI_API_KEY is not configured — set it in the backend environment "
                "to use the OpenAI AI provider."
            )
        self._api_key = settings.openai_api_key
        self._base_url = settings.openai_base_url.rstrip("/")
        self._model = settings.openai_summary_model
        self._normalization_model = settings.openai_normalization_model
        self._timeout = settings.openai_request_timeout_seconds
        logger.info(
            "Using OpenAI provider (summary_model=%s, normalization_model=%s)",
            self._model,
            self._normalization_model,
        )

    def _chat_completion_json(self, *, system_prompt: str, user_prompt: str, model: str | None = None) -> str:
        response = httpx.post(
            f"{self._base_url}/chat/completions",
            headers={"Authorization": f"Bearer {self._api_key}"},
            json={
                "model": model or self._model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
                "response_format": {"type": "json_object"},
                "temperature": 0.3,
            },
            timeout=self._timeout,
        )
        if response.status_code >= 400:
            raise RuntimeError(
                f"OpenAI API request failed with status {response.status_code}: {response.text[:500]}"
            )
        data = response.json()
        try:
            return data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError) as exc:
            raise RuntimeError(f"OpenAI API returned an unexpected response shape: {data}") from exc

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

    def generate_structured_summary(
        self, text: str, *, language: str | None = None
    ) -> StructuredSummaryResult:
        language_hint = f" Write all text in {language}." if language else ""
        user_prompt = f"{language_hint}\n\nTranscript:\n{text}".strip()

        raw = self._chat_completion_json(
            system_prompt=_STRUCTURED_SUMMARY_SYSTEM_PROMPT, user_prompt=user_prompt
        )
        parsed = self._parse_json_object(raw)
        if parsed is None:
            logger.warning("OpenAI returned non-JSON structured summary response; returning empty sections")
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

    def summarize(self, text: str, *, language: str | None = None) -> SummaryResult:
        raise NotImplementedError("OpenAIProvider only implements generate_structured_summary")

    def translate(
        self,
        text: str,
        *,
        target_language: str,
        source_language: str | None = None,
    ) -> TranslationResult:
        raise NotImplementedError("OpenAIProvider only implements generate_structured_summary")

    def extract_action_items(self, text: str) -> ActionItemsResult:
        raise NotImplementedError("OpenAIProvider only implements generate_structured_summary")

    def generate_timeline(self, chunks: list[TranscriptChunk]) -> TimelineResult:
        raise NotImplementedError("OpenAIProvider only implements generate_structured_summary")

    def normalize_transcript(
        self, segments: list[TranscriptChunk], *, language: str | None = None
    ) -> NormalizationResult:
        if not segments:
            return NormalizationResult(segments=[])

        language_hint = f" The speech may be in {language}." if language else ""
        indexed = [{"i": i, "text": segment.text} for i, segment in enumerate(segments)]
        user_prompt = (
            f"{language_hint}\n\nSegments:\n{json.dumps(indexed, ensure_ascii=False)}".strip()
        )

        raw = self._chat_completion_json(
            system_prompt=_NORMALIZATION_SYSTEM_PROMPT,
            user_prompt=user_prompt,
            model=self._normalization_model,
        )
        parsed = self._parse_json_object(raw)
        segments_raw = parsed.get("segments") if parsed is not None else None
        if not isinstance(segments_raw, list):
            logger.warning("OpenAI returned non-JSON normalization response; leaving segments unchanged")
            return NormalizationResult(segments=[])

        cleaned: list[NormalizedSegment] = []
        for entry in segments_raw:
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
        raise NotImplementedError("OpenAIProvider only implements generate_structured_summary")
