import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex h-5 w-fit shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      status: {
        success: "bg-success/10 text-success dark:bg-success/15",
        warning: "bg-warning/10 text-warning dark:bg-warning/15",
        error: "bg-destructive/10 text-destructive dark:bg-destructive/20",
        info: "bg-info/10 text-info dark:bg-info/15",
        neutral: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      status: "neutral",
    },
  },
);

type StatusBadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof statusBadgeVariants> & {
    /** Show the leading status dot. Defaults to true. */
    dot?: boolean;
  };

function StatusBadge({
  className,
  status = "neutral",
  dot = true,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      data-slot="status-badge"
      data-status={status}
      className={cn(statusBadgeVariants({ status }), className)}
      {...props}
    >
      {dot && (
        <span
          aria-hidden="true"
          className="size-1.5 shrink-0 rounded-full bg-current"
        />
      )}
      {children}
    </span>
  );
}

export { StatusBadge, statusBadgeVariants };
