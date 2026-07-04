"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CopyButtonProps = Omit<
  React.ComponentProps<typeof Button>,
  "onClick" | "children"
> & {
  /** Text copied to the clipboard. Runs entirely client-side — no network call. */
  text: string;
  label?: string;
  copiedLabel?: string;
  onCopy?: () => void;
};

/**
 * Copies `text` to the clipboard and shows a brief "Copied" confirmation.
 * Purely client-side via the Clipboard API.
 */
function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
  onCopy,
  className,
  variant = "outline",
  size = "sm",
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = React.useState(false);
  const resetTimeoutRef =
    React.useRef<ReturnType<typeof setTimeout>>(undefined);

  React.useEffect(() => {
    return () => clearTimeout(resetTimeoutRef.current);
  }, []);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.();
      clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. insecure context) — nothing to fall back to.
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleClick}
      className={cn(className)}
      aria-live="polite"
      {...props}
    >
      {copied ? (
        <Check data-icon="inline-start" />
      ) : (
        <Copy data-icon="inline-start" />
      )}
      {copied ? copiedLabel : label}
    </Button>
  );
}

export { CopyButton };
export type { CopyButtonProps };
