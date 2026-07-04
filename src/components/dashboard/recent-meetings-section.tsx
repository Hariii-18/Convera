import * as React from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MeetingsTable } from "@/components/meetings/meetings-table";
import type { Meeting } from "@/components/meetings/types";

type RecentMeetingsSectionProps = React.ComponentProps<"div"> & {
  meetings?: Meeting[];
  isLoading?: boolean;
  onViewMeeting?: (meeting: Meeting) => void;
  onRenameMeeting?: (meeting: Meeting) => void;
  onDownloadMeeting?: (meeting: Meeting) => void;
  onDeleteMeeting?: (meeting: Meeting) => void;
  onViewAll?: () => void;
};

/**
 * Renders whatever `meetings` is passed once a data source exists.
 * With none provided, MeetingsTable shows its empty state instead of
 * fabricating rows.
 */
function RecentMeetingsSection({
  className,
  meetings = [],
  isLoading = false,
  onViewMeeting,
  onRenameMeeting,
  onDownloadMeeting,
  onDeleteMeeting,
  onViewAll,
  ...props
}: RecentMeetingsSectionProps) {
  return (
    <div
      data-slot="recent-meetings-section"
      className={cn(className)}
      {...props}
    >
      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle as="h2">Recent meetings</CardTitle>
          <CardAction>
            <Button variant="ghost" size="sm" onClick={onViewAll}>
              View all
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          <MeetingsTable
            meetings={meetings}
            isLoading={isLoading}
            skeletonRowCount={4}
            onView={onViewMeeting}
            onRename={onRenameMeeting}
            onDownload={onDownloadMeeting}
            onDelete={onDeleteMeeting}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export { RecentMeetingsSection };
