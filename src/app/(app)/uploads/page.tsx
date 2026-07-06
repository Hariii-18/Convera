import { UploadCloud } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { SectionHeader } from "@/components/layout/section-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function UploadsPage() {
  return (
    <PageContainer className="flex flex-col gap-6">
      <SectionHeader
        as="h1"
        title="Uploads"
        description="Upload an existing recording to have it processed."
      />
      <Card>
        <CardContent>
          <EmptyState
            icon={<UploadCloud />}
            title="Upload Engine coming soon"
            description="Recording uploads aren't available yet. Check back once this feature ships."
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
