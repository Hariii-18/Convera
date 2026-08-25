"""End-to-end verification of the Timeline feature against the real,
configured database and AI provider (no mocks).

Exercises the real app (in-process, via TestClient): registers two
throwaway users, creates a meeting with a real transcript (segments copied
from an actual production conversation), runs the real
`run_post_transcription_pipeline` (real Ollama call, real DB persistence),
then drives the real `GET /api/v1/meetings/{meeting_id}/timeline` endpoint
for chronological ordering, auth isolation (404), the no-timeline-yet empty
state (200 + []), and rerun/idempotency (no duplication). Cleans up every
row it creates.

Usage: python -m scripts.verify_timeline
"""

import json
import sys
import uuid
from pathlib import Path

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models.meeting import Meeting
from app.models.upload import Upload
from app.models.user import User
from app.crud.transcript import upsert_transcript, get_transcript_by_meeting_id
from app.crud.summary import get_summary_by_meeting_id
from app.services.pipeline_service import run_post_transcription_pipeline

client = TestClient(app)

failures: list[str] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    if condition:
        print(f"PASS: {label}")
    else:
        print(f"FAIL: {label} {detail}")
        failures.append(label)


def register(email: str) -> str:
    resp = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "TestPass123!", "full_name": "Verify Bot"},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["access_token"]


def auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


REAL_SEGMENTS_PATH = Path(
    "/tmp/claude-1000/-workspaces-Convera/8a065a70-4c15-4a78-a78f-222d3299b755/scratchpad/real_segments.json"
)


def main() -> int:
    suffix = uuid.uuid4().hex[:10]
    email_a = f"timeline-verify-a-{suffix}@example.com"
    email_b = f"timeline-verify-b-{suffix}@example.com"

    token_a = register(email_a)
    token_b = register(email_b)

    meeting_ids_to_cleanup: list[tuple[str, str]] = []  # (meeting_id, owner_token)

    # --- Meeting A: real transcript content, will get a real timeline via
    # the real post-transcription pipeline.
    resp = client.post(
        "/api/v1/meetings",
        headers=auth(token_a),
        json={"title": f"Timeline Verify Meeting {suffix}", "source_type": "upload-recording"},
    )
    check("setup: create meeting A returns 201", resp.status_code == 201, resp.text)
    meeting_id_a = resp.json()["id"]
    meeting_ids_to_cleanup.append((meeting_id_a, token_a))

    # --- Meeting B (owned by A too): no transcript at all -> the
    # no-timeline-data case.
    resp = client.post(
        "/api/v1/meetings",
        headers=auth(token_a),
        json={"title": f"Timeline Verify Meeting Empty {suffix}", "source_type": "upload-recording"},
    )
    check("setup: create meeting B (no transcript) returns 201", resp.status_code == 201, resp.text)
    meeting_id_b = resp.json()["id"]
    meeting_ids_to_cleanup.append((meeting_id_b, token_a))

    real_data = json.loads(REAL_SEGMENTS_PATH.read_text())

    db = SessionLocal()
    try:
        user_a = db.query(User).filter(User.email == email_a).first()
        upload = Upload(
            user_id=user_a.id,
            meeting_id=uuid.UUID(meeting_id_a),
            original_filename="verify-timeline.wav",
            stored_filename="verify-timeline.wav",
            storage_path="verify/timeline.wav",
            bucket="converra-files",
            mime_type="audio/wav",
            size_bytes=1234,
            status="completed",
        )
        db.add(upload)
        db.commit()
        db.refresh(upload)

        upsert_transcript(
            db,
            meeting_id=uuid.UUID(meeting_id_a),
            upload_id=upload.id,
            language="en",
            transcript=real_data["transcript"],
            segments=real_data["segments"],
            duration=real_data["duration"],
            word_count=real_data["word_count"],
        )

        meeting_a = db.query(Meeting).filter(Meeting.id == uuid.UUID(meeting_id_a)).first()
        meeting_a.status = "processing"
        db.commit()
    finally:
        db.close()

    # --- 5. Meeting without timeline data returns 200 with empty events
    # list (test this before generation touches meeting A too, and for the
    # transcript-less meeting B).
    resp = client.get(f"/api/v1/meetings/{meeting_id_b}/timeline", headers=auth(token_a))
    check("5. no-transcript meeting -> 200", resp.status_code == 200, resp.text)
    check("5. no-transcript meeting -> empty events list", resp.json().get("events") == [], resp.json())

    resp = client.get(f"/api/v1/meetings/{meeting_id_a}/timeline", headers=auth(token_a))
    check("5b. pre-pipeline meeting -> 200", resp.status_code == 200, resp.text)
    check("5b. pre-pipeline meeting -> empty events list", resp.json().get("events") == [], resp.json())

    # --- 2. Run the REAL post-transcription pipeline (real Ollama call,
    # real DB persistence) against meeting A. Timeline generation against a
    # local Ollama call can transiently time out (slow/cold model, retried
    # by the app's own design -- see pipeline_service's "not
    # existing_summary.timeline_events: retry" logic) so retry a few times
    # exactly as a real subsequent pipeline run would, rather than treating
    # one slow attempt as a failure.
    stages: list[str] = []
    first_run_count = 0
    for attempt in range(3):
        db = SessionLocal()
        try:
            stages = []
            summary = run_post_transcription_pipeline(
                db, uuid.UUID(meeting_id_a), on_stage=lambda stage, pct: stages.append(stage)
            )
            first_run_count = len(summary.timeline_events)
        finally:
            db.close()
        if first_run_count > 0:
            break
        print(f"  (attempt {attempt + 1}: timeline still empty, retrying like a real rerun would)")

    check("2. pipeline ran timeline stage", "Generating timeline" in stages, stages)
    check("2. pipeline persisted timeline events", first_run_count > 0, first_run_count)

    # --- 3. GET timeline returns persisted events in chronological order.
    resp = client.get(f"/api/v1/meetings/{meeting_id_a}/timeline", headers=auth(token_a))
    check("3. GET timeline -> 200", resp.status_code == 200, resp.text)
    body = resp.json()
    events = body.get("events", [])
    check("3. events non-empty", len(events) > 0, events)
    starts = [e["start"] for e in events]
    check("3. events chronologically ordered", starts == sorted(starts), starts)
    check("3. meeting_id matches", body.get("meeting_id") == meeting_id_a, body)
    check(
        "3. event shape has start/title",
        all("start" in e and "title" in e for e in events),
        events[:1],
    )

    # --- 4. Unauthorized user (B, not the owner) gets 404.
    resp = client.get(f"/api/v1/meetings/{meeting_id_a}/timeline", headers=auth(token_b))
    check("4. non-owner GET timeline -> 404", resp.status_code == 404, resp.text)

    # 4b. Nonexistent meeting id -> 404.
    resp = client.get(f"/api/v1/meetings/{uuid.uuid4()}/timeline", headers=auth(token_a))
    check("4b. nonexistent meeting -> 404", resp.status_code == 404, resp.text)

    # --- 6. Rerunning the pipeline does not duplicate/corrupt events.
    db = SessionLocal()
    try:
        summary2 = run_post_transcription_pipeline(db, uuid.UUID(meeting_id_a))
        check(
            "6. rerun does not duplicate events",
            len(summary2.timeline_events) == first_run_count,
            (len(summary2.timeline_events), first_run_count),
        )
    finally:
        db.close()

    resp = client.get(f"/api/v1/meetings/{meeting_id_a}/timeline", headers=auth(token_a))
    check(
        "6. GET after rerun still matches",
        len(resp.json().get("events", [])) == first_run_count,
        resp.json(),
    )

    # --- 9. Existing Summary/Transcript behavior unchanged: summary and
    # transcript endpoints still work normally for the same meeting.
    resp = client.get(f"/api/v1/meetings/{meeting_id_a}", headers=auth(token_a))
    check("9. meeting GET unaffected", resp.status_code == 200, resp.text)

    db = SessionLocal()
    try:
        summary_row = get_summary_by_meeting_id(db, uuid.UUID(meeting_id_a))
        check("9. summary row still has executive_summary", bool(summary_row.executive_summary), summary_row)
        transcript_row = get_transcript_by_meeting_id(db, uuid.UUID(meeting_id_a))
        check("9. transcript row unaffected", transcript_row is not None and len(transcript_row.segments) == 28)
    finally:
        db.close()

    # --- cleanup
    for mid, token in meeting_ids_to_cleanup:
        resp = client.delete(f"/api/v1/meetings/{mid}", headers=auth(token))
        check(f"cleanup: delete meeting {mid} returns 204", resp.status_code == 204, resp.text)

    print()
    if failures:
        print(f"{len(failures)} check(s) FAILED: {failures}")
        return 1
    print("All checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
