import { Zap } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import type { WithClassName } from "@/types";

type LogoProps = WithClassName<{
  /** Renders only the mark, hiding the wordmark. Used by the collapsed sidebar rail. */
  iconOnly?: boolean;
}>;

export function Logo({ className, iconOnly = false }: LogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-2 font-semibold tracking-tight",
        className,
      )}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Zap className="size-4" />
      </span>
      <span className={cn(iconOnly && "sr-only")}>Converra</span>
    </Link>
  );
}
