import * as React from "react";

import { cn } from "@/lib/utils";

type SectionHeaderProps = React.ComponentProps<"div"> & {
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** Heading level to render. Defaults to `h2`; use `h1` where this doubles as the page title. */
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  /** Id applied to the heading so a wrapping landmark can reference it via `aria-labelledby`. */
  headingId?: string;
};

function SectionHeader({
  className,
  title,
  description,
  action,
  as: Heading = "h2",
  headingId,
  ...props
}: SectionHeaderProps) {
  return (
    <div
      data-slot="section-header"
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-1">
        <Heading
          id={headingId}
          className="font-heading text-lg font-semibold tracking-tight text-foreground"
        >
          {title}
        </Heading>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action && (
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      )}
    </div>
  );
}

export { SectionHeader };
