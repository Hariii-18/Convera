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
      // The transcript's segments carry a `speaker_name` resolved fresh at
      // fetch time — refetch it so a rename shows up in the Transcript and
      // Conversation tabs without a manual page reload.
      queryClient.invalidateQueries({ queryKey: ["transcripts", meetingId] });
    },
  });
}
