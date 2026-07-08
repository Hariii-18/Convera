"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Video } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { SearchInput } from "@/components/ui/search-input";
import { MeetingStatusBadge } from "@/components/meetings/meeting-status-badge";
import { formatRelativeTime } from "@/components/meetings/format";
import { useGuestSession } from "@/features/guest/guest-provider";
import { useGuestMeetingsStore } from "@/features/guest/guest-meetings-store";
import { useMeetings } from "@/features/meetings/hooks/use-meetings";
import { searchMeetings } from "@/features/meetings/search";

const MAX_RESULTS = 6;

export function GlobalSearch() {
  const router = useRouter();
  const { isGuest, isReady } = useGuestSession();
  const guestMeetings = useGuestMeetingsStore((state) => state.meetings);
  const { data: fetchedMeetings } = useMeetings({ enabled: isReady && !isGuest });

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const results = useMemo(
    () => searchMeetings(isGuest ? guestMeetings : (fetchedMeetings ?? []), query, MAX_RESULTS),
    [isGuest, guestMeetings, fetchedMeetings, query],
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) setQuery("");
  }

  function handleSelect(meetingId: string) {
    setOpen(false);
    router.push(`/meetings/${meetingId}`);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            variant="outline"
            size="sm"
            aria-label="Search"
            className="w-9 justify-start gap-2 px-2 text-muted-foreground sm:w-56 sm:px-2.5"
          />
        }
      >
        <Search className="size-4" />
        <span className="hidden flex-1 text-left sm:inline">Search…</span>
        <Kbd className="hidden sm:inline-flex">⌘K</Kbd>
      </DialogTrigger>
      <DialogContent className="gap-4 sm:max-w-md">
        <DialogHeader className="sr-only">
          <DialogTitle>Search</DialogTitle>
          <DialogDescription>Search across your workspace</DialogDescription>
        </DialogHeader>
        <SearchInput
          autoFocus
          aria-label="Search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onClear={() => setQuery("")}
        />
        {query.trim().length === 0 ? (
          <p role="status" className="py-6 text-center text-sm text-muted-foreground">
            Start typing to search.
          </p>
        ) : results.length === 0 ? (
          <p
            role="status"
            aria-live="polite"
            className="py-6 text-center text-sm text-muted-foreground"
          >
            No results for &quot;{query}&quot;
          </p>
        ) : (
          <ul aria-label="Search results" className="flex flex-col gap-0.5">
            {results.map((meeting) => (
              <li key={meeting.id}>
                <button
                  type="button"
                  onClick={() => handleSelect(meeting.id)}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left outline-none hover:bg-accent focus-visible:bg-accent"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Video className="size-4" aria-hidden="true" />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {meeting.title}
                  </span>
                  <MeetingStatusBadge status={meeting.status} />
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(meeting.updatedAt)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
