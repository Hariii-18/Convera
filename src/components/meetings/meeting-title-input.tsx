import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type MeetingTitleInputProps = Omit<
  React.ComponentProps<"input">,
  "value" | "onChange"
> & {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  /** Validation UI only — no submit/API logic lives here. */
  error?: string;
  containerClassName?: string;
};

function MeetingTitleInput({
  id = "meeting-title",
  value,
  onChange,
  error,
  containerClassName,
  className,
  ...props
}: MeetingTitleInputProps) {
  const errorId = `${id}-error`;

  return (
    <div
      data-slot="meeting-title-input"
      className={cn("flex flex-col gap-1.5", containerClassName)}
    >
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        Meeting title
      </label>
      <Input
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="e.g. Weekly sync"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={className}
        {...props}
      />
      {error && (
        <p id={errorId} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export { MeetingTitleInput };
export type { MeetingTitleInputProps };
