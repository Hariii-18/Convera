import Link from "next/link";
import { Compass } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <PageContainer className="flex flex-1 items-center justify-center py-16">
      <EmptyState
        icon={<Compass />}
        title="Page not found"
        description="The page you're looking for doesn't exist or may have moved."
        action={
          <Button size="sm" render={<Link href="/dashboard" />}>
            Back to dashboard
          </Button>
        }
      />
    </PageContainer>
  );
}
