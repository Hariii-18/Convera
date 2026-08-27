"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { meetingSpeakersApi } from "@/features/meeting-speakers/api";
import { meetingSpeakersQueryKey } from "@/features/meeting-speakers/hooks/use-meeting-speakers";
import type { MeetingSpeakerResponse } from "@/features/meeting-speakers/types";

export function useDeleteMeetingSpeaker(meetingId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (speakerId: string) =>
      meetingSpeakersApi.delete(meetingId, speakerId),
    onSuccess: (_data, speakerId) => {
      queryClient.setQueryData(
        meetingSpeakersQueryKey(meetingId),
        (current: MeetingSpeakerResponse[] | undefined) =>
          current?.filter((item) => item.id !== speakerId) ?? [],
      );
    },
  });
}
