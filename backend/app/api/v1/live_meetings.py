import asyncio
import json
import logging
import uuid

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_ws_user
from app.crud.live_meeting_session import get_live_session
from app.db.session import get_db
from app.models.user import User
from app.schemas.live_meeting import (
    LiveMeetingSessionRead,
    LiveMeetingStartRequest,
)
from app.services.live_audio_transport import AudioChunk, LiveAudioBuffer
from app.services.live_meeting_service import (
    build_session_read,
    fail_live_meeting,
    finalize_live_meeting,
    get_live_session_read,
    get_owned_live_session,
    retry_live_meeting,
    start_live_meeting,
    stop_live_meeting,
)
from app.services.live_transcription_pipeline import LiveTranscriptionPipeline

logger = logging.getLogger("converra")

router = APIRouter(prefix="/live-meetings", tags=["live-meetings"])

# WebSocket close codes in the 4000-4999 (application-reserved) range, used
# to reject a connection before `accept()` — the client's `onclose` handler
# can branch on these the same way it would branch on an HTTP status code.
WS_UNAUTHORIZED = 4401
WS_SESSION_NOT_FOUND = 4404
WS_SESSION_NOT_LIVE = 4409


@router.post("/start", response_model=LiveMeetingSessionRead, status_code=status.HTTP_201_CREATED)
def start(
    body: LiveMeetingStartRequest | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LiveMeetingSessionRead:
    session = start_live_meeting(db, current_user, title=body.title if body else None)
    return build_session_read(db, session)


@router.get("/{meeting_id}", response_model=LiveMeetingSessionRead)
def get(
    meeting_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LiveMeetingSessionRead:
    return get_live_session_read(db, meeting_id, current_user)


@router.post("/{meeting_id}/stop", response_model=LiveMeetingSessionRead)
def stop(
    meeting_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LiveMeetingSessionRead:
    session = get_owned_live_session(db, meeting_id, current_user)
    session = stop_live_meeting(db, session)
    return build_session_read(db, session)


@router.post("/{meeting_id}/retry", response_model=LiveMeetingSessionRead)
def retry(
    meeting_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LiveMeetingSessionRead:
    """Retries a failed finalization (Phase 6): resumes the shared
    normalize/summary pipeline against the transcript already saved when the
    session first stopped. Never re-transcribes -- live audio isn't kept
    around to re-transcribe from.
    """
    session = get_owned_live_session(db, meeting_id, current_user)
    session = retry_live_meeting(db, session)
    return build_session_read(db, session)


@router.websocket("/{meeting_id}/stream")
async def stream(
    websocket: WebSocket,
    meeting_id: uuid.UUID,
    db: Session = Depends(get_db),
) -> None:
    """Phase 4 live audio transport + Phase 5 live transcription.

    Minimal explicit protocol, one message pair per audio chunk:

    Client -> server (JSON text unless noted):
        {"type": "start"}                                            once, first
        {"type": "chunk", "sequence": int, "timestampMs": number,
         "mimeType": str}          followed immediately by one BINARY frame
                                    carrying that chunk's raw audio bytes
        {"type": "stop"}                                             once, last

    Server -> client (JSON text):
        {"type": "ready"}                     once, after "start" is accepted
        {"type": "ack", "sequence": int}      once per accepted/duplicate chunk
        {"type": "error", "message": str}     chunk rejected; socket stays open
        {"type": "stopping"}                  once, after "stop"; socket closes next
        {"type": "transcription_ready"}       once, after the Whisper worker loads
        {"type": "transcript", "sequence",
         "start", "end", "text"}              one per newly committed transcript segment
        {"type": "transcription_error",
         "message": str}                      transcription-specific failure; socket stays open

    Every outgoing message (audio-transport and transcription alike) is
    funneled through one `send_queue` drained by a single sender task, so
    concurrent writers (the receive loop's ACKs/errors and the transcription
    pipeline's async transcript emission) never interleave writes on the same
    WebSocket and message order is preserved.

    Auth reuses the existing JWT (see `get_ws_user` — browsers can't set a
    WebSocket handshake header, so the token travels as `?token=` instead of
    `Authorization`). Ownership and session-state checks happen *before*
    `accept()` so an unauthorized/invalid request is rejected at the
    handshake rather than allowed to connect and then dropped.
    """
    token = websocket.query_params.get("token")
    user = get_ws_user(db, token)
    if user is None:
        await websocket.close(code=WS_UNAUTHORIZED, reason="Unauthorized")
        return

    session = get_live_session(db, meeting_id, user.id)
    if session is None:
        await websocket.close(code=WS_SESSION_NOT_FOUND, reason="Live session not found")
        return

    if session.state != "live":
        await websocket.close(
            code=WS_SESSION_NOT_LIVE,
            reason=f"Live session is '{session.state}', not accepting audio",
        )
        return

    await websocket.accept()
    logger.info(
        "live-audio ws connected meeting_id=%s user_id=%s session_id=%s",
        meeting_id, user.id, session.id,
    )

    buffer = LiveAudioBuffer()
    # Bounded so a stalled/slow client can't make this grow without limit --
    # transcript/ack messages should drain quickly under normal conditions;
    # hitting the cap means the socket is effectively stuck.
    send_queue: asyncio.Queue[dict | None] = asyncio.Queue(maxsize=1000)

    async def send(msg: dict) -> None:
        try:
            send_queue.put_nowait(msg)
        except asyncio.QueueFull:
            logger.warning(
                "live-audio send queue overloaded meeting_id=%s; dropping message type=%s",
                meeting_id, msg.get("type"),
            )

    sender_task = asyncio.create_task(_sender_loop(websocket, send_queue))

    failed_reported = False

    async def on_fatal_error(message: str) -> None:
        nonlocal failed_reported
        if failed_reported:
            return
        failed_reported = True
        try:
            fail_live_meeting(db, session, error_message=message)
        except Exception:
            logger.exception(
                "failed to transition live session to failed meeting_id=%s", meeting_id
            )

    pipeline = LiveTranscriptionPipeline(send=send, on_fatal_error=on_fatal_error)
    pipeline.start()

    # "awaiting" tracks what the *next* client message must be, driving a
    # tiny explicit state machine instead of guessing intent from message
    # shape alone.
    awaiting: str = "start"  # "start" -> "metadata" <-> "binary"
    pending_envelope: dict | None = None
    # The ASGI connection is already gone once we see "websocket.disconnect"
    # (or WebSocketDisconnect) — calling `websocket.close()` again after that
    # raises, so this flag tells the code after the loop to skip it.
    client_disconnected = False

    try:
        try:
            while True:
                message = await websocket.receive()
                if message["type"] == "websocket.disconnect":
                    client_disconnected = True
                    break

                text = message.get("text")
                raw_bytes = message.get("bytes")

                if text is not None:
                    try:
                        envelope = json.loads(text)
                    except (ValueError, TypeError):
                        await send({"type": "error", "message": "invalid JSON"})
                        continue

                    msg_type = envelope.get("type") if isinstance(envelope, dict) else None

                    if awaiting == "start":
                        if msg_type != "start":
                            await send(
                                {"type": "error", "message": "expected {'type': 'start'} first"}
                            )
                            continue
                        awaiting = "metadata"
                        await send({"type": "ready"})
                        logger.info("live-audio ws ready meeting_id=%s", meeting_id)
                        continue

                    if awaiting == "binary":
                        # A text frame arrived where the paired binary payload
                        # was expected — the client skipped sending it.
                        await send(
                            {"type": "error", "message": "expected binary audio frame after chunk metadata"}
                        )
                        pending_envelope = None
                        awaiting = "metadata"
                        # fall through: re-classify this text frame as the next metadata message

                    if msg_type == "stop":
                        logger.info("live-audio ws stop received meeting_id=%s", meeting_id)
                        await send({"type": "stopping"})
                        break

                    if msg_type != "chunk":
                        await send(
                            {"type": "error", "message": f"unknown message type {msg_type!r}"}
                        )
                        continue

                    pending_envelope = envelope
                    awaiting = "binary"
                    continue

                if raw_bytes is not None:
                    if awaiting != "binary" or pending_envelope is None:
                        await send(
                            {"type": "error", "message": "unexpected binary frame without chunk metadata"}
                        )
                        continue

                    await _handle_chunk(send, buffer, pipeline, pending_envelope, raw_bytes, meeting_id)
                    pending_envelope = None
                    awaiting = "metadata"

        except WebSocketDisconnect as exc:
            logger.info(
                "live-audio ws disconnected meeting_id=%s user_id=%s code=%s buffered_chunks=%d",
                meeting_id, user.id, exc.code, len(buffer.chunks),
            )
            # Unexpected client drop, not a clean {"type": "stop"}: still
            # finalize below (in `finally`) with whatever was transcribed so
            # far, rather than leaving the session stuck in "live" forever.
            return
        except Exception:
            logger.exception("live-audio ws error meeting_id=%s", meeting_id)
            return

        logger.info(
            "live-audio ws closing meeting_id=%s user_id=%s buffered_chunks=%d",
            meeting_id, user.id, len(buffer.chunks),
        )
    finally:
        # Whatever path got us here (clean stop, disconnect, unhandled
        # exception) the live-transcription worker must not outlive this
        # connection (item 12) -- terminate it before the sender task is
        # torn down, since `pipeline.stop()` may still enqueue its own
        # final messages (drained output, `transcription_error`).
        await pipeline.stop()
        await send_queue.put(None)
        try:
            await sender_task
        except Exception:
            logger.exception("live-audio ws sender task ended with an error meeting_id=%s", meeting_id)

        # Phase 6: finalize regardless of how we got here -- persist the
        # merged transcript this pipeline committed and run the shared
        # normalize/summary pipeline, so the session never gets stuck in
        # "live"/"stopping". Idempotent (a fatal-error path above may have
        # already failed the session; a session already terminal is a
        # no-op) and best-effort here -- a failure only logs, it must never
        # prevent the WebSocket itself from closing cleanly below.
        #
        # `finalize_live_meeting` is synchronous (DB writes, normalization,
        # and an OpenAI summary call) -- run it in a worker thread so it
        # can't block this event loop and stall every other connection's
        # audio/ack traffic for the duration (mirrors the `asyncio.to_thread`
        # pattern already used for transcription in `live_worker.py`).
        try:
            await asyncio.to_thread(
                finalize_live_meeting, db, session, pipeline.get_transcript_segments()
            )
        except Exception:
            logger.exception("live-audio ws finalization failed meeting_id=%s", meeting_id)

    if not client_disconnected:
        try:
            await websocket.close(code=1000)
        except Exception:
            # The client can still tear down the connection in the gap
            # between our last receive() and this close() — not an error
            # worth surfacing, the session state is untouched either way.
            logger.info("live-audio ws close raced with client disconnect meeting_id=%s", meeting_id)


async def _sender_loop(websocket: WebSocket, send_queue: asyncio.Queue[dict | None]) -> None:
    """Single writer for this WebSocket connection. Every outgoing message —
    Phase 4's acks/errors and Phase 5's transcription events alike — goes
    through this one task so concurrent producers never interleave frames.
    """
    while True:
        msg = await send_queue.get()
        if msg is None:
            return
        try:
            await websocket.send_json(msg)
        except Exception:
            # The socket is going away (client disconnected, etc.) -- draining
            # the rest of the queue would just repeat this, and the caller is
            # already tearing the connection down.
            return


async def _handle_chunk(
    send,
    buffer: LiveAudioBuffer,
    pipeline: LiveTranscriptionPipeline,
    envelope: dict,
    payload: bytes,
    meeting_id: uuid.UUID,
) -> None:
    sequence = envelope.get("sequence")
    timestamp_ms = envelope.get("timestampMs")
    mime_type = envelope.get("mimeType")

    outcome = buffer.classify(sequence, mime_type)

    if outcome.kind == "invalid_sequence":
        await send({"type": "error", "message": outcome.detail})
        return

    if outcome.kind == "unsupported_mime":
        await send({"type": "error", "message": outcome.detail})
        logger.warning(
            "live-audio ws rejected unsupported mime meeting_id=%s mime=%r", meeting_id, mime_type
        )
        return

    if outcome.kind == "duplicate":
        await send({"type": "ack", "sequence": sequence})
        logger.info("live-audio ws duplicate chunk meeting_id=%s sequence=%s", meeting_id, sequence)
        return

    if outcome.kind == "out_of_order":
        await send({"type": "error", "message": outcome.detail})
        logger.warning(
            "live-audio ws out-of-order chunk meeting_id=%s detail=%s", meeting_id, outcome.detail
        )
        return

    buffer.accept(
        AudioChunk(
            sequence=sequence,
            timestamp_ms=float(timestamp_ms) if isinstance(timestamp_ms, (int, float)) else 0.0,
            mime_type=mime_type,
            data=payload,
        )
    )
    await send({"type": "ack", "sequence": sequence})
    logger.info(
        "live-audio ws chunk accepted meeting_id=%s sequence=%s bytes=%d",
        meeting_id, sequence, len(payload),
    )

    await pipeline.submit_chunk(payload)
