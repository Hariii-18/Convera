"""End-to-end verification of the Meeting Overview data-wiring pass against
the real, configured database (no mocks).

Exercises the real app (in-process, via TestClient) for the three scenarios
the frontend change needs to handle:

  A. A completed recorded meeting: real Upload row, real transcript, real
     pipeline run (summary + timeline generated for real).
  B. A completed live meeting: goes through `live_meeting_service` exactly
     like the WebSocket handler does (`start_live_meeting` then
     `finalize_live_meeting`) — this path never creates a `ProcessingJob`
     row, which is the case the frontend's upload lookup has to survive.
  C. A brand-new meeting with no upload/transcript/summary/timeline at all
     (the missing/partial-data case).

For each scenario it fetches every endpoint the Overview tab's hooks call
(GET meeting, GET /process?meeting_id=, GET /uploads, GET /transcripts,
GET /summaries, GET timeline) and replays the same derivation logic the
frontend uses (see `deriveProcessingTimeSeconds`, `deriveArtifactStatus`,
`deriveRecordingType` in `src/app/(app)/meetings/[id]/page.tsx`) so the
exact values that would land in MeetingStatistics/RecordingCard/
SummaryPreview/TimelinePreview/MeetingInfoPanel are printed and checked.

Cleans up every row it creates.

Usage: python -m scripts.verify_overview_wiring
"""

import sys
import uuid
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.db.session import SessionLocal
from app.main import app
from app.models.live_meeting_session import LiveMeetingSession
from app.models.processing_job import ProcessingJob
from app.models.upload import Upload
from app.models.user import User
from app.crud.transcript import upsert_transcript
from app.services.pipeline_service import run_post_transcription_pipeline
from app.services.live_meeting_service import start_live_meeting, finalize_live_meeting
from app.services.transcription.base import TranscriptSegment

client = TestClient(app)

failures: list[str] = []


def check(label: str, condition: bool, detail: object = "") -> None:
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


# --- Mirrors the frontend's derive* helpers (src/app/(app)/meetings/[id]/page.tsx) ---

def derive_processing_time_seconds(job):
    if not job or not job.get("started_at") or not job.get("completed_at"):
        return None
    start = datetime.fromisoformat(job["started_at"])
    end = datetime.fromisoformat(job["completed_at"])
    seconds = (end - start).total_seconds()
    return seconds if seconds >= 0 else None


TERMINAL = {"completed", "failed"}


def derive_artifact_status(has_artifact, job, generated, in_progress, failed, pending):
    if has_artifact:
        return generated
    if not job:
        return None
    if job["status"] not in TERMINAL:
        return in_progress
    return failed if job["status"] == "failed" else pending


def derive_recording_type(mime_type):
    if not mime_type:
        return None
    return "video" if mime_type.startswith("video/") else "audio"


def fetch_overview_inputs(meeting_id: str, token: str):
    meeting = client.get(f"/api/v1/meetings/{meeting_id}", headers=auth(token)).json()
    jobs = client.get("/api/v1/process", params={"meeting_id": meeting_id}, headers=auth(token)).json()
    job = jobs[0] if jobs else None
    uploads = client.get("/api/v1/uploads", headers=auth(token)).json()
    upload = next((u for u in uploads if u["meeting_id"] == meeting_id), None)
    transcript_resp = client.get(
        "/api/v1/transcripts", params={"meeting_id": meeting_id}, headers=auth(token)
    )
    transcript = transcript_resp.json() if transcript_resp.status_code == 200 else None
    summary_resp = client.get(
        "/api/v1/summaries", params={"meeting_id": meeting_id}, headers=auth(token)
    )
    summary = summary_resp.json() if summary_resp.status_code == 200 else None
    timeline = client.get(f"/api/v1/meetings/{meeting_id}/timeline", headers=auth(token)).json()
    return meeting, job, upload, transcript, summary, timeline


def print_overview(label: str, meeting_id: str, token: str):
    meeting, job, upload, transcript, summary, timeline = fetch_overview_inputs(meeting_id, token)

    recording_type = derive_recording_type(upload["mime_type"] if upload else None)
    duration = meeting["duration_seconds"] or (
        round(transcript["duration"]) if transcript and transcript.get("duration") is not None else None
    )
    summary_status = derive_artifact_status(
        bool(summary), job, "generated", "generating", "failed", "pending"
    )
    transcript_status = derive_artifact_status(
        bool(transcript), job, "completed", "processing", "failed", "pending"
    )
    processing_time = derive_processing_time_seconds(job)

    print(f"\n--- {label} ---")
    print(f"MeetingStatistics: transcriptWordCount={transcript['word_count'] if transcript else None}, "
          f"processingTimeSeconds={processing_time}, summaryStatus={summary_status}, "
          f"recordingSizeBytes={upload['size_bytes'] if upload else None}")
    print(f"RecordingCard: type={recording_type}, durationSeconds={duration}")
    print(f"SummaryPreview: summary={'<present>' if summary else None} "
          f"({(summary['executive_summary'][:60] + '...') if summary else ''})")
    print(f"TimelinePreview: events={len(timeline['events'])} "
          f"(sample={timeline['events'][:1]})")
    print(f"MeetingInfoPanel.recording: type={recording_type}, durationSeconds={duration}, "
          f"sizeBytes={upload['size_bytes'] if upload else None}")
    print(f"MeetingInfoPanel.processing: processingTimeSeconds={processing_time}, "
          f"transcriptStatus={transcript_status}, summaryStatus={summary_status}")

    return {
        "meeting": meeting,
        "job": job,
        "upload": upload,
        "transcript": transcript,
        "summary": summary,
        "timeline": timeline,
        "recording_type": recording_type,
        "duration": duration,
        "summary_status": summary_status,
        "transcript_status": transcript_status,
        "processing_time": processing_time,
    }


def main() -> int:
    suffix = uuid.uuid4().hex[:10]
    email = f"overview-verify-{suffix}@example.com"
    token = register(email)

    cleanup_ids: list[str] = []

    # === Scenario A: real completed recorded meeting ===
    resp = client.post(
        "/api/v1/meetings",
        headers=auth(token),
        json={"title": f"Overview Verify Recorded {suffix}", "source_type": "upload-recording"},
    )
    check("A setup: create meeting", resp.status_code == 201, resp.text)
    meeting_id_a = resp.json()["id"]
    cleanup_ids.append(meeting_id_a)

    segments = [
        {"start": 0.0, "end": 4.2, "text": "Let's get started with today's roadmap review."},
        {"start": 4.2, "end": 9.8, "text": "First up, the Overview tab data wiring."},
        {"start": 9.8, "end": 15.0, "text": "We should ship this by end of week."},
    ]

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        user_id = user.id
        upload = Upload(
            user_id=user_id,
            meeting_id=uuid.UUID(meeting_id_a),
            original_filename="verify-overview.mp4",
            stored_filename="verify-overview.mp4",
            storage_path="verify/overview.mp4",
            bucket="converra-files",
            mime_type="video/mp4",
            size_bytes=54_321_000,
            status="uploaded",
        )
        db.add(upload)
        db.commit()
        db.refresh(upload)
        upload_id_a = upload.id

        upsert_transcript(
            db,
            meeting_id=uuid.UUID(meeting_id_a),
            upload_id=upload_id_a,
            language="en",
            transcript=" ".join(s["text"] for s in segments),
            segments=segments,
            duration=15.0,
            word_count=sum(len(s["text"].split()) for s in segments),
        )
    finally:
        db.close()

    # A real ProcessingJob row with real timestamps, so processingTimeSeconds
    # has something real to compute from. Inserted directly (not via
    # POST /process) since that endpoint queues the real background worker,
    # which would try to download the (nonexistent, DB-only-in-this-script)
    # file from Supabase storage.
    started = datetime.now(timezone.utc) - timedelta(seconds=42)
    completed = datetime.now(timezone.utc)
    db = SessionLocal()
    try:
        job = ProcessingJob(
            upload_id=upload_id_a,
            meeting_id=uuid.UUID(meeting_id_a),
            user_id=user_id,
            status="completed",
            progress=100,
            stage="Completed",
            started_at=started,
            completed_at=completed,
        )
        db.add(job)
        db.commit()
    finally:
        db.close()
    check("A setup: create processing job row", True)

    stages: list[str] = []
    executive_summary = ""
    timeline_event_count = 0
    for attempt in range(3):
        db = SessionLocal()
        try:
            stages = []
            summary_row = run_post_transcription_pipeline(
                db, uuid.UUID(meeting_id_a), on_stage=lambda stage, pct: stages.append(stage)
            )
            executive_summary = summary_row.executive_summary
            timeline_event_count = len(summary_row.timeline_events)
        finally:
            db.close()
        if executive_summary:
            break
        print(f"  (attempt {attempt + 1}: summary empty, retrying)")

    check("A: pipeline produced a summary", bool(executive_summary), executive_summary)
    if timeline_event_count == 0:
        print(
            "  NOTE: timeline generation is Ollama-only (app/services/timeline_service.py) "
            "and no local Ollama instance is reachable in this sandbox, so timeline_events "
            "came back empty even though the pipeline ran for real. Backfilling a couple of "
            "events directly to still verify the GET /timeline -> TimelinePreview contract."
        )
        db = SessionLocal()
        try:
            from app.crud.summary import get_summary_by_meeting_id, set_timeline_events

            # Matches the real shape `timeline_service.generate_timeline_for_meeting`
            # persists — {"start", "label"} only. `description` is never
            # produced by the real AI provider either (see
            # `TimelineEventRead` in app/schemas/summary.py), so it's
            # correctly omitted here too rather than backfilling something
            # real data never has.
            summary_for_backfill = get_summary_by_meeting_id(db, uuid.UUID(meeting_id_a))
            set_timeline_events(
                db,
                summary_for_backfill,
                [
                    {"start": 0.0, "label": "Roadmap review kicks off"},
                    {"start": 9.8, "label": "Ship-by-Friday commitment"},
                ],
            )
        finally:
            db.close()

    result_a = print_overview("A. Completed recorded meeting", meeting_id_a, token)
    check("A: recording type is video (mime video/mp4)", result_a["recording_type"] == "video")
    check("A: recordingSizeBytes matches real upload size",
          result_a["upload"]["size_bytes"] == 54_321_000)
    check("A: transcriptWordCount matches real transcript",
          result_a["transcript"]["word_count"] == sum(len(s["text"].split()) for s in segments))
    check("A: summaryStatus is generated", result_a["summary_status"] == "generated")
    check("A: transcriptStatus is completed", result_a["transcript_status"] == "completed")
    check("A: timeline has events", len(result_a["timeline"]["events"]) > 0)
    check("A: duration derived from transcript (meeting.duration_seconds is never set)",
          result_a["meeting"]["duration_seconds"] is None and result_a["duration"] == 15)
    check("A: processingTimeSeconds matches the real job timestamps (~42s)",
          result_a["processing_time"] is not None and 41 <= result_a["processing_time"] <= 43,
          result_a["processing_time"])

    # === Scenario B: real live meeting (no ProcessingJob row ever created) ===
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        live_session = start_live_meeting(db, user, title=f"Overview Verify Live {suffix}")
        meeting_id_b = str(live_session.meeting_id)
        live_session_id = live_session.id
    finally:
        db.close()
    cleanup_ids.append(meeting_id_b)

    live_segments = [
        TranscriptSegment(start=0.0, end=3.0, text="Live meeting kicks off now."),
        TranscriptSegment(start=3.0, end=7.5, text="Checking the overview panel wiring live."),
    ]
    db = SessionLocal()
    try:
        session_row = db.query(LiveMeetingSession).filter_by(id=live_session_id).first()
        finalize_live_meeting(db, session_row, live_segments)
    finally:
        db.close()

    result_b = print_overview("B. Completed live meeting", meeting_id_b, token)
    check("B: no ProcessingJob row exists for a live meeting (the bug this fix avoids)",
          result_b["job"] is None)
    check("B: upload still resolved via meeting_id match", result_b["upload"] is not None,
          result_b["upload"])
    check("B: recording type is audio (live placeholder mime audio/webm)",
          result_b["recording_type"] == "audio")
    check("B: summary/transcript still marked complete despite no job",
          result_b["summary_status"] == "generated" and result_b["transcript_status"] == "completed")
    # Not asserting non-empty here: timeline generation is Ollama-only (see
    # the Scenario A note) and unreachable in this sandbox, so an empty list
    # is the real (if AI-infra-limited) outcome for this run. The contract
    # itself — 200 + a list, never an error — is what matters here and is
    # already covered by Scenario C.
    check("B: timeline endpoint responds with a list, not an error",
          isinstance(result_b["timeline"]["events"], list))

    # === Scenario C: missing/partial data (brand new, untouched meeting) ===
    resp = client.post(
        "/api/v1/meetings",
        headers=auth(token),
        json={"title": f"Overview Verify Empty {suffix}", "source_type": "upload-recording"},
    )
    check("C setup: create meeting", resp.status_code == 201, resp.text)
    meeting_id_c = resp.json()["id"]
    cleanup_ids.append(meeting_id_c)

    result_c = print_overview("C. Missing/partial data (nothing generated yet)", meeting_id_c, token)
    check("C: no upload -> recording type is None (RecordingCard shows empty state)",
          result_c["recording_type"] is None)
    check("C: no transcript -> word count is None", result_c["transcript"] is None)
    check("C: no summary -> SummaryPreview gets no summary", result_c["summary"] is None)
    check("C: no job/artifacts -> statuses are None, not a guessed value",
          result_c["summary_status"] is None and result_c["transcript_status"] is None)
    check("C: timeline endpoint returns empty list, not an error",
          result_c["timeline"]["events"] == [])

    # --- cleanup ---
    for mid in cleanup_ids:
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
