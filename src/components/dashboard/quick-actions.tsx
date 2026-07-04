import * as React from "react";
import type { LucideIcon } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import {
  ArrowRight,
  CalendarPlus,
  FolderOpen,
  MonitorPlay,
  Upload,
} from "lucide-react";

import { SectionHeader } from "@/components/layout/section-header";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { cn, hoverLiftClass } from "@/lib/utils";

export type QuickActionBadge = {
  /** Short label rendered inside the badge, e.g. "Live" or "New". */
  label: string;
  variant?: VariantProps<typeof badgeVariants>["variant"];
};

export type QuickAction = {
  /** Stable key for list rendering; falls back to `title` when omitted. */
  id?: string;
  title: string;
  description: string;
  icon: LucideIcon;
  /** Optional status badge. A plain string renders with the default variant. */
  badge?: string | QuickActionBadge;
  /** Disables the card and prevents `onClick` from firing. */
  disabled?: boolean;
  onClick?: () => void;
};

/** Placeholder action set; wire real handlers once the underlying flows exist. */
const defaultQuickActions: QuickAction[] = [
  {
    id: "new-meeting",
    title: "New Meeting",
    description: "Schedule and record a session",
    icon: CalendarPlus,
  },
  {
    id: "upload-recording",
    title: "Upload Recording",
    description: "Add an existing audio or video file",
    icon: Upload,
  },
  {
    id: "live-browser-meeting",
    title: "Live Browser Meeting",
    description: "Capture a meeting straight from your browser",
    icon: MonitorPlay,
    badge: { label: "Live", variant: "secondary" },
  },
  {
    id: "browse-meetings",
    title: "Browse Meetings",
    description: "Explore your recorded and processed sessions",
    icon: FolderOpen,
  },
];

type QuickActionCardProps = Omit<
  React.ComponentProps<"button">,
  "onClick" | "title"
> &
  QuickAction;

function QuickActionCard({
  title,
  description,
  icon: Icon,
  badge,
  disabled = false,
  onClick,
  className,
  ...props
}: QuickActionCardProps) {
  const badgeConfig = typeof badge === "string" ? { label: badge } : badge;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-slot="quick-action-card"
      className={cn(
        "group relative flex flex-col items-start gap-4 rounded-xl bg-card p-5 text-left ring-1 ring-foreground/10",
        hoverLiftClass,
        "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0",
        className,
      )}
      {...props}
    >
      <div className="flex w-full items-start justify-between gap-3">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground transition-colors duration-200 group-hover:bg-primary/10 group-hover:text-primary">
          <Icon aria-hidden="true" className="size-5" />
        </div>
        <ArrowRight
          aria-hidden="true"
          className="size-4 -translate-x-1 text-muted-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100"
        />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {badgeConfig && (
            <Badge variant={badgeConfig.variant ?? "secondary"} className="shrink-0">
              {badgeConfig.label}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}

type QuickActionsProps = Omit<React.ComponentProps<"div">, "title"> & {
  actions?: QuickAction[];
  title?: string;
  description?: string;
};

function QuickActions({
  className,
  actions = defaultQuickActions,
  title = "Quick actions",
  description,
  ...props
}: QuickActionsProps) {
  return (
    <section
      data-slot="quick-actions"
      aria-labelledby="quick-actions-heading"
      className={cn("flex flex-col gap-4", className)}
      {...props}
    >
      <SectionHeader
        title={title}
        description={description}
        headingId="quick-actions-heading"
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((action) => (
          <QuickActionCard key={action.id ?? action.title} {...action} />
        ))}
      </div>
    </section>
  );
}

export { QuickActions, QuickActionCard, defaultQuickActions };
export type { QuickActionCardProps, QuickActionsProps };
