"""Regression check for the AI-output-language fix (Summary/Meeting Notes
coming back in Hindi when the transcript's *detected spoken language* was
Hindi or Hindi-majority-mixed).

Root cause: `summary_service.run_summary_ai` used to pass
`language=transcript.language` (Whisper's detected speech language) into
`AIProvider.generate_structured_summary`, whose `language` kwarg is an
instruction for what language to *write the summary in* — so a Hindi
transcript produced a Hindi summary. The fix makes it pass
`settings.ai_output_language` (default "English") instead, and does the same
for `AIProvider.generate_timeline`.

This monkeypatches the AI provider with a fake that records the `language`
kwarg it was called with and echoes back the source text unmodified,
exactly like `scripts/verify_summary_consistency.py`'s `_FakeSummaryProvider`
does — so this runs with no network/API-key dependency, and no DB either
(the functions under test take a `Transcript` object directly).

Checks:
  1. English transcript (transcript.language="en")   -> AI called with
     language="English", source text passed through unchanged.
  2. Hindi transcript (transcript.language="hi")      -> same: language=
     "English" (not "hi"), source text unchanged (transcript NOT translated).
  3. Mixed transcript (transcript.language="hi", text mixes Hindi+English)
     -> same.
  4. Timeline generation (`generate_timeline`) gets the same
     language="English" regardless of transcript language.
  5. `AI_OUTPUT_LANGUAGE` env override is honored (settings cache cleared).

Usage: python -m scripts.verify_ai_output_language
"""

from __future__ import annotations

import sys
import uuid
from dataclasses import dataclass, field
from unittest import mock

sys.path.insert(0, ".")

from app.models.transcript import Transcript
from app.services.ai.base import (
    StructuredSummaryResult,
    TimelineEvent,
    TimelineResult,
    TranscriptChunk,
)


@dataclass
class _Call:
    method: str
    language: str | None
    text: str | None = None


_calls: list[_Call] = []


class _RecordingProvider:
    def generate_structured_summary(self, text: str, *, language: str | None = None):
        _calls.append(_Call("generate_structured_summary", language, text))
        return StructuredSummaryResult(executive_summary=f"SUMMARY OF: {text}")

    def generate_timeline(self, chunks: list[TranscriptChunk], *, language: str | None = None):
        _calls.append(_Call("generate_timeline", language))
        return TimelineResult(events=[TimelineEvent(start=0.0, label="Opening")])


def _make_transcript(*, language: str, text: str) -> Transcript:
    return Transcript(
        id=uuid.uuid4(),
        meeting_id=uuid.uuid4(),
        upload_id=uuid.uuid4(),
        language=language,
        transcript=text,
        segments=[{"start": 0.0, "end": 1.0, "text": text}],
        word_count=len(text.split()),
    )


ENGLISH_TEXT = "Let's review the Q3 roadmap and assign owners for each workstream."
HINDI_TEXT = "आज हम Q3 रोडमैप की समीक्षा करेंगे और हर काम के लिए owner तय करेंगे।"
MIXED_TEXT = (
    "Let's review the Q3 roadmap. आज हम इस पर discuss करेंगे and assign owners "
    "for हर workstream, ठीक है?"
)


def _reset_settings_cache() -> None:
    from app.core.config import get_settings

    get_settings.cache_clear()


def main() -> int:
    failures: list[str] = []

    with mock.patch(
        "app.services.summary_service.get_summary_ai_provider", return_value=_RecordingProvider()
    ), mock.patch(
        "app.services.timeline_service.get_summary_ai_provider", return_value=_RecordingProvider()
    ):
        from app.services.summary_service import run_summary_ai
        from app.services.timeline_service import build_timeline_events

        scenarios = [
            ("English transcript", "en", ENGLISH_TEXT),
            ("Hindi transcript", "hi", HINDI_TEXT),
            ("Mixed Hindi/English transcript", "hi", MIXED_TEXT),
        ]

        for label, lang, text in scenarios:
            _calls.clear()
            transcript = _make_transcript(language=lang, text=text)

            result = run_summary_ai(transcript)
            summary_calls = [c for c in _calls if c.method == "generate_structured_summary"]
            if len(summary_calls) != 1:
                failures.append(f"[{label}] expected exactly 1 summary AI call, got {len(summary_calls)}")
                continue
            call = summary_calls[0]
            print(
                f"[{label}] transcript.language={lang!r} -> generate_structured_summary(language={call.language!r})"
            )
            if call.language != "English":
                failures.append(
                    f"[{label}] FAIL: summary AI called with language={call.language!r}, expected 'English'"
                )
            if call.text != text:
                failures.append(f"[{label}] FAIL: source transcript text was altered before reaching the AI provider")
            if text not in result.executive_summary:
                failures.append(f"[{label}] FAIL: original transcript text lost from summary provider echo")

            # Transcript row itself must be untouched — no translation side effect.
            if transcript.transcript != text:
                failures.append(f"[{label}] FAIL: transcript.transcript was mutated")
            if transcript.language != lang:
                failures.append(f"[{label}] FAIL: transcript.language was mutated")

            _calls.clear()
            events = build_timeline_events(transcript.meeting_id, transcript)
            timeline_calls = [c for c in _calls if c.method == "generate_timeline"]
            if len(timeline_calls) != 1:
                failures.append(f"[{label}] expected exactly 1 timeline AI call, got {len(timeline_calls)}")
                continue
            tcall = timeline_calls[0]
            print(f"[{label}] transcript.language={lang!r} -> generate_timeline(language={tcall.language!r})")
            if tcall.language != "English":
                failures.append(
                    f"[{label}] FAIL: timeline AI called with language={tcall.language!r}, expected 'English'"
                )
            if not events:
                failures.append(f"[{label}] FAIL: timeline events unexpectedly empty")

    # AI_OUTPUT_LANGUAGE override: confirm it's actually read from settings,
    # not hardcoded — proves there's one centralized knob, not a stray
    # literal "English" in summary_service.
    import os

    os.environ["AI_OUTPUT_LANGUAGE"] = "French"
    _reset_settings_cache()
    try:
        with mock.patch(
            "app.services.summary_service.get_summary_ai_provider", return_value=_RecordingProvider()
        ):
            from app.services.summary_service import run_summary_ai as run_summary_ai_2

            _calls.clear()
            transcript = _make_transcript(language="hi", text=HINDI_TEXT)
            run_summary_ai_2(transcript)
            call = next(c for c in _calls if c.method == "generate_structured_summary")
            print(f"[AI_OUTPUT_LANGUAGE=French override] -> generate_structured_summary(language={call.language!r})")
            if call.language != "French":
                failures.append(
                    f"[override] FAIL: expected the AI_OUTPUT_LANGUAGE env override ('French') to be honored, got {call.language!r}"
                )
    finally:
        del os.environ["AI_OUTPUT_LANGUAGE"]
        _reset_settings_cache()

    print("\n" + "=" * 70)
    if failures:
        print(f"FAILED: {len(failures)} check(s) did not pass:")
        for f in failures:
            print(f"  - {f}")
        return 1

    print("PASSED: all AI-output-language checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
