import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/page-container";
import { DashboardPreview } from "@/components/marketing/dashboard-preview";

function Hero() {
  return (
    <PageContainer
      size="wide"
      className="flex flex-col items-center gap-12 py-16 sm:py-24"
    >
      <div className="flex flex-col items-center gap-6 text-center">
        <Badge variant="secondary">AI-powered meeting intelligence</Badge>

        <div className="flex flex-col gap-4">
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            Meeting notes that write themselves
          </h1>
          <p className="mx-auto max-w-xl text-balance text-muted-foreground sm:text-lg">
            Converra turns every recording or live browser meeting into a
            searchable transcript, summary, and timeline — automatically.
          </p>
        </div>

        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Link href="/dashboard" className={buttonVariants({ size: "lg" })}>
            Try without account
            <ArrowRight data-icon="inline-end" />
          </Link>
          <Link
            href="/register"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Create account
          </Link>
        </div>
      </div>

      <DashboardPreview className="w-full max-w-4xl" />
    </PageContainer>
  );
}

export { Hero };
