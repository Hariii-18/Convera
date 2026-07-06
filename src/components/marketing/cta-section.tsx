import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";

function CtaSection() {
  return (
    <PageContainer size="wide" className="py-16 sm:py-24">
      <div className="flex flex-col items-center gap-6 rounded-2xl bg-muted/40 px-6 py-16 text-center ring-1 ring-foreground/10 sm:px-12">
        <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
          Start using Converra today.
        </h2>
        <p className="max-w-md text-balance text-muted-foreground">
          No credit card, no setup. Try it with a recording you already have.
        </p>
        <div className="flex flex-col items-center gap-3 sm:flex-row">
          <Button size="lg" render={<Link href="/dashboard" />}>
            Try without account
            <ArrowRight data-icon="inline-end" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            render={<Link href="/register" />}
          >
            Create account
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}

export { CtaSection };
