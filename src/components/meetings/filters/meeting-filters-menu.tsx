"use client";

import { SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { meetingStatusConfig } from "@/components/meetings/meeting-status";
import { meetingSourceOptions } from "@/components/meetings/meeting-source";
import type { MeetingStatus } from "@/components/meetings/types";
import type { MeetingSourceId } from "@/components/meetings/meeting-source";
import {
  countActiveMeetingFilters,
  defaultMeetingFilters,
  type MeetingFiltersState,
} from "@/components/meetings/filters/types";

const statusOptions = Object.keys(meetingStatusConfig) as MeetingStatus[];

type MeetingFiltersMenuProps = {
  filters: MeetingFiltersState;
  onChange: (filters: MeetingFiltersState) => void;
};

function MeetingFiltersMenu({ filters, onChange }: MeetingFiltersMenuProps) {
  const activeCount = countActiveMeetingFilters(filters);

  function toggleStatus(status: MeetingStatus, checked: boolean) {
    onChange({
      ...filters,
      statuses: checked
        ? [...filters.statuses, status]
        : filters.statuses.filter((value) => value !== status),
    });
  }

  function toggleSourceType(sourceType: MeetingSourceId, checked: boolean) {
    onChange({
      ...filters,
      sourceTypes: checked
        ? [...filters.sourceTypes, sourceType]
        : filters.sourceTypes.filter((value) => value !== sourceType),
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" size="sm" />}>
        <SlidersHorizontal data-icon="inline-start" />
        Filters
        {activeCount > 0 && (
          <Badge variant="secondary" className="ml-1">
            {activeCount}
          </Badge>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Status</DropdownMenuLabel>
        {statusOptions.map((status) => (
          <DropdownMenuCheckboxItem
            key={status}
            checked={filters.statuses.includes(status)}
            onCheckedChange={(checked) => toggleStatus(status, checked)}
          >
            {meetingStatusConfig[status].label}
          </DropdownMenuCheckboxItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Upload type</DropdownMenuLabel>
        {meetingSourceOptions.map((source) => (
          <DropdownMenuCheckboxItem
            key={source.id}
            checked={filters.sourceTypes.includes(source.id)}
            onCheckedChange={(checked) => toggleSourceType(source.id, checked)}
          >
            {source.title}
          </DropdownMenuCheckboxItem>
        ))}

        <DropdownMenuSeparator />

        <DropdownMenuLabel>Date range</DropdownMenuLabel>
        <div className="flex items-center gap-2 px-1.5 py-1">
          <Input
            type="date"
            aria-label="From date"
            value={filters.dateFrom ?? ""}
            max={filters.dateTo ?? undefined}
            onChange={(event) =>
              onChange({ ...filters, dateFrom: event.target.value || null })
            }
            onClick={(event) => event.stopPropagation()}
            className="h-8"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            aria-label="To date"
            value={filters.dateTo ?? ""}
            min={filters.dateFrom ?? undefined}
            onChange={(event) =>
              onChange({ ...filters, dateTo: event.target.value || null })
            }
            onClick={(event) => event.stopPropagation()}
            className="h-8"
          />
        </div>

        {activeCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onChange(defaultMeetingFilters)}>
              Clear filters
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { MeetingFiltersMenu };
export type { MeetingFiltersMenuProps };
