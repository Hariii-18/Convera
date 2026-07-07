from __future__ import annotations

import re
import unicodedata
import uuid
from pathlib import PurePosixPath

from fastapi import status

from app.core.exceptions import AppError

ALLOWED_EXTENSIONS = {"mp3", "wav", "m4a", "aac", "mp4", "mov", "mkv", "webm"}

# Content types accepted per extension. Browsers/OSes are inconsistent about
# what they send (or send nothing/`application/octet-stream`), so this is only
# enforced when a specific, non-generic content type is present.
ALLOWED_MIME_TYPES: dict[str, set[str]] = {
    "mp3": {"audio/mpeg", "audio/mp3"},
    "wav": {"audio/wav", "audio/x-wav", "audio/wave"},
    "m4a": {"audio/mp4", "audio/x-m4a", "audio/m4a"},
    "aac": {"audio/aac", "audio/x-aac", "audio/aacp"},
    "mp4": {"video/mp4"},
    "mov": {"video/quicktime"},
    "mkv": {"video/x-matroska"},
    "webm": {"video/webm", "audio/webm"},
}

_GENERIC_CONTENT_TYPES = {"application/octet-stream", ""}


def sanitize_filename(filename: str) -> str:
    """Strip any path components and unsafe characters from a client-supplied filename."""
    name = PurePosixPath(filename.replace("\\", "/")).name
    name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    name = re.sub(r"[^A-Za-z0-9._-]", "_", name).strip("._")
    return name[:255] if name else "upload"


def get_validated_extension(filename: str, content_type: str | None) -> str:
    """Validate a sanitized filename's extension (and content type, if informative).

    Raises `AppError` (400) when the file type isn't one of `ALLOWED_EXTENSIONS`.
    """
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    if extension not in ALLOWED_EXTENSIONS:
        raise AppError(
            f"Unsupported file type '.{extension or filename}'. "
            f"Allowed types: {', '.join(sorted(ALLOWED_EXTENSIONS))}.",
            status.HTTP_400_BAD_REQUEST,
        )

    if content_type and content_type.lower() not in _GENERIC_CONTENT_TYPES:
        allowed_mimes = ALLOWED_MIME_TYPES.get(extension, set())
        if allowed_mimes and content_type.lower() not in allowed_mimes:
            raise AppError(
                f"File content type '{content_type}' does not match extension '.{extension}'.",
                status.HTTP_400_BAD_REQUEST,
            )

    return extension


def build_stored_filename(extension: str) -> str:
    return f"{uuid.uuid4().hex}.{extension}"


def build_storage_path(user_id: int, stored_filename: str) -> str:
    return f"meetings/{user_id}/{stored_filename}"
