import { Settings } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { SectionHeader } from "@/components/layout/section-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default function SettingsPage() {
  return (
    <PageContainer className="flex flex-col gap-6">
      <SectionHeader
        as="h1"
        title="Settings"
        description="Manage your workspace preferences."
      />
      <Card>
        <CardContent>
          <EmptyState
            icon={<Settings />}
            title="Nothing to configure yet"
            description="This page is a placeholder rendered inside the application shell."
          />
        </CardContent>
      </Card>
    </PageContainer>
  );
}
