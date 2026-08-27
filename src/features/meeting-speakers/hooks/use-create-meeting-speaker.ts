"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { meetingSpeakersApi } from "@/features/meeting-speakers/api";
import { meetingSpeakersQueryKey } from "@/features/meeting-speakers/hooks/use-meeting-speakers";
import type {
  MeetingSpeakerCreateRequest,
  MeetingSpeakerResponse,
} from "@/features/meeting-speakers/types";

/** Adds one placeholder speaker (`Speaker N`) to the meeting. */
export function useCreateMeetingSpeaker(meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MeetingSpeakerCreateRequest = {}) =>
      meetingSpeakersApi.create(meetingId, payload),
    onSuccess: (speaker) => {
      queryClient.setQueryData(
        meetingSpeakersQueryKey(meetingId),
        (current: MeetingSpeakerResponse[] | undefined) => [
          ...(current ?? []),
          speaker,
        ],
      );
    },
  });
}
