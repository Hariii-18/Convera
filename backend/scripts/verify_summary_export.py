"""Verify the Summary tab's Export action end-to-end.

Exercises the real DB (no mocking of the DB layer) using a throwaway
user/meeting/summary, cleaned up at the end regardless of outcome.

Checks:

  A. PDF/DOCX/PPTX downloads each produce a non-empty file with the correct
     signature, sourced from the `Summary` row alone - no Transcript or
     MeetingNotes row exists for this meeting at all.
  B. The shared content model includes only the seven Summary sections (no
     Detailed Discussion, no Full Transcript), carries no transcript
     disclaimer, and labels itself "Summary" (not "Meeting Notes") for the
     PPTX title slide.
  C. A second user cannot export the first user's meeting (404).
  D. A meeting with no Summary yet 404s instead of fabricating content.
  E. An unsupported format is rejected with 400.

Usage: python -m scripts.verify_summary_export
"""

import sys
import uuid

from app.core.exceptions import AppError
from app.crud.meeting import create_meeting
from app.crud.summary import upsert_summary
from app.db.session import SessionLocal
from app.models.meeting import Meeting
from app.models.summary import Summary
from app.models.user import User
from app.schemas.meeting import MeetingCreate
from app.services.export.export_service import export_summary

PRIMARY_EMAIL = "verify-summary-export@convera.test"
OTHER_EMAIL = "verify-summary-export-other@convera.test"

_FILE_SIGNATURES = {
    "pdf": b"%PDF",
    "docx": b"PK",
    "pptx": b"PK",
}


def _get_or_create_user(db, email: str) -> User:
    user = db.query(User).filter(User.email == email).first()
    if user is not None:
        return user
    user = User(email=email, full_name="Summary Export Verify", hashed_password="not-a-real-hash", is_active=True)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_meeting(db, user: User) -> Meeting:
    return create_meeting(
        db, user_id=user.id,
        meeting_in=MeetingCreate(title="summary-export-verify", source_type="upload-recording"),
    )


def check_a_downloads(db, meeting_id, user_id) -> None:
    for fmt in ("pdf", "docx", "pptx"):
        content, filename, content_type = export_summary(db, meeting_id, user_id, fmt)
        assert len(content) > 0, f"{fmt} export must not be empty"
        assert content.startswith(_FILE_SIGNATURES[fmt]), f"{fmt} export has the wrong file signature"
        assert filename.endswith(f".{fmt}")
        assert "summary" in filename
        assert content_type
        print(f"OK A ({fmt}): produced a valid {len(content)}-byte file ({filename})")


def check_b_content_model(db, meeting_id, user_id) -> None:
    from app.crud.summary import get_summary_by_meeting_id
    from app.schemas.summary import SummaryRead
    from app.services.export.content import build_summary_export_document

    summary = get_summary_by_meeting_id(db, meeting_id)
    document = build_summary_export_document(
        SummaryRead.model_validate(summary), "summary-export-verify", "2026-08-26 10:00:00 IST", 120, 3
    )
    headings = [section.heading for section in document.sections]
    assert "Full Transcript" not in headings, "Summary export must never include the full transcript"
    assert "Detailed Discussion" not in headings, "Summary export must never include timestamped discussion"
    assert "Executive Summary" in headings
    assert any(h.startswith("Action Items") for h in headings)
    assert document.disclaimer == "", "Summary export has no transcript, so no transcript disclaimer"
    assert document.kind_label == "Summary"
    print("OK B: content model carries only Summary sections, no disclaimer, labeled 'Summary'")


def check_c_unauthorized_rejected(db, meeting_id, other_user_id) -> None:
    try:
        export_summary(db, meeting_id, other_user_id, "pdf")
        raise AssertionError("unauthorized export must be rejected")
    except AppError as exc:
        assert exc.status_code == 404, f"unauthorized export should 404, got {exc.status_code}"
    print("OK C: unauthorized export is rejected (404)")


def check_d_no_summary_yet(db, user_id) -> None:
    meeting = create_meeting(
        db, user_id=user_id,
        meeting_in=MeetingCreate(title="summary-export-verify-empty", source_type="upload-recording"),
    )
    try:
        export_summary(db, meeting.id, user_id, "pdf")
        raise AssertionError("export must 404 when the meeting has no Summary yet")
    except AppError as exc:
        assert exc.status_code == 404, f"expected 404, got {exc.status_code}"
    print("OK D: a meeting with no Summary yet 404s instead of fabricating content")
    return meeting.id


def check_e_bad_format_rejected(db, meeting_id, user_id) -> None:
    try:
        export_summary(db, meeting_id, user_id, "csv")
        raise AssertionError("unsupported format must be rejected")
    except AppError as exc:
        assert exc.status_code == 400, f"expected 400, got {exc.status_code}"
    print("OK E: an unsupported export format is rejected (400)")


def cleanup(meeting_ids: list) -> None:
    db = SessionLocal()
    try:
        db.query(Summary).filter(Summary.meeting_id.in_(meeting_ids)).delete(synchronize_session=False)
        db.query(Meeting).filter(Meeting.id.in_(meeting_ids)).delete(synchronize_session=False)
        db.commit()
    finally:
        db.close()


def main() -> int:
    db = SessionLocal()
    try:
        user = _get_or_create_user(db, PRIMARY_EMAIL)
        other_user = _get_or_create_user(db, OTHER_EMAIL)
        meeting = _make_meeting(db, user)
        meeting_id, user_id, other_user_id = meeting.id, user.id, other_user.id
        upsert_summary(
            db,
            meeting_id=meeting_id,
            executive_summary="A concise summary of the verification meeting.",
            topics=[{"title": "Roadmap", "description": "Discussed Q3 priorities."}],
            decisions=[{"text": "Ship the export feature."}],
            action_items=[{"text": "Write docs", "owner": "Alice", "due_date": "2026-09-01", "status": None}],
            risks=[{"text": "Tight timeline."}],
            open_questions=[{"text": "Who owns rollout?"}],
            next_steps=[{"text": "Schedule follow-up."}],
        )
    finally:
        db.close()

    meeting_ids = [meeting_id]
    try:
        db = SessionLocal()
        try:
            check_a_downloads(db, meeting_id, user_id)
            check_b_content_model(db, meeting_id, user_id)
            check_c_unauthorized_rejected(db, meeting_id, other_user_id)
            empty_meeting_id = check_d_no_summary_yet(db, user_id)
            meeting_ids.append(empty_meeting_id)
            check_e_bad_format_rejected(db, meeting_id, user_id)
        finally:
            db.close()
    except AssertionError as exc:
        print(f"FAILED: {exc}")
        cleanup(meeting_ids)
        return 1
    except Exception as exc:  # noqa: BLE001
        print(f"FAILED: unexpected error: {exc}")
        cleanup(meeting_ids)
        return 1

    cleanup(meeting_ids)
    print("ALL CHECKS PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(main())
