"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { History } from "lucide-react";
import { toast } from "sonner";

import { PageContainer } from "@/components/layout/page-container";
import { SectionHeader } from "@/components/layout/section-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProcessingJobsTable } from "@/components/processing/processing-jobs-table";
import { extractErrorMessage } from "@/features/auth/error";
import { useGuestSession } from "@/features/guest/guest-provider";
import { useMeetings } from "@/features/meetings/hooks/use-meetings";
import { useProcessing } from "@/features/processing/hooks/use-processing";
import { useRetryProcessing } from "@/features/processing/hooks/use-retry-processing";

const CLOCK_TICK_MS = 1000;

/** Ticks once a second so every row's "elapsed" readout stays live between polls. */
function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}

export default function ProcessingPage() {
  const router = useRouter();
  const { isGuest, isReady } = useGuestSession();
  const now = useNow();

  const {
    data: jobs,
    isLoading,
    isError,
    error,
    refetch,
  } = useProcessing({ enabled: isReady && !isGuest });
  const { data: meetings } = useMeetings({ enabled: isReady && !isGuest });
  const retryMutation = useRetryProcessing();

  const meetingTitles = useMemo(() => {
    const map = new Map<string, string>();
    for (const meeting of meetings ?? []) map.set(meeting.id, meeting.title);
    return map;
  }, [meetings]);

  function handleRetry(jobId: string) {
    retryMutation.mutate(jobId, {
      onError: (mutationError) => {
        toast.error(extractErrorMessage(mutationError));
      },
    });
  }

  if (isGuest) {
    return (
      <PageContainer className="flex flex-col gap-6">
        <SectionHeader
          as="h1"
          title="Processing"
          description="Track the status of meetings being processed."
        />
        <EmptyState
          icon={<History />}
          title="Processing needs an account"
          description="Create a free account to upload recordings and track their processing status."
          action={
            <Button size="sm" onClick={() => router.push("/register")}>
              Create free account
            </Button>
          }
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="flex flex-col gap-6">
      <SectionHeader
        as="h1"
        title="Processing"
        description="Meetings move through Queued, Preparing, and Processing before they're Completed."
      />

      <Card>
        <CardContent className="px-0">
          {isError ? (
            <EmptyState
              icon={<History />}
              title="Couldn't load processing jobs"
              description={extractErrorMessage(error)}
              action={
                <Button size="sm" variant="outline" onClick={() => refetch()}>
                  Try again
                </Button>
              }
              className="mx-4"
            />
          ) : (
            <ProcessingJobsTable
              jobs={jobs ?? []}
              isLoading={isLoading}
              meetingTitles={meetingTitles}
              now={now}
              onRetry={(job) => handleRetry(job.id)}
              isRetrying={(job) =>
                retryMutation.isPending && retryMutation.variables === job.id
              }
              onViewMeeting={(meetingId) => router.push(`/meetings/${meetingId}`)}
            />
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
