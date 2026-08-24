"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      console.error("[app-error]", error);
    }
  }, [error]);

  return (
    <PageContainer className="flex flex-1 items-center justify-center py-16">
      <EmptyState
        icon={<AlertTriangle />}
        title="Something went wrong"
        description="An unexpected error occurred while loading this page. You can try again or head back to your dashboard."
        action={
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={reset}>
              Retry
            </Button>
            <Link
              href="/dashboard"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Back to dashboard
            </Link>
          </div>
        }
      />
    </PageContainer>
  );
}
