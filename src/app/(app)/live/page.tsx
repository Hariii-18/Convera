import { Radio } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { SectionHeader } from "@/components/layout/section-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function LiveMeetingPage() {
  return (
    <PageContainer className="flex flex-col gap-6">
      <SectionHeader
        as="h1"
        title="Live Meeting"
        description="Join or start a live meeting to see real-time transcription here."
      />
      <Card>
        <CardContent>
          <EmptyState
            icon={<Radio />}
            title="No live meeting in progress"
            description="Once a live meeting starts, the real-time transcript and insights will appear here."
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
