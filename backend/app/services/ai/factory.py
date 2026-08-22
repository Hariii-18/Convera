"""Selects an `AIProvider` implementation based on `AI_PROVIDER` (for
translation), `SUMMARY_AI_PROVIDER` (for Summary generation — see
`get_summary_ai_provider`), or `NORMALIZATION_AI_PROVIDER` (for Normalization
— see `get_normalization_ai_provider`).

To add a new provider (Gemini, Claude, ...): implement `AIProvider` in
`providers/<name>.py` and add one branch to the relevant getter below.
Nothing else that consumes these getters needs to change.
"""

from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.services.ai.base import AIProvider

_UNIMPLEMENTED_PROVIDERS = {"openai", "gemini", "claude"}


@lru_cache
def get_ai_provider() -> AIProvider:
    """Returns the configured provider for translation, constructing (and
    caching) it once per process.
    """
    provider_name = get_settings().ai_provider

    if provider_name == "ollama":
        from app.services.ai.providers.ollama import OllamaProvider

        return OllamaProvider()

    if provider_name in _UNIMPLEMENTED_PROVIDERS:
        raise NotImplementedError(f"AI provider '{provider_name}' is not implemented yet.")

    raise ValueError(f"Unknown AI provider: '{provider_name}'")


@lru_cache
def get_normalization_ai_provider() -> AIProvider:
    """Returns the configured provider for Normalization, constructing (and
    caching) it once per process. Selected via `NORMALIZATION_AI_PROVIDER`,
    independent of `AI_PROVIDER` — Normalization runs on a cloud provider (no
    local model resources) while translation is unaffected.
    """
    provider_name = get_settings().normalization_ai_provider

    if provider_name == "openai":
        from app.services.ai.providers.openai import OpenAIProvider

        return OpenAIProvider()

    if provider_name == "ollama":
        from app.services.ai.providers.ollama import OllamaProvider

        return OllamaProvider()

    raise ValueError(f"Unknown Normalization AI provider: '{provider_name}'")


@lru_cache
def get_summary_ai_provider() -> AIProvider:
    """Returns the configured provider for Summary generation, constructing
    (and caching) it once per process. Selected via `SUMMARY_AI_PROVIDER`,
    independent of `AI_PROVIDER` — Summary runs on a cloud provider (no
    local model resources) while normalization/translation are unaffected.
    """
    provider_name = get_settings().summary_ai_provider

    if provider_name == "openai":
        from app.services.ai.providers.openai import OpenAIProvider

        return OpenAIProvider()

    if provider_name == "ollama":
        from app.services.ai.providers.ollama import OllamaProvider

        return OllamaProvider()

    raise ValueError(f"Unknown Summary AI provider: '{provider_name}'")
