import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  ListTodo,
  Shuffle,
  Sparkles,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { InsightItem, MeetingInsightsData } from "@/components/meetings/info-panel/types";
import { cn } from "@/lib/utils";

type AIInsightsCardProps = React.ComponentProps<"div"> & {
  data?: MeetingInsightsData;
  loading?: boolean;
  /** True when the insights fetch itself failed (distinct from "no summary
   * yet", which is `data.hasSummary === false`). */
  error?: boolean;
};

type Section = {
  key: string;
  label: string;
  icon: React.ReactNode;
  items: InsightItem[];
};

function InsightSection({ section }: { section: Section }) {
  if (section.items.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className="[&_svg]:size-3.5">{section.icon}</span>
        {section.label}
      </div>
      <ul role="list" className="flex flex-col gap-2">
        {section.items.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-border bg-muted/40 px-3 py-2"
          >
            <p className="text-sm text-foreground">{item.text}</p>
            {item.detail && (
              <p className="mt-0.5 text-xs text-muted-foreground">{item.detail}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * AI-derived meeting insights: unresolved issues, decision uncertainty,
 * risk signals, unanswered questions, and follow-up gaps. Every item is
 * grounded in this meeting's own Summary (`GET /meetings/{id}/insights`,
 * `app.services.insights_service`) — nothing here is generated fresh from
 * the transcript, so there's nothing to invent.
 */
function AIInsightsCard({
  className,
  data,
  loading = false,
  error = false,
  ...props
}: AIInsightsCardProps) {
  // `data.unresolvedIssues` (risks + open questions combined) isn't
  // rendered as its own section — it would just repeat every item already
  // shown under "Risk signals"/"Unanswered questions" below. It still comes
  // through from the API for callers that want a single "how much is
  // outstanding" count.
  const sections: Section[] = data
    ? [
        {
          key: "risks",
          label: "Risk signals",
          icon: <AlertTriangle />,
          items: data.riskSignals,
        },
        {
          key: "decision-uncertainty",
          label: "Decision uncertainty",
          icon: <Shuffle />,
          items: data.decisionUncertainty,
        },
        {
          key: "questions",
          label: "Unanswered questions",
          icon: <CircleHelp />,
          items: data.unansweredQuestions,
        },
        {
          key: "follow-up",
          label: "Follow-up gaps",
          icon: <ListTodo />,
          items: data.followUpGaps,
        },
      ]
    : [];

  const totalCount = sections.reduce((sum, section) => sum + section.items.length, 0);
  const isNothingFlagged = data?.hasSummary && totalCount === 0;

  return (
    <Card data-slot="ai-insights-card" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">AI insights</CardTitle>
        {!loading && !error && totalCount > 0 && (
          <CardAction>
            <Badge variant="secondary">{totalCount}</Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={<AlertTriangle />}
            title="Couldn't load AI insights"
            description="Something went wrong fetching insights for this meeting. Try refreshing the page."
          />
        ) : !data || !data.hasSummary ? (
          <EmptyState
            icon={<Sparkles />}
            title="Insights need a summary first"
            description="AI insights are derived from this meeting's summary — check back once it's generated."
          />
        ) : isNothingFlagged ? (
          <EmptyState
            icon={<CheckCircle2 />}
            title="Nothing flagged"
            description="No unresolved issues, risks, or follow-up gaps were found in this meeting."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {sections.map((section) => (
              <InsightSection key={section.key} section={section} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { AIInsightsCard };
export type { AIInsightsCardProps };
