"use client";

import { useRef, useState } from "react";

import { useDeleteMeeting } from "@/features/meetings/hooks/use-delete-meeting";
import type { Meeting } from "@/components/meetings/types";

/**
 * Tracks the meeting a pending recording upload is targeting.
 *
 * When the target meeting was freshly created for this upload (as opposed
 * to an existing meeting the user picked), and the upload dialog closes
 * before any file has uploaded successfully to it, the meeting is rolled
 * back — so a cancelled or failed upload never leaves an empty meeting
 * behind. Reusing an existing meeting never triggers a rollback.
 */
export function useUploadTarget() {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const isNewRef = useRef(false);
  const succeededRef = useRef(false);
  const deleteMeeting = useDeleteMeeting();

  function startForNewMeeting(newMeeting: Meeting) {
    isNewRef.current = true;
    succeededRef.current = false;
    setMeeting(newMeeting);
  }

  function startForExistingMeeting(existingMeeting: Meeting) {
    isNewRef.current = false;
    succeededRef.current = false;
    setMeeting(existingMeeting);
  }

  function markUploaded() {
    succeededRef.current = true;
  }

  function close() {
    if (meeting && isNewRef.current && !succeededRef.current) {
      deleteMeeting.mutate(meeting.id);
    }
    setMeeting(null);
    isNewRef.current = false;
    succeededRef.current = false;
  }

  return { meeting, startForNewMeeting, startForExistingMeeting, markUploaded, close };
}
