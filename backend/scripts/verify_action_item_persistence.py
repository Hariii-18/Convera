"""Verify Summary-tab action-item persistence (status/owner/due_date/text).

Exercises the real DB (no mocking of the DB layer) through
`services.summary_service.update_summary_action_item` — the same function
`PATCH /summaries/action-items/{index}` calls — using a throwaway
user/meeting/upload/transcript/summary, cleaned up at the end regardless of
outcome.

Checks:

  A. A status/owner/due_date edit persists across a fresh read (simulated
     "reload" — a brand new `get_summary_by_meeting_id` call, not the same
     Python object).
  B. Editing one action item leaves every other item's fields untouched.
  C. An out-of-range index is rejected (404), not silently ignored or
     applied to the wrong item.
  D. A user who doesn't own the meeting is rejected (404), not shown or
     allowed to edit the summary.
  E. Regenerating the summary (`upsert_summary`, what `POST /summaries`
     calls) replaces `action_items` from fresh AI output — so a prior edit
     is intentionally not preserved across a full regenerate. This is
     existing, documented behavior (`upsert_summary`'s docstring: regenerate
     "overwrites the prior result"), not a new gap introduced here.
  F. Meeting Notes' own action items (a separate persisted row, see
     `models/meeting_notes.py`) are unaffected by a Summary action-item edit.
  G. An unrecognized status value is rejected by the schema (422-equivalent
     `ValidationError`), never silently accepted or defaulted.

Usage: python -m scripts.verify_action_item_persistence
"""

import sys
import uuid

from pydantic import ValidationError

from app.core.exceptions import AppError
from app.crud.meeting import create_meeting
from app.crud.meeting_notes import create_meeting_notes
from app.crud.summary import get_summary_by_meeting_id, upsert_summary
from app.crud.transcript import upsert_transcript
from app.crud.upload import create_upload
from app.db.session import SessionLocal
from app.models.meeting import Meeting
from app.models.meeting_notes import MeetingNotes
from app.models.summary import Summary
from app.models.transcript import Transcript
from app.models.upload import Upload
from app.models.user import User
from app.schemas.meeting import MeetingCreate
from app.schemas.summary import SummaryActionItemUpdate
from app.services.summary_service import update_summary_action_item

OWNER_EMAIL = "verify-action-item-owner@convera.test"
OTHER_EMAIL = "verify-action-item-other@convera.test"


def _get_or_create_user(db, email: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user is not None:
        return user
    user = User(
        email=email,
        full_name="Action Item Verify",
        hashed_password="not-a-real-hash",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _seed(db, owner: User):
    meeting = create_meeting(
        db,
        user_id=owner.id,
        meeting_in=MeetingCreate(title="action-item-verify", source_type="upload-recording"),
    )
    upload = create_upload(
        db,
        user_id=owner.id,
        meeting_id=meeting.id,
        original_filename="action-item-verify.wav",
        stored_filename=f"{uuid.uuid4()}.wav",
        storage_path=f"verify/{uuid.uuid4()}.wav",
        bucket="test-bucket",
        mime_type="audio/wav",
        size_bytes=1234,
    )
    upsert_transcript(
        db,
        meeting_id=meeting.id,
        upload_id=upload.id,
        language="en",
        transcript="Ship the report. Follow up with legal.",
        segments=[{"start": 0.0, "end": 1.0, "text": "Ship the report."}],
        duration=1.0,
        word_count=6,
    )
    summary = upsert_summary(
        db,
        meeting_id=meeting.id,
        executive_summary="Team discussed the Q3 report.",
        topics=[],
        decisions=[],
        action_items=[
            {"text": "Ship the report", "owner": None, "due_date": None, "status": None},
            {"text": "Follow up with legal", "owner": None, "due_date": None, "status": None},
        ],
        risks=[],
        open_questions=[],
        next_steps=[],
    )
    notes = create_meeting_notes(
        db,
        meeting_id=meeting.id,
        title=meeting.title,
        executive_summary=summary.executive_summary,
        discussion_topics=[],
        decisions=[],
        action_items=[
            {"text": "Ship the report", "owner": None, "due_date": None, "status": None},
        ],
        risks=[],
        open_questions=[],
        next_steps=[],
        timestamped_discussion=[],
    )
    return meeting, upload, summary, notes


def check_a_edit_persists_across_reload(db, meeting_id, owner_id) -> None:
    update_summary_action_item(
        db,
        meeting_id,
        owner_id,
        0,
        SummaryActionItemUpdate(status="in-progress", owner="Priya", due_date="2026-09-01"),
    )

    # A fresh read, mimicking a page reload / refetch rather than reusing
    # the in-memory object `update_summary_action_item` returned.
    reloaded = get_summary_by_meeting_id(db, meeting_id)
    item = reloaded.action_items[0]
    assert item["status"] == "in-progress", item
    assert item["owner"] == "Priya", item
    assert item["due_date"] == "2026-09-01", item
    assert item["text"] == "Ship the report", "text must be unchanged when not sent"
    print("OK A: status/owner/due_date edit persists across a fresh read")


def check_b_other_items_untouched(db, meeting_id) -> None:
    summary = get_summary_by_meeting_id(db, meeting_id)
    other = summary.action_items[1]
    assert other["text"] == "Follow up with legal"
    assert other["status"] is None
    assert other["owner"] is None
    print("OK B: editing item 0 left item 1 untouched")


def check_c_out_of_range_rejected(db, meeting_id, owner_id) -> None:
    try:
        update_summary_action_item(
            db, meeting_id, owner_id, 99, SummaryActionItemUpdate(status="completed")
        )
        raise AssertionError("expected out-of-range index to raise AppError")
    except AppError as exc:
        assert exc.status_code == 404, exc.status_code
    print("OK C: out-of-range index rejected (404), no item silently modified")


def check_d_unauthorized_rejected(db, meeting_id, other_user_id) -> None:
    try:
        update_summary_action_item(
            db, meeting_id, other_user_id, 0, SummaryActionItemUpdate(status="blocked")
        )
        raise AssertionError("expected non-owner update to raise AppError")
    except AppError as exc:
        assert exc.status_code == 404, exc.status_code

    # Confirm the rejected attempt made no change.
    summary = get_summary_by_meeting_id(db, meeting_id)
    assert summary.action_items[0]["status"] == "in-progress", (
        "unauthorized update must not have applied"
    )
    print("OK D: update from a non-owner user is rejected and made no change")


def check_e_regenerate_replaces_action_items(db, meeting_id) -> None:
    upsert_summary(
        db,
        meeting_id=meeting_id,
        executive_summary="Regenerated summary.",
        topics=[],
        decisions=[],
        action_items=[{"text": "Brand new item", "owner": None, "due_date": None, "status": None}],
        risks=[],
        open_questions=[],
        next_steps=[],
    )
    summary = get_summary_by_meeting_id(db, meeting_id)
    assert len(summary.action_items) == 1
    assert summary.action_items[0]["text"] == "Brand new item"
    assert summary.action_items[0]["status"] is None, (
        "regenerate is a full AI re-run; it must not carry a stale user edit onto new content"
    )
    print("OK E: regenerating the summary replaces action_items from fresh AI output, as designed")


def check_f_meeting_notes_unaffected(db, meeting_id) -> None:
    notes = db.query(MeetingNotes).filter(MeetingNotes.meeting_id == meeting_id).first()
    assert notes.action_items[0]["text"] == "Ship the report"
    assert notes.action_items[0]["status"] is None
    assert notes.action_items[0]["owner"] is None
    print("OK F: Meeting Notes action items are untouched by Summary action-item edits")


def check_g_invalid_status_rejected() -> None:
    try:
        SummaryActionItemUpdate(status="done")
        raise AssertionError("expected an unrecognized status value to be rejected")
    except ValidationError:
        pass
    print("OK G: an unrecognized status value is rejected by the schema, never silently accepted")


def cleanup(meeting_ids: list, upload_ids: list) -> None:
    db = SessionLocal()
    try:
        db.query(MeetingNotes).filter(MeetingNotes.meeting_id.in_(meeting_ids)).delete(
            synchronize_session=False
        )
        db.query(Summary).filter(Summary.meeting_id.in_(meeting_ids)).delete(synchronize_session=False)
        db.query(Transcript).filter(Transcript.meeting_id.in_(meeting_ids)).delete(
            synchronize_session=False
        )
        db.query(Upload).filter(Upload.id.in_(upload_ids)).delete(synchronize_session=False)
        db.query(Meeting).filter(Meeting.id.in_(meeting_ids)).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def main() -> int:
    db = SessionLocal()
    try:
        owner = _get_or_create_user(db, OWNER_EMAIL)
        other = _get_or_create_user(db, OTHER_EMAIL)
        meeting, upload, _summary, _notes = _seed(db, owner)
        meeting_id, upload_id, owner_id, other_id = meeting.id, upload.id, owner.id, other.id
    finally:
        db.close()

    try:
        db = SessionLocal()
        try:
            check_a_edit_persists_across_reload(db, meeting_id, owner_id)
            check_b_other_items_untouched(db, meeting_id)
            check_c_out_of_range_rejected(db, meeting_id, owner_id)
            check_d_unauthorized_rejected(db, meeting_id, other_id)
            check_e_regenerate_replaces_action_items(db, meeting_id)
            check_f_meeting_notes_unaffected(db, meeting_id)
            check_g_invalid_status_rejected()
        finally:
            db.close()
    except AssertionError as exc:
        print(f"FAILED: {exc}")
        cleanup([meeting_id], [upload_id])
        return 1
    except Exception as exc:  # noqa: BLE001
        print(f"FAILED: unexpected error: {exc}")
        cleanup([meeting_id], [upload_id])
        return 1

    cleanup([meeting_id], [upload_id])
    print("ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
