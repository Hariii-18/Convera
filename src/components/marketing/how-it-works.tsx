import { ArrowDown, ArrowRight, FileText, Upload, Wand2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { SectionHeader } from "@/components/layout/section-header";

type Step = {
  number: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

const steps: Step[] = [
  {
    number: "01",
    title: "Upload",
    description: "Drop in a recording, or start a live browser meeting.",
    icon: Upload,
  },
  {
    number: "02",
    title: "Transcribe",
    description:
      "Converra transcribes every word with speaker labels in minutes.",
    icon: FileText,
  },
  {
    number: "03",
    title: "Summarize",
    description:
      "Get a clean summary, timeline, and fully searchable transcript.",
    icon: Wand2,
  },
];

function HowItWorks() {
  return (
    <PageContainer
      id="how-it-works"
      size="wide"
      className="flex flex-col gap-10 py-16 sm:py-24"
    >
      <SectionHeader
        as="h2"
        title="How it works"
        description="Three steps from raw audio to a finished summary."
        className="items-center text-center sm:flex-col sm:justify-center"
      />

      <div className="flex flex-col items-stretch sm:flex-row sm:items-center">
        {steps.map((step, index) => (
          <div
            key={step.number}
            className="flex flex-1 flex-col items-stretch sm:flex-row"
          >
            <div className="flex flex-1 flex-col gap-3 rounded-xl bg-card p-6 ring-1 ring-foreground/10">
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <step.icon aria-hidden="true" className="size-4" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">
                  {step.number}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-foreground">
                  {step.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>

            {index < steps.length - 1 && (
              <>
                <div className="hidden w-12 shrink-0 items-center justify-center sm:flex">
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                </div>
                <div className="flex shrink-0 items-center justify-center py-3 sm:hidden">
                  <ArrowDown
                    aria-hidden="true"
                    className="size-4 text-muted-foreground"
                  />
                </div>
              </>
            )}
          </div>
        ))}
      </div>
    </PageContainer>
  );
}

export { HowItWorks };
