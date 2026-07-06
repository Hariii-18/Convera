"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarPlus, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/page-container";
import { SectionHeader } from "@/components/layout/section-header";
import { MeetingsTable } from "@/components/meetings/meetings-table";
import { NewMeetingModal } from "@/components/meetings/new-meeting-modal";
import type { MeetingSourceId } from "@/components/meetings/meeting-source";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import type { Meeting } from "@/components/meetings/types";
import { extractErrorMessage } from "@/features/auth/error";
import { useCreateMeeting } from "@/features/meetings/hooks/use-create-meeting";
import { useMeetings } from "@/features/meetings/hooks/use-meetings";

export default function MeetingsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [newMeetingOpen, setNewMeetingOpen] = useState(false);

  const { data: meetings, isLoading, isError, error, refetch } = useMeetings();
  const createMeeting = useCreateMeeting();

  function handleView(meeting: Meeting) {
    router.push(`/meetings/${meeting.id}`);
  }

  function handleContinue(data: { title: string; source: MeetingSourceId }) {
    createMeeting.mutate(
      { title: data.title, source_type: data.source },
      {
        onSuccess: (meeting) => {
          setNewMeetingOpen(false);
          router.push(`/meetings/${meeting.id}`);
        },
        onError: (mutationError) => {
          toast.error(extractErrorMessage(mutationError));
        },
      },
    );
  }

  return (
    <PageContainer size="wide" className="flex flex-col gap-6">
      <SectionHeader
        as="h1"
        title="Meetings"
        description="Every meeting you record or upload will show up here."
        action={
          <Button size="sm" onClick={() => setNewMeetingOpen(true)}>
            <CalendarPlus data-icon="inline-start" />
            New meeting
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SearchInput
          aria-label="Search meetings"
          placeholder="Search meetings…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onClear={() => setSearch("")}
          containerClassName="sm:max-w-sm"
        />
        <Button variant="outline" size="sm" disabled>
          <SlidersHorizontal data-icon="inline-start" />
          Filters
        </Button>
      </div>

      {isError ? (
        <EmptyState
          icon={<AlertTriangle />}
          title="Couldn't load meetings"
          description={extractErrorMessage(error)}
          action={
            <Button size="sm" variant="outline" onClick={() => refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <MeetingsTable
          meetings={meetings ?? []}
          isLoading={isLoading}
          onView={handleView}
          onRename={(meeting) => toast(`Rename "${meeting.title}"`)}
          onDownload={(meeting) => toast(`Download "${meeting.title}"`)}
          onDelete={(meeting) => toast(`Delete "${meeting.title}"`)}
        />
      )}

      <NewMeetingModal
        open={newMeetingOpen}
        onOpenChange={setNewMeetingOpen}
        onContinue={handleContinue}
      />
    </PageContainer>
  );
}
