import * as React from "react";
import { CheckCircle2 } from "lucide-react";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  meetingSourceOptions,
  type MeetingSourceId,
  type MeetingSourceOption,
} from "@/components/meetings/meeting-source";

type MeetingSourceCardProps = {
  source: MeetingSourceOption;
  name: string;
  checked: boolean;
  disabled?: boolean;
  onSelect: (id: MeetingSourceId) => void;
};

function MeetingSourceCard({
  source,
  name,
  checked,
  disabled,
  onSelect,
}: MeetingSourceCardProps) {
  const Icon = source.icon;

  return (
    <label
      className={cn(
        "group relative block rounded-xl outline-none",
        disabled ? "cursor-not-allowed" : "cursor-pointer",
      )}
    >
      <input
        type="radio"
        name={name}
        value={source.id}
        checked={checked}
        disabled={disabled}
        onChange={() => onSelect(source.id)}
        className="peer sr-only"
      />
      <Card
        data-slot="meeting-source-card"
        data-selected={checked}
        className={cn(
          "gap-2 p-4 transition-all duration-150 ease-out",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background",
          !disabled && "group-hover:ring-foreground/20",
          checked && "bg-primary/5 ring-2 ring-primary",
          disabled && "opacity-50",
        )}
      >
        <div className="flex w-full items-start justify-between gap-2">
          <div
            className={cn(
              "flex size-9 items-center justify-center rounded-lg bg-muted text-foreground transition-colors duration-150",
              checked && "bg-primary/10 text-primary",
            )}
          >
            <Icon aria-hidden="true" className="size-4" />
          </div>
          <CheckCircle2
            aria-hidden="true"
            className={cn(
              "size-4 text-primary transition-opacity duration-150",
              checked ? "opacity-100" : "opacity-0",
            )}
          />
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-medium text-foreground">
            {source.title}
          </p>
          <p className="text-xs text-muted-foreground">
            {source.description}
          </p>
        </div>
      </Card>
    </label>
  );
}

type MeetingSourceSelectorProps = {
  value?: MeetingSourceId;
  onChange: (id: MeetingSourceId) => void;
  sources?: MeetingSourceOption[];
  disabled?: boolean;
  name?: string;
  className?: string;
  /** Id of a visible label element describing this group. Falls back to a built-in label when omitted. */
  "aria-labelledby"?: string;
};

function MeetingSourceSelector({
  value,
  onChange,
  sources = meetingSourceOptions,
  disabled,
  name = "meeting-source",
  className,
  "aria-labelledby": ariaLabelledBy,
}: MeetingSourceSelectorProps) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabelledBy ? undefined : "Meeting source"}
      aria-labelledby={ariaLabelledBy}
      aria-required="true"
      data-slot="meeting-source-selector"
      className={cn("grid grid-cols-1 gap-3 sm:grid-cols-3", className)}
    >
      {sources.map((source) => (
        <MeetingSourceCard
          key={source.id}
          source={source}
          name={name}
          checked={value === source.id}
          disabled={disabled}
          onSelect={onChange}
        />
      ))}
    </div>
  );
}

export { MeetingSourceSelector, MeetingSourceCard };
export type { MeetingSourceSelectorProps };
