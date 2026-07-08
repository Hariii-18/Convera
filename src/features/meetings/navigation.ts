import type { MeetingSourceId } from "@/components/meetings/meeting-source";

/**
 * Where to send the user right after a meeting is created, based on the
 * source they picked in the New Meeting dialog. Upload Recording is handled
 * by the caller instead (it opens `UploadDialog` inline rather than
 * navigating); microphone recording has no dedicated page yet, so it falls
 * back to the meeting detail view like every other post-creation case used to.
 */
export function getPostCreateRoute(
  source: Exclude<MeetingSourceId, "upload-recording">,
  meetingId: string,
): string {
  switch (source) {
    case "live-browser-meeting":
      return "/live";
    case "microphone-recording":
      return `/meetings/${meetingId}`;
  }
}
