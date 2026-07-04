import { Download } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { SectionHeader } from "@/components/layout/section-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function DownloadsPage() {
  return (
    <PageContainer className="flex flex-col gap-6">
      <SectionHeader
        as="h1"
        title="Downloads"
        description="Exports generated across your meetings will show up here."
      />
      <Card>
        <CardContent>
          <EmptyState
            icon={<Download />}
            title="No downloads yet"
            description="Once you export a meeting, it will appear here for quick access."
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
