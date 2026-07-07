"""Verify Supabase Storage is reachable and the configured bucket exists.

Uploads, downloads, and deletes a small throwaway file to confirm the
service role key has read/write access to the bucket end-to-end.

Usage: python -m scripts.verify_storage
"""

import sys
import uuid

from supabase import StorageException

from app.core.config import get_settings
from app.core.supabase import get_supabase_client
from app.services.storage_service import delete_file, download_file, upload_file


def main() -> int:
    settings = get_settings()
    bucket = settings.supabase_storage_bucket
    client = get_supabase_client()

    try:
        buckets = {b.id for b in client.storage.list_buckets()}
    except Exception as exc:  # noqa: BLE001  (top-level diagnostic script)
        print(f"FAILED: could not reach Supabase Storage: {exc}")
        return 1

    if bucket not in buckets:
        print(f"FAILED: bucket '{bucket}' does not exist (found: {sorted(buckets) or 'none'})")
        return 1
    print(f"OK: bucket '{bucket}' exists")

    probe_path = f"_healthcheck/{uuid.uuid4()}.txt"
    payload = b"converra storage healthcheck"
    try:
        upload_file(probe_path, payload, content_type="text/plain", bucket=bucket)
        fetched = download_file(probe_path, bucket=bucket)
        assert fetched == payload, "downloaded content did not match uploaded content"
    except (StorageException, AssertionError) as exc:
        print(f"FAILED: upload/download round-trip failed: {exc}")
        return 1
    finally:
        try:
            delete_file(probe_path, bucket=bucket)
        except StorageException:
            pass

    print("OK: upload/download/delete round-trip succeeded")
    return 0


if __name__ == "__main__":
    sys.exit(main())
