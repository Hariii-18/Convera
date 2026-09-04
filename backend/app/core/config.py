from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"

    database_url: str

    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60

    cors_origins: str = "http://localhost:3000"

    supabase_url: str
    supabase_service_role_key: str
    supabase_storage_bucket: str = "converra-files"

    max_upload_size_mb: int = 500

    # Selects the `TranscriptionProvider` implementation from
    # `app.services.transcription.factory`. Adding a new provider (OpenAI,
    # Deepgram, AssemblyAI, ...) only means adding a module + a branch there.
    transcription_provider: str = "faster_whisper"
    whisper_model_size: str = "base"
    whisper_device: str = "cpu"
    whisper_compute_type: str = "int8"
    # Only used as a retry when `whisper_model_size` produces unusable output
    # (empty or garbage/hallucinated — see `is_unusable_transcription`) —
    # never the default. See `workers.processor.transcribe_with_fallback`.
    whisper_fallback_model_size: str = "small"

    # Selects the `DiarizationProvider` implementation from
    # `app.services.diarization.factory`. "mfcc" is CPU-only and needs no
    # extra model download -- see `mfcc_diarizer`'s module docstring for why
    # it was chosen over a torch-based neural-embedding provider.
    diarization_provider: str = "mfcc"

    # Selects the `AIProvider` implementation from `app.services.ai.factory`
    # for translation only (see `get_ai_provider`). Only "ollama" is
    # implemented here; "openai", "gemini", "claude" are reserved names for
    # future providers. Neither Summary nor Normalization uses this setting
    # — see `summary_ai_provider` and `normalization_ai_provider` below.
    ai_provider: str = "ollama"
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.1"
    ollama_request_timeout_seconds: float = 120.0

    # Selects the `AIProvider` implementation used specifically for Summary
    # generation (see `app.services.ai.factory.get_summary_ai_provider`).
    # Kept independent of `ai_provider` so Summary can run on a cloud
    # provider (no local model resources, reliable in Codespaces) while
    # translation keeps using whatever `ai_provider` selects.
    summary_ai_provider: str = "openai"
    openai_api_key: str = ""
    openai_summary_model: str = "gpt-4.1"
    openai_base_url: str = "https://api.openai.com/v1"
    openai_request_timeout_seconds: float = 60.0

    # Selects the `AIProvider` implementation used specifically for
    # Normalization (see `app.services.ai.factory.get_normalization_ai_provider`).
    # Kept independent of `ai_provider` for the same reason as
    # `summary_ai_provider` above — normalization runs on a cloud provider by
    # default instead of depending on a local Ollama server.
    normalization_ai_provider: str = "openai"
    openai_normalization_model: str = "gpt-4.1"

    # Fixed output language for AI-*generated* meeting intelligence (Summary
    # sections and Timeline event labels — see
    # `app.services.summary_service.run_summary_ai` and
    # `app.services.timeline_service.build_timeline_events`). Deliberately
    # independent of `transcript.language` (the spoken language Whisper
    # detected — see `app.services.transcription.faster_whisper`) and of any
    # request/browser locale: those describe the meeting audio, not what
    # language the AI should write in. Normalization and translation are
    # untouched by this — they must keep preserving/targeting the
    # transcript's own language, not this one.
    ai_output_language: str = "English"

    # Resend (https://resend.com) is used to email Meeting Notes exports —
    # see `app.services.email.resend_provider`. `resend_from_email` must be a
    # verified sender/domain in the Resend account.
    resend_api_key: str = ""
    resend_from_email: str = ""
    resend_request_timeout_seconds: float = 30.0

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
