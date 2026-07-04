import * as React from "react";

import { cn } from "@/lib/utils";

type WelcomeSectionProps = React.ComponentProps<"p"> & {
  greeting?: string;
  message?: string;
};

/**
 * Subtitle line attached to the dashboard header, introducing the workspace
 * overview below. Copy is passed in via props rather than sourced from a
 * session/API, so this stays a plain presentational block.
 */
function WelcomeSection({
  className,
  greeting = "Welcome back",
  message = "Here's an overview of your workspace.",
  ...props
}: WelcomeSectionProps) {
  return (
    <p
      data-slot="welcome-section"
      className={cn("-mt-4 text-sm text-muted-foreground", className)}
      {...props}
    >
      <span className="font-medium text-foreground">{greeting}</span>
      {" — "}
      {message}
    </p>
  );
}

export { WelcomeSection };
