"""Selects an `AIProvider` implementation based on `AI_PROVIDER`.

To add a new provider (OpenAI, Gemini, Claude, ...): implement `AIProvider`
in `providers/<name>.py` and add one branch here. Nothing else that consumes
`get_ai_provider()` needs to change.
"""

from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.services.ai.base import AIProvider

_UNIMPLEMENTED_PROVIDERS = {"openai", "gemini", "claude"}


@lru_cache
def get_ai_provider() -> AIProvider:
    """Returns the configured provider, constructing (and caching) it once per
    process.
    """
    provider_name = get_settings().ai_provider

    if provider_name == "ollama":
        from app.services.ai.providers.ollama import OllamaProvider

        return OllamaProvider()

    if provider_name in _UNIMPLEMENTED_PROVIDERS:
        raise NotImplementedError(f"AI provider '{provider_name}' is not implemented yet.")

    raise ValueError(f"Unknown AI provider: '{provider_name}'")
