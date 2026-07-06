import {
  Captions,
  History,
  MonitorPlay,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { SectionHeader } from "@/components/layout/section-header";
import { QuickActionCard } from "@/components/dashboard/quick-actions";

const features = [
  {
    id: "upload",
    title: "Upload recordings",
    description:
      "Bring existing audio or video files in from anywhere you already store them.",
    icon: Upload,
  },
  {
    id: "live",
    title: "Live browser meetings",
    description:
      "Capture a meeting straight from your browser — no extra software to install.",
    icon: MonitorPlay,
    badge: { label: "Live", variant: "secondary" as const },
  },
  {
    id: "transcription",
    title: "AI transcription",
    description:
      "Accurate, speaker-labeled transcripts generated automatically, in minutes.",
    icon: Captions,
  },
  {
    id: "summaries",
    title: "AI summaries",
    description:
      "Skip the replay. Get the decisions, action items, and key points at a glance.",
    icon: Sparkles,
  },
  {
    id: "timeline",
    title: "Timeline generation",
    description:
      "Jump straight to the moment that matters with an auto-generated timeline.",
    icon: History,
  },
  {
    id: "search",
    title: "Search",
    description:
      "Find anything said in any meeting with fast, full-text search.",
    icon: Search,
  },
];

function FeatureGrid() {
  return (
    <PageContainer id="features" size="wide" className="flex flex-col gap-8 py-16 sm:py-24">
      <SectionHeader
        as="h2"
        title="Everything you need to capture a meeting"
        description="Built for teams who want to spend less time taking notes and more time talking."
        className="items-center text-center sm:flex-col sm:justify-center"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((feature) => (
          <QuickActionCard
            key={feature.id}
            title={feature.title}
            description={feature.description}
            icon={feature.icon}
            badge={feature.badge}
            tabIndex={-1}
            className="cursor-default"
          />
        ))}
      </div>
    </PageContainer>
  );
}

export { FeatureGrid };
