import axios from "axios";

import { apiClient } from "@/lib/api-client";
import type {
  SummaryActionItemUpdateRequest,
  SummaryEmailRequest,
  SummaryEmailResponse,
  SummaryExportFormat,
  SummaryResponse,
} from "@/features/summaries/types";

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

export const summariesApi = {
  /** Returns `null` when the meeting has no summary yet (404) rather than throwing. */
  async getByMeeting(meetingId: string): Promise<SummaryResponse | null> {
    try {
      const { data } = await apiClient.get<SummaryResponse>("/summaries", {
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

  /** Runs the Local Summary Engine against the meeting's transcript. */
  async generate(meetingId: string): Promise<SummaryResponse> {
    const { data } = await apiClient.post<SummaryResponse>("/summaries", {
      meeting_id: meetingId,
    });
    return data;
  },

  /**
   * Persists a status/owner/due_date/text edit to one action item,
   * identified by its position in `action_items`. Returns the full,
   * updated summary so the caller can reseed its cache without a refetch.
   */
  async updateActionItem(
    meetingId: string,
    index: number,
    payload: SummaryActionItemUpdateRequest,
  ): Promise<SummaryResponse> {
    const { data } = await apiClient.patch<SummaryResponse>(
      `/summaries/action-items/${index}`,
      payload,
      { params: { meeting_id: meetingId } },
    );
    return data;
  },

  /** Downloads the current saved Summary tab content rendered to `format`.
   * Returns the file as a `Blob` plus the filename the backend generated,
   * so the caller can trigger a browser save without hardcoding a name.
   */
  async downloadExport(
    meetingId: string,
    format: SummaryExportFormat,
  ): Promise<{ blob: Blob; filename: string }> {
    const response = await apiClient.get(`/summaries/${meetingId}/export`, {
      params: { format },
      responseType: "blob",
    });
    const filename = filenameFromContentDisposition(
      response.headers["content-disposition"] as string | undefined,
      `converra-summary.${format}`,
    );
    return { blob: response.data as Blob, filename };
  },

  /** Renders the current saved Summary tab content to `format` and emails
   * it to every resolved recipient in one request: the authenticated user
   * (when `sendToMe`) plus `recipients`. Never regenerates the summary
   * first and never sends Meeting Notes — the backend renders straight
   * from the persisted `Summary` row (see `export_summary`).
   */
  async sendEmail(
    meetingId: string,
    payload: { format: SummaryExportFormat; sendToMe: boolean; recipients: string[] },
  ): Promise<SummaryEmailResponse> {
    const body: SummaryEmailRequest = {
      format: payload.format,
      send_to_me: payload.sendToMe,
      recipients: payload.recipients,
    };
    const { data } = await apiClient.post<SummaryEmailResponse>(
      `/summaries/${meetingId}/email`,
      body,
    );
    return data;
  },
};
