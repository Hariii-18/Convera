"""Simulated processing steps.

This module stands in for the real audio pipeline (Whisper transcription,
GPT summarization, timeline generation, etc.) that will replace it in a
later sprint. Nothing here touches the database — it only simulates work
and reports progress so `processing_service` can persist it.
"""

import asyncio
from collections.abc import AsyncIterator

PREPARATION_DELAY_SECONDS = 1.0

# (stage label, progress percentage once the step completes, simulated delay)
SIMULATED_STEPS: list[tuple[str, int, float]] = [
    ("Analyzing audio", 25, 1.0),
    ("Extracting content", 50, 1.0),
    ("Generating output", 75, 1.0),
    ("Finalizing", 100, 1.0),
]


async def run_preparation() -> None:
    """Simulates pre-processing setup (file validation, resource allocation)."""
    await asyncio.sleep(PREPARATION_DELAY_SECONDS)


async def run_processing_steps() -> AsyncIterator[tuple[str, int]]:
    """Simulates the processing stages, yielding (stage label, progress) as each completes."""
    for label, progress, delay in SIMULATED_STEPS:
        await asyncio.sleep(delay)
        yield label, progress
