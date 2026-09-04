# Converra backend — production image.
#
# Build context is this `backend/` directory (set "Root Directory: backend"
# on the hosting platform, or `docker build -f backend/Dockerfile backend`).
#
# faster-whisper's WhisperModel is loaded with `local_files_only=True` (see
# app/services/transcription/faster_whisper.py) so a running job never
# depends on Hugging Face network access. That only works if the model
# weights are already sitting in the cache faster-whisper looks in --
# so this image downloads them once, at build time, into HF_HOME below.
# Both models are baked in because a job can legitimately fall back from
# WHISPER_MODEL_SIZE ("base") to WHISPER_FALLBACK_MODEL_SIZE ("small") --
# see app/core/config.py. If either setting is ever changed in production,
# rebuild the image with the two ARGs below updated to match.

FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/app/.cache/huggingface \
    HF_HUB_DISABLE_TELEMETRY=1

WORKDIR /app

# curl: only used by the HEALTHCHECK below.
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the base model and its configured fallback so the runtime
# container is fully self-contained (no HF Hub call on first job, no
# per-request/per-job download). Must match app/core/config.py's
# whisper_model_size / whisper_fallback_model_size defaults.
ARG WHISPER_MODEL_SIZE=base
ARG WHISPER_FALLBACK_MODEL_SIZE=small
RUN python -c "\
from faster_whisper import WhisperModel; \
WhisperModel('${WHISPER_MODEL_SIZE}', device='cpu', compute_type='int8'); \
WhisperModel('${WHISPER_FALLBACK_MODEL_SIZE}', device='cpu', compute_type='int8')"

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .
COPY scripts ./scripts

RUN groupadd -r converra && useradd -r -g converra converra \
    && chown -R converra:converra /app
USER converra

EXPOSE 8000

# $PORT is injected by the hosting platform (Render/Railway/Fly all set it);
# defaults to 8000 for a plain `docker run` with no -e PORT.
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -f "http://localhost:${PORT:-8000}/health" || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
