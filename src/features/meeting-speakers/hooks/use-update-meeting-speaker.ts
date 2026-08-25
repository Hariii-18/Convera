"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { meetingSpeakersApi } from "@/features/meeting-speakers/api";
import { meetingSpeakersQueryKey } from "@/features/meeting-speakers/hooks/use-meeting-speakers";
import type {
  MeetingSpeakerResponse,
  MeetingSpeakerUpdateRequest,
} from "@/features/meeting-speakers/types";

export function useUpdateMeetingSpeaker(meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      speakerId,
      payload,
    }: {
      speakerId: string;
      payload: MeetingSpeakerUpdateRequest;
    }) => meetingSpeakersApi.update(meetingId, speakerId, payload),
    onSuccess: (speaker) => {
      queryClient.setQueryData(
        meetingSpeakersQueryKey(meetingId),
        (current: MeetingSpeakerResponse[] | undefined) =>
          current?.map((item) => (item.id === speaker.id ? speaker : item)) ?? [
            speaker,
          ],
      );
    },
  });
}
