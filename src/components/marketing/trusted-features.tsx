import type { LucideIcon } from "lucide-react";
import {
  Captions,
  History,
  MonitorPlay,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";

type TrustedFeature = {
  label: string;
  icon: LucideIcon;
};

const trustedFeatures: TrustedFeature[] = [
  { label: "Upload recordings", icon: Upload },
  { label: "Live browser meetings", icon: MonitorPlay },
  { label: "AI transcription", icon: Captions },
  { label: "AI summaries", icon: Sparkles },
  { label: "Timeline generation", icon: History },
  { label: "Search", icon: Search },
];

function TrustedFeatures() {
  return (
    <PageContainer size="wide" className="py-8">
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 border-y border-border/60 py-6">
        {trustedFeatures.map((feature) => (
          <div
            key={feature.label}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground"
          >
            <feature.icon className="size-4 shrink-0" />
            {feature.label}
          </div>
        ))}
      </div>
    </PageContainer>
  );
}

export { TrustedFeatures };
