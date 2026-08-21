import { PageContainer } from "@/components/layout/page-container";
import { SectionHeader } from "@/components/layout/section-header";
import { LiveCapturePanel } from "@/components/live/live-capture-panel";

export default function LiveMeetingPage() {
  return (
    <PageContainer className="flex flex-col gap-6">
      <SectionHeader
        as="h1"
        title="Live Meeting"
        description="Start a live meeting to capture microphone audio directly from your browser."
      />
      <LiveCapturePanel />
    </PageContainer>
  );
}
