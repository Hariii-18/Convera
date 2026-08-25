import axios from "axios";

import { apiClient } from "@/lib/api-client";
import type {
  MeetingNotesEmailRequest,
  MeetingNotesEmailResponse,
  MeetingNotesExportFormat,
  MeetingNotesResponse,
  MeetingNotesUpdateRequest,
} from "@/features/meeting-notes/types";

const FILENAME_PATTERN = /filename="?([^";]+)"?/i;

/** Recovers the filename the backend chose (`Content-Disposition`) so the
 * browser save dialog doesn't fall back to a generic name. Requires the
 * backend to expose the header via CORS (see `main.py`'s `expose_headers`).
 */
function filenameFromContentDisposition(
  contentDisposition: string | undefined,
  fallback: string,
): string {
  const match = contentDisposition?.match(FILENAME_PATTERN);
  return match?.[1] ?? fallback;
}

export const meetingNotesApi = {
  /**
   * Returns `null` when meeting notes aren't ready yet (404 — the meeting
   * has no transcript and/or summary yet) rather than throwing. Meeting
   * Notes is a persisted record composed from those two once they're both
   * available; that's an expected "not yet" state, not a failure.
   */
  async getByMeeting(meetingId: string): Promise<MeetingNotesResponse | null> {
    try {
      const { data } = await apiClient.get<MeetingNotesResponse>("/meeting-notes", {
        params: { meeting_id: meetingId },
      });
      return data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  /** Partial update — only the fields present in `payload` are changed. */
  async update(
    meetingId: string,
    payload: MeetingNotesUpdateRequest,
  ): Promise<MeetingNotesResponse> {
    const { data } = await apiClient.patch<MeetingNotesResponse>("/meeting-notes", payload, {
      params: { meeting_id: meetingId },
    });
    return data;
  },

  /** Downloads the current saved Meeting Notes rendered to `format`. Returns
   * the file as a `Blob` plus the filename the backend generated, so the
   * caller can trigger a browser save without hardcoding a name.
   */
  async downloadExport(
    meetingId: string,
    format: MeetingNotesExportFormat,
  ): Promise<{ blob: Blob; filename: string }> {
    const response = await apiClient.get(`/meeting-notes/${meetingId}/export`, {
      params: { format },
      responseType: "blob",
    });
    const filename = filenameFromContentDisposition(
      response.headers["content-disposition"] as string | undefined,
      `converra-meeting-notes.${format}`,
    );
    return { blob: response.data as Blob, filename };
  },

  /** Renders the current saved Meeting Notes to `format` and emails it to
   * every resolved recipient in one request: the authenticated user (when
   * `sendToMe`) plus `recipients`. The backend merges, validates, and
   * deduplicates the final list — this never lets the caller impersonate a
   * different authenticated user.
   */
  async sendEmail(
    meetingId: string,
    payload: { format: MeetingNotesExportFormat; sendToMe: boolean; recipients: string[] },
  ): Promise<MeetingNotesEmailResponse> {
    const body: MeetingNotesEmailRequest = {
      format: payload.format,
      send_to_me: payload.sendToMe,
      recipients: payload.recipients,
    };
    const { data } = await apiClient.post<MeetingNotesEmailResponse>(
      `/meeting-notes/${meetingId}/email`,
      body,
    );
    return data;
  },
};
