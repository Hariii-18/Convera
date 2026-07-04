import * as React from "react";

import { cn } from "@/lib/utils";

type PageContainerProps = React.ComponentProps<"div"> & {
  /** Max-width preset. Defaults to "default" (max-w-7xl), matching the site header. */
  size?: "narrow" | "default" | "wide";
};

const sizeClassNames: Record<
  NonNullable<PageContainerProps["size"]>,
  string
> = {
  narrow: "max-w-3xl",
  default: "max-w-7xl",
  wide: "max-w-[96rem]",
};

function PageContainer({
  className,
  size = "default",
  ...props
}: PageContainerProps) {
  return (
    <div
      data-slot="page-container"
      className={cn(
        "mx-auto w-full px-4 py-8 sm:px-6 lg:px-8",
        sizeClassNames[size],
        className,
      )}
      {...props}
    />
  );
}

export { PageContainer };
