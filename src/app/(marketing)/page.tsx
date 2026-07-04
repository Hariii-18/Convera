import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center sm:py-32">
      <Badge variant="secondary">In active development</Badge>
      <div className="flex flex-col gap-4">
        <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
          Converra
        </h1>
        <p className="mx-auto max-w-md text-balance text-muted-foreground sm:text-lg">
          The frontend foundation is ready for feature development.
        </p>
      </div>
      <Button size="lg" render={<Link href="/dashboard" />}>
        Open dashboard
        <ArrowRight data-icon="inline-end" />
      </Button>
    </div>
  );
}
