"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Video } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { SectionHeader } from "@/components/layout/section-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchInput } from "@/components/ui/search-input";
import { MeetingStatusBadge } from "@/components/meetings/meeting-status-badge";
import { formatDate } from "@/components/meetings/format";
import { useMeetings } from "@/features/meetings/hooks/use-meetings";
import { searchMeetings } from "@/features/meetings/search";

export default function SearchPage() {
  const router = useRouter();
  const { data: meetings } = useMeetings();

  const [query, setQuery] = useState("");

  const results = useMemo(
    () => searchMeetings(meetings ?? [], query),
    [meetings, query],
  );

  return (
    <PageContainer className="flex flex-col gap-6">
      <SectionHeader
        as="h1"
        title="Search"
        description="Find meetings, transcripts, and summaries across your workspace."
      />
      <Card>
        <CardContent className="flex flex-col gap-6">
          <SearchInput
            aria-label="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onClear={() => setQuery("")}
            className="max-w-md"
          />

          {query.trim().length === 0 ? (
            <EmptyState icon={<Search />} title="Start typing to search" />
          ) : results.length === 0 ? (
            <EmptyState
              icon={<Search />}
              title={`No results for "${query}"`}
              description="Try a different meeting title."
            />
          ) : (
            <ul aria-label="Search results" className="flex flex-col gap-1">
              {results.map((meeting) => (
                <li key={meeting.id}>
                  <button
                    type="button"
                    onClick={() => router.push(`/meetings/${meeting.id}`)}
                    className="flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-left outline-none transition-colors hover:border-border hover:bg-accent focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Video className="size-4" aria-hidden="true" />
                    </div>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                      {meeting.title}
                    </span>
                    <MeetingStatusBadge status={meeting.status} />
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(meeting.createdAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
