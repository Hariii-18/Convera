import * as React from "react";

import { cn } from "@/lib/utils";

type DashboardHeaderProps = React.ComponentProps<"div"> & {
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

/**
 * Page-level header for the dashboard: title, description, and primary
 * actions. Sits above the welcome/content sections, distinct from
 * `SectionHeader` which scopes to an individual section.
 */
function DashboardHeader({
  className,
  title,
  description,
  actions,
  ...props
}: DashboardHeaderProps) {
  return (
    <div
      data-slot="dashboard-header"
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

export { DashboardHeader };
