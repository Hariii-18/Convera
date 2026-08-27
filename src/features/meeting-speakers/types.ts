/**
 * API-shaped types (snake_case, matches the FastAPI response body) for the
 * meeting-speakers feature.
 *
 * Mirrors `MeetingSpeakerRead`/`MeetingSpeakerCreate`/`MeetingSpeakerUpdate`
 * in `backend/app/schemas/meeting_speaker.py`.
 */

export type MeetingSpeakerResponse = {
  id: string;
  meeting_id: string;
  speaker_key: string;
  display_name: string;
  role: string | null;
  company: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

/** Body for `POST /meeting-speakers`. Every field is optional — the backend
 * assigns the next `speaker_key` and defaults `display_name` to `Speaker N`
 * when not supplied. */
export type MeetingSpeakerCreateRequest = {
  display_name?: string;
  role?: string | null;
  company?: string | null;
  notes?: string | null;
};

/** Body for `PATCH /meeting-speakers/{id}` — every field optional, only
 * supplied ones change. */
export type MeetingSpeakerUpdateRequest = {
  display_name?: string;
  role?: string | null;
  company?: string | null;
  notes?: string | null;
};
