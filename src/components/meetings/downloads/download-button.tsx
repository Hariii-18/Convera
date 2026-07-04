import * as React from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type DownloadButtonProps = React.ComponentProps<typeof Button> & {
  /** Shows a spinner in place of the download icon. */
  loading?: boolean;
};

/**
 * Presentational download action. Never fetches or streams a file itself —
 * it only calls back to whatever the caller wires up via `onClick`.
 */
function DownloadButton({
  children,
  loading = false,
  disabled,
  variant = "outline",
  size = "sm",
  ...props
}: DownloadButtonProps) {
  const iconOnly = size?.toString().startsWith("icon") ?? false;

  return (
    <Button
      data-slot="download-button"
      variant={variant}
      size={size}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2
          data-icon={iconOnly ? undefined : "inline-start"}
          className="animate-spin"
        />
      ) : (
        <Download data-icon={iconOnly ? undefined : "inline-start"} />
      )}
      {!iconOnly && (children ?? "Download")}
    </Button>
  );
}

export { DownloadButton };
export type { DownloadButtonProps };
