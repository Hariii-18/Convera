import * as React from "react";
import { Sparkles } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

type DashboardSidebarProps = React.ComponentProps<"div"> & {
  /** Content for future widgets (activity feed, insights, etc.). Empty by default. */
  children?: React.ReactNode;
};

/** Right rail reserved for future widgets. Renders a placeholder until content is added. */
function DashboardSidebar({
  className,
  children,
  ...props
}: DashboardSidebarProps) {
  return (
    <div
      data-slot="dashboard-sidebar"
      className={cn("flex flex-col gap-4 2xl:sticky 2xl:top-20", className)}
      {...props}
    >
      {children ?? (
        <EmptyState
          icon={<Sparkles />}
          title="More widgets soon"
          description="This space is reserved for upcoming insights and activity."
          className="py-10"
        />
      )}
    </div>
  );
}

export { DashboardSidebar };
