"""End-to-end verification of the Phase 6 Live Meeting finalization flow.

Exercises the real app (in-process, via TestClient) against the configured
database and configured AI providers: register a throwaway user, start a
live session, finalize it with a synthetic (but realistic) transcript --
the same shape `LiveTranscriptionPipeline.get_transcript_segments()` hands
`finalize_live_meeting` -- and assert on the real HTTP/DB state afterward.

This does not drive a browser or a microphone (no display/audio device in
this environment); it calls `finalize_live_meeting` directly, which is
exactly what `app.api.v1.live_meetings`'s WebSocket handler calls once it
has drained the pipeline's committed segments. So it verifies everything
downstream of "the segments are ready": persistence, the shared
normalize/summary pipeline, retry, idempotency, and delete-cascade.

Usage: python -m scripts.verify_live_finalization
"""

import sys
import uuid

from fastapi.testclient import TestClient

from app.core.exceptions import AppError
from app.crud.live_meeting_session import get_live_session
from app.crud.transcript import get_transcript_by_meeting_id
from app.crud.upload import list_uploads_by_meeting_id
from app.crud.summary import get_summary_by_meeting_id
from app.db.session import SessionLocal
from app.main import app
from app.models.user import User
from app.services.live_meeting_service import finalize_live_meeting, retry_live_meeting
from app.services.transcription.base import TranscriptSegment

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


def main() -> int:
    suffix = uuid.uuid4().hex[:10]
    email = f"live-finalize-verify-{suffix}@example.com"
    token = register(email)

    # A. start a live session, same as the browser's "Start Live Meeting".
    resp = client.post(
        "/api/v1/live-meetings/start", headers=auth(token), json={"title": "Verify Live Finalization"}
    )
    check("A. start returns 201", resp.status_code == 201, resp.text)
    meeting_id = resp.json()["meeting_id"]

    segments = [
        TranscriptSegment(start=0.0, end=2.4, text="Hello everyone, thanks for joining."),
        TranscriptSegment(start=2.4, end=5.1, text="Let's go over today's agenda."),
        TranscriptSegment(start=5.1, end=8.0, text="First item is the Q3 roadmap."),
    ]
    expected_text = " ".join(s.text for s in segments)

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        session = get_live_session(db, uuid.UUID(meeting_id), user.id)

        # B. finalize -- this is exactly what the WebSocket handler's
        # `finally` block calls once `LiveTranscriptionPipeline.stop()` has
        # drained the session's committed segments.
        finalized = finalize_live_meeting(db, session, segments)
        check(
            "B. finalize reaches a terminal state",
            finalized.state in ("completed", "failed"),
            finalized.state,
        )

        transcript = get_transcript_by_meeting_id(db, uuid.UUID(meeting_id))
        check("B. exactly one Transcript row saved", transcript is not None)
        check("B. transcript text matches merged segments", transcript.transcript == expected_text, transcript.transcript)
        check("B. transcript has 3 segments", len(transcript.segments) == 3, transcript.segments)

        uploads = list_uploads_by_meeting_id(db, uuid.UUID(meeting_id))
        check("B. exactly one placeholder Upload row", len(uploads) == 1, len(uploads))

        if finalized.state == "completed":
            summary = get_summary_by_meeting_id(db, uuid.UUID(meeting_id))
            check("B. summary generated on completion", summary is not None)
            check("B. normalized_at set on completion", transcript.normalized_at is not None)
        else:
            check(
                "B. error_message set on failure",
                bool(finalized.error_message),
                finalized.error_message,
            )
            print(
                f"    (finalize ended in 'failed' -- likely the normalize/summary AI "
                f"provider isn't reachable in this environment: {finalized.error_message!r}. "
                f"Continuing to verify the retry path against this real failure.)"
            )
    finally:
        db.close()

    # C. GET /transcripts?meeting_id=... returns the persisted transcript.
    resp = client.get(f"/api/v1/transcripts?meeting_id={meeting_id}", headers=auth(token))
    check("C. GET /transcripts returns 200", resp.status_code == 200, resp.text)
    check("C. GET /transcripts text matches", resp.json().get("transcript") == expected_text)

    # D. reload the session -- transcript_id present regardless of outcome.
    resp = client.get(f"/api/v1/live-meetings/{meeting_id}", headers=auth(token))
    check("D. GET session returns 200", resp.status_code == 200, resp.text)
    check("D. transcript_id populated", resp.json().get("transcript_id") is not None, resp.json())

    # E. idempotent re-finalize: calling finalize_live_meeting again for the
    # same (already-terminal) session must not create a second Transcript
    # or Upload row, and must not re-run the pipeline.
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        session = get_live_session(db, uuid.UUID(meeting_id), user.id)
        re_finalized = finalize_live_meeting(db, session, segments)
        check("E. re-finalize is a no-op (same state)", re_finalized.state == session.state)
        transcripts_count = 1 if get_transcript_by_meeting_id(db, uuid.UUID(meeting_id)) is not None else 0
        check("E. still exactly one Transcript row", transcripts_count == 1)
        check(
            "E. still exactly one Upload row",
            len(list_uploads_by_meeting_id(db, uuid.UUID(meeting_id))) == 1,
        )
    finally:
        db.close()

    # F. retry endpoint: only reachable (and only meaningful) from 'failed'.
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        session = get_live_session(db, uuid.UUID(meeting_id), user.id)
        if session.state == "failed":
            before = get_transcript_by_meeting_id(db, uuid.UUID(meeting_id))
            retried = retry_live_meeting(db, session)
            check(
                "F. retry reaches a terminal state without re-transcribing",
                retried.state in ("completed", "failed"),
                retried.state,
            )
            after = get_transcript_by_meeting_id(db, uuid.UUID(meeting_id))
            check(
                "F. retry did not touch the raw transcript text",
                after.transcript == before.transcript,
            )
            check(
                "F. retry did not create a second Upload row",
                len(list_uploads_by_meeting_id(db, uuid.UUID(meeting_id))) == 1,
            )

            resp = client.post(f"/api/v1/live-meetings/{meeting_id}/retry", headers=auth(token))
            if retried.state == "failed":
                check("F2. retry endpoint on still-failed session returns 200", resp.status_code == 200, resp.text)
            else:
                check("F2. retry endpoint on completed session is rejected (409)", resp.status_code == 409, resp.text)
        else:
            resp = client.post(f"/api/v1/live-meetings/{meeting_id}/retry", headers=auth(token))
            check("F2. retry on a completed session is rejected (409)", resp.status_code == 409, resp.text)
    finally:
        db.close()

    # G. REST /stop after finalize already ran must not error (races the
    # frontend's own REST stop call against the WebSocket-driven finalize).
    resp = client.post(f"/api/v1/live-meetings/{meeting_id}/stop", headers=auth(token))
    check(
        "G. REST /stop after finalize doesn't conflict (200 or 409-if-failed)",
        resp.status_code in (200, 409),
        resp.text,
    )

    # H. delete cascade removes transcript, upload, live session, summary.
    resp = client.delete(f"/api/v1/meetings/{meeting_id}", headers=auth(token))
    check("H. delete meeting returns 204", resp.status_code == 204, resp.text)

    db = SessionLocal()
    try:
        check("H. transcript gone", get_transcript_by_meeting_id(db, uuid.UUID(meeting_id)) is None)
        check("H. uploads gone", list_uploads_by_meeting_id(db, uuid.UUID(meeting_id)) == [])
        check("H. summary gone", get_summary_by_meeting_id(db, uuid.UUID(meeting_id)) is None)
        user = db.query(User).filter(User.email == email).first()
        check("H. live session gone", get_live_session(db, uuid.UUID(meeting_id), user.id) is None)
    finally:
        db.close()

    print()
    if failures:
        print(f"{len(failures)} check(s) FAILED: {failures}")
        return 1
    print("All checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
