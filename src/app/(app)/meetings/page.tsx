"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/page-container";
import { SectionHeader } from "@/components/layout/section-header";
import { MeetingsTable } from "@/components/meetings/meetings-table";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import type { Meeting } from "@/components/meetings/types";
import { mockMeetings } from "./mock-data";

export default function MeetingsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");

  function handleView(meeting: Meeting) {
    router.push(`/meetings/${meeting.id}`);
  }

  return (
    <PageContainer size="wide" className="flex flex-col gap-6">
      <SectionHeader
        as="h1"
        title="Meetings"
        description="Every meeting you record or upload will show up here."
        action={
          <Button size="sm" onClick={() => toast("New meeting")}>
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

      <MeetingsTable
        meetings={mockMeetings}
        onView={handleView}
        onRename={(meeting) => toast(`Rename "${meeting.title}"`)}
        onDownload={(meeting) => toast(`Download "${meeting.title}"`)}
        onDelete={(meeting) => toast(`Delete "${meeting.title}"`)}
      />
    </PageContainer>
  );
}
