import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";

import { cn, hoverLiftClass } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type StatCardStatus = "success" | "warning" | "error" | "info" | "neutral";
type StatCardTrendDirection = "up" | "down" | "neutral";

type StatCardTrend = {
  /** Direction of change since the comparison period. */
  direction: StatCardTrendDirection;
  /** Pre-formatted delta, e.g. "12%" or "+48". */
  value: string;
  /** Comparison context, e.g. "vs last month". */
  label?: string;
};

const statusIconStyles: Record<StatCardStatus, string> = {
  success: "bg-success/10 text-success dark:bg-success/15",
  warning: "bg-warning/10 text-warning dark:bg-warning/15",
  error: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  info: "bg-info/10 text-info dark:bg-info/15",
  neutral: "bg-muted text-muted-foreground",
};

const trendStyles: Record<StatCardTrendDirection, string> = {
  up: "text-success",
  down: "text-destructive",
  neutral: "text-muted-foreground",
};

const trendIcons: Record<StatCardTrendDirection, LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  neutral: Minus,
};

const trendAnnouncement: Record<StatCardTrendDirection, string> = {
  up: "increase",
  down: "decrease",
  neutral: "no change",
};

type StatCardProps = Omit<React.ComponentProps<"div">, "title"> & {
  /** Metric name, e.g. "Total meetings". */
  title: string;
  /** Pre-formatted value, e.g. "1,204" or "48%". Omit to render a placeholder dash. */
  value?: string | number;
  /** Supporting copy shown beneath the value/trend, e.g. "Across all workspaces". */
  description?: string;
  /** Optional leading icon representing the metric category. */
  icon?: LucideIcon;
  /** Directional change since a prior period. */
  trend?: StatCardTrend;
  /** Semantic color applied to the icon accent. Defaults to "neutral". */
  status?: StatCardStatus;
  /** Renders skeleton placeholders in place of the value, trend, and description. */
  loading?: boolean;
};

function StatCard({
  className,
  title,
  value,
  description,
  icon: Icon,
  trend,
  status = "neutral",
  loading = false,
  id,
  ...props
}: StatCardProps) {
  const generatedId = React.useId();
  const titleId = id ?? generatedId;
  const TrendIcon = trend ? trendIcons[trend.direction] : null;

  return (
    <div
      data-slot="stat-card"
      role="group"
      aria-labelledby={titleId}
      aria-busy={loading}
      className={cn(
        "group @container relative flex flex-col gap-3 rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10",
        hoverLiftClass,
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p
            id={titleId}
            className="truncate text-sm text-muted-foreground"
          >
            {title}
          </p>
          {loading ? (
            <Skeleton className="h-8 w-20" />
          ) : (
            <p className="font-heading text-2xl font-semibold tracking-tight text-foreground tabular-nums @sm:text-3xl">
              {value ?? "—"}
            </p>
          )}
        </div>
        {Icon && (
          <div
            aria-hidden="true"
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg transition-transform duration-200",
              "group-hover:scale-105",
              statusIconStyles[status],
            )}
          >
            <Icon className="size-4" />
          </div>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-3.5 w-28" />
      ) : (
        (trend || description) && (
          <div className="flex flex-col gap-1">
            {trend && TrendIcon && (
              <div
                className={cn(
                  "inline-flex items-center gap-1 text-xs font-medium",
                  trendStyles[trend.direction],
                )}
              >
                <TrendIcon aria-hidden="true" className="size-3.5 shrink-0" />
                <span>{trend.value}</span>
                {trend.label && (
                  <span className="font-normal text-muted-foreground">
                    {trend.label}
                  </span>
                )}
                <span className="sr-only">{trendAnnouncement[trend.direction]}</span>
              </div>
            )}
            {description && (
              <p className="truncate text-xs text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        )
      )}
    </div>
  );
}

export { StatCard };
export type { StatCardProps, StatCardStatus, StatCardTrend, StatCardTrendDirection };
