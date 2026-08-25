import axios from "axios";

import { apiClient } from "@/lib/api-client";
import type {
  ConversationEmailRequest,
  ConversationEmailResponse,
  ConversationExportFormat,
  TranscriptResponse,
  TranslationLanguage,
} from "@/features/transcripts/types";

const FILENAME_PATTERN = /filename="?([^";]+)"?/i;

/** Recovers the filename the backend chose (`Content-Disposition`) so the
 * browser save dialog doesn't fall back to a generic name. Mirrors
 * `meetingNotesApi`'s helper of the same name.
 */
function filenameFromContentDisposition(
  contentDisposition: string | undefined,
  fallback: string,
): string {
  const match = contentDisposition?.match(FILENAME_PATTERN);
  return match?.[1] ?? fallback;
}

export const transcriptsApi = {
  /** Returns `null` when the meeting has no transcript yet (404) rather than throwing. */
  async getByMeeting(meetingId: string): Promise<TranscriptResponse | null> {
    try {
      const { data } = await apiClient.get<TranscriptResponse>("/transcripts", {
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

  /** Generates (or regenerates) the readability-normalized transcript. */
  async normalize(meetingId: string): Promise<TranscriptResponse> {
    const { data } = await apiClient.post<TranscriptResponse>("/transcripts/normalize", {
      meeting_id: meetingId,
    });
    return data;
  },

  /** Generates (or regenerates) the transcript translated into `targetLanguage`. */
  async translate(
    meetingId: string,
    targetLanguage: TranslationLanguage,
  ): Promise<TranscriptResponse> {
    const { data } = await apiClient.post<TranscriptResponse>("/transcripts/translate", {
      meeting_id: meetingId,
      target_language: targetLanguage,
    });
    return data;
  },

  /** Downloads the meeting's transcript rendered as speaker dialogue in
   * `format`. Returns the file as a `Blob` plus the filename the backend
   * generated, so the caller can trigger a browser save without
   * hardcoding a name.
   */
  async downloadConversationExport(
    meetingId: string,
    format: ConversationExportFormat,
  ): Promise<{ blob: Blob; filename: string }> {
    const response = await apiClient.get(`/transcripts/${meetingId}/conversation/export`, {
      params: { format },
      responseType: "blob",
    });
    const filename = filenameFromContentDisposition(
      response.headers["content-disposition"] as string | undefined,
      `converra-conversation.${format}`,
    );
    return { blob: response.data as Blob, filename };
  },

  /** Emails the meeting's transcript rendered as speaker dialogue in
   * `format` to every resolved recipient. Generated fresh from the current
   * transcript and current speaker names at send time, same as the download
   * endpoint.
   */
  async sendConversationEmail(
    meetingId: string,
    payload: { format: ConversationExportFormat; sendToMe: boolean; recipients: string[] },
  ): Promise<ConversationEmailResponse> {
    const body: ConversationEmailRequest = {
      format: payload.format,
      send_to_me: payload.sendToMe,
      recipients: payload.recipients,
    };
    const { data } = await apiClient.post<ConversationEmailResponse>(
      `/transcripts/${meetingId}/conversation/email`,
      body,
    );
    return data;
  },
};
