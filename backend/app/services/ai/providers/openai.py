"""Cloud LLM inference via OpenAI's Chat Completions API. Used for Summary
generation (see `app.services.ai.factory.get_summary_ai_provider`) so
automatic summaries don't depend on a local Ollama server / model resources.

Only `generate_structured_summary` is implemented — normalization and
translation keep running through the Ollama provider (`ai_provider`
setting) and are out of scope for this provider. Calling any other method
raises `NotImplementedError`, same as before this provider had a real
`generate_structured_summary`.
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
    "transcript. Never label an action item's status as \"Not started\" "
    "unless the transcript explicitly says it has not started. Preserve "
    "uncertainty instead of presenting ambiguous information as fact. When "
    "dates or times conflict or are unclear, preserve that uncertainty in "
    "the text rather than selecting one as a definite deadline. Do not "
    "invent facts to fill in missing summary sections; use an empty array "
    "or null instead."
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
        self._timeout = settings.openai_request_timeout_seconds
        logger.info("Using OpenAI provider for summary generation (model=%s)", self._model)

    def _chat_completion_json(self, *, system_prompt: str, user_prompt: str) -> str:
        response = httpx.post(
            f"{self._base_url}/chat/completions",
            headers={"Authorization": f"Bearer {self._api_key}"},
            json={
                "model": self._model,
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
        raise NotImplementedError("OpenAIProvider only implements generate_structured_summary")

    def translate_transcript(
        self,
        segments: list[TranscriptChunk],
        *,
        target_language: str,
        source_language: str | None = None,
    ) -> TranscriptTranslationResult:
        raise NotImplementedError("OpenAIProvider only implements generate_structured_summary")
