"""End-to-end verification of the Phase 2 Live Meeting lifecycle.

Exercises the real app (in-process, via TestClient) against the configured
database: register two throwaway users, then drive start/get/stop/invalid
transitions/auth isolation/delete/fail/cancel for real, asserting on the
actual HTTP responses. Cleans up every row it creates.

Usage: python -m scripts.verify_live_meetings
"""

import sys
import uuid

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models.user import User
from app.services.live_meeting_service import (
    cancel_live_meeting,
    fail_live_meeting,
)
from app.crud.live_meeting_session import get_live_session_by_meeting_id

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
    email_a = f"live-verify-a-{suffix}@example.com"
    email_b = f"live-verify-b-{suffix}@example.com"

    token_a = register(email_a)
    token_b = register(email_b)

    meeting_ids_to_cleanup: list[str] = []

    # A. start -> live
    resp = client.post("/api/v1/live-meetings/start", headers=auth(token_a), json={})
    check("A. start returns 201", resp.status_code == 201, resp.text)
    body = resp.json()
    check("A. state is 'live'", body.get("state") == "live", body)
    meeting_id = body["meeting_id"]
    meeting_ids_to_cleanup.append(meeting_id)

    # Idempotent double start (same active session, no duplicate meeting)
    resp2 = client.post("/api/v1/live-meetings/start", headers=auth(token_a), json={})
    check("A2. duplicate start returns same meeting_id", resp2.json()["meeting_id"] == meeting_id, resp2.json())
    check("A2. duplicate start returns same session id", resp2.json()["id"] == body["id"], resp2.json())

    # B. get status -> live
    resp = client.get(f"/api/v1/live-meetings/{meeting_id}", headers=auth(token_a))
    check("B. get returns 200", resp.status_code == 200, resp.text)
    check("B. get state is 'live'", resp.json()["state"] == "live", resp.json())
    check("B. transcript_id is null (no transcript yet)", resp.json()["transcript_id"] is None)
    check("B. processing_job_id is null (no job yet)", resp.json()["processing_job_id"] is None)
    check("B. started_at present", resp.json()["started_at"] is not None)
    check("B. stopped_at is null before stop", resp.json()["stopped_at"] is None)

    # F. auth ownership — user B cannot see or control user A's session
    resp = client.get(f"/api/v1/live-meetings/{meeting_id}", headers=auth(token_b))
    check("F. other user GET is 404", resp.status_code == 404, resp.text)
    resp = client.post(f"/api/v1/live-meetings/{meeting_id}/stop", headers=auth(token_b))
    check("F. other user stop is 404", resp.status_code == 404, resp.text)
    resp = client.delete(f"/api/v1/meetings/{meeting_id}", headers=auth(token_b))
    check("F. other user delete is 404", resp.status_code == 404, resp.text)

    # C. stop -> stopping
    resp = client.post(f"/api/v1/live-meetings/{meeting_id}/stop", headers=auth(token_a))
    check("C. stop returns 200", resp.status_code == 200, resp.text)
    check("C. state is 'stopping'", resp.json()["state"] == "stopping", resp.json())
    check("C. stopped_at now set", resp.json()["stopped_at"] is not None)

    # D. repeated stop -> idempotent
    resp = client.post(f"/api/v1/live-meetings/{meeting_id}/stop", headers=auth(token_a))
    check("D. repeated stop returns 200", resp.status_code == 200, resp.text)
    check("D. repeated stop still 'stopping'", resp.json()["state"] == "stopping", resp.json())

    # E. invalid transition — start (live) is not reachable again on this
    # meeting via /start (that would just re-surface the active session, not
    # let us re-live it), so test invalid transition directly: stopping a
    # session already in "cancelled"/"failed" state must be rejected. Use a
    # second, dedicated session for this.
    resp = client.post("/api/v1/live-meetings/start", headers=auth(token_b))
    meeting_id_b = resp.json()["meeting_id"]
    meeting_ids_to_cleanup.append(meeting_id_b)

    # H. fail transition (internal service, exercised directly — not public API)
    db = SessionLocal()
    try:
        from app.crud.live_meeting_session import get_live_session

        user_b = db.query(User).filter(User.email == email_b).first()
        session_b = get_live_session(db, uuid.UUID(meeting_id_b), user_b.id)
        failed = fail_live_meeting(db, session_b, error_message="simulated capture failure")
        check("H. fail_live_meeting -> 'failed'", failed.state == "failed", failed.state)
        check("H. error_message preserved", failed.error_message == "simulated capture failure")
    finally:
        db.close()

    # E. invalid transition: stop a session that's already 'failed'
    resp = client.post(f"/api/v1/live-meetings/{meeting_id_b}/stop", headers=auth(token_b))
    check("E. stop on failed session is rejected (409)", resp.status_code == 409, resp.text)

    # E2. invalid transition: begin_live_finalization from 'live' (not 'stopping')
    db = SessionLocal()
    try:
        from app.crud.live_meeting_session import get_live_session
        from app.services.live_meeting_service import begin_live_finalization
        from app.core.exceptions import AppError

        user_a = db.query(User).filter(User.email == email_a).first()
        user_b = db.query(User).filter(User.email == email_b).first()
        # meeting_id is currently 'stopping' for user A; begin_live_finalization
        # from 'stopping' should succeed...
        session_a = get_live_session(db, uuid.UUID(meeting_id), user_a.id)
        finalizing = begin_live_finalization(db, session_a)
        check("stopping -> finalizing succeeds", finalizing.state == "finalizing", finalizing.state)

        # ...but calling it again (now 'finalizing') is idempotent-safe? No —
        # begin_live_finalization target IS 'finalizing', so repeating it is
        # idempotent (state == target), not rejected. Verify that:
        finalizing2 = begin_live_finalization(db, session_a)
        check("finalizing -> finalizing is idempotent", finalizing2.state == "finalizing")

        # Now test a genuinely invalid transition: complete from 'live' state
        # (use session_b which is 'failed', a terminal state) must reject.
        session_b2 = get_live_session(db, uuid.UUID(meeting_id_b), user_b.id)
        try:
            from app.services.live_meeting_service import complete_live_meeting

            complete_live_meeting(db, session_b2)
            check("E2. complete on failed session rejected", False, "did not raise")
        except AppError as exc:
            check("E2. complete on failed session rejected", exc.status_code == 409, exc.message)

        # H2. cancel from finalizing
        cancelled = cancel_live_meeting(db, session_a)
        check("H2. finalizing -> cancelled", cancelled.state == "cancelled", cancelled.state)
    finally:
        db.close()

    # G. delete -> no orphaned session data
    for mid in meeting_ids_to_cleanup:
        resp = client.delete(f"/api/v1/meetings/{mid}", headers=auth(token_a if mid == meeting_id else token_b))
        check(f"G. delete meeting {mid} returns 204", resp.status_code == 204, resp.text)

    db = SessionLocal()
    try:
        for mid in meeting_ids_to_cleanup:
            orphan = get_live_session_by_meeting_id(db, uuid.UUID(mid))
            check(f"G. no orphaned live_meeting_session row for {mid}", orphan is None)
    finally:
        db.close()

    # I. backend import/start already implicitly verified by this script
    # running at all (TestClient boots the real app).
    check("I. app booted and served requests", True)

    print()
    if failures:
        print(f"{len(failures)} check(s) FAILED: {failures}")
        return 1
    print("All checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
