from __future__ import annotations

from supabase import StorageException

from app.core.config import get_settings
from app.core.supabase import get_supabase_client


class StorageError(Exception):
    """Raised when a Supabase Storage operation fails."""


def _bucket(bucket: str | None = None):
    bucket_name = bucket or get_settings().supabase_storage_bucket
    return get_supabase_client().storage.from_(bucket_name)


def upload_file(
    path: str,
    file: bytes,
    *,
    content_type: str | None = None,
    upsert: bool = False,
    bucket: str | None = None,
) -> str:
    """Upload a file to the bucket and return the storage path it was saved at."""
    file_options: dict[str, str] = {"upsert": "true" if upsert else "false"}
    if content_type:
        file_options["content-type"] = content_type

    try:
        _bucket(bucket).upload(path, file, file_options)
    except StorageException as exc:
        raise StorageError(f"Failed to upload '{path}': {exc}") from exc
    return path


def download_file(path: str, *, bucket: str | None = None) -> bytes:
    try:
        return _bucket(bucket).download(path)
    except StorageException as exc:
        raise StorageError(f"Failed to download '{path}': {exc}") from exc


def delete_file(path: str, *, bucket: str | None = None) -> None:
    try:
        _bucket(bucket).remove([path])
    except StorageException as exc:
        raise StorageError(f"Failed to delete '{path}': {exc}") from exc


def list_files(prefix: str = "", *, bucket: str | None = None) -> list[dict]:
    try:
        return _bucket(bucket).list(prefix)
    except StorageException as exc:
        raise StorageError(f"Failed to list files under '{prefix}': {exc}") from exc


def get_public_url(path: str, *, bucket: str | None = None) -> str:
    return _bucket(bucket).get_public_url(path)


def create_signed_url(path: str, *, expires_in: int = 3600, bucket: str | None = None) -> str:
    """Create a time-limited signed URL for a file in a private bucket."""
    try:
        result = _bucket(bucket).create_signed_url(path, expires_in)
    except StorageException as exc:
        raise StorageError(f"Failed to create signed URL for '{path}': {exc}") from exc

    signed_url = result.get("signedURL")
    if not signed_url:
        raise StorageError(f"No signed URL returned for '{path}'")
    return signed_url
