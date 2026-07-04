"use client";

import * as React from "react";
import { Download, Eye, MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Meeting } from "@/components/meetings/types";

type MeetingContextMenuProps = {
  meeting: Meeting;
  onView?: (meeting: Meeting) => void;
  onRename?: (meeting: Meeting) => void;
  onDownload?: (meeting: Meeting) => void;
  onDelete?: (meeting: Meeting) => void;
};

function MeetingContextMenu({
  meeting,
  onView,
  onRename,
  onDownload,
  onDelete,
}: MeetingContextMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${meeting.title}`}
            onClick={(event) => event.stopPropagation()}
          />
        }
      >
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onView?.(meeting)}>
          <Eye />
          View
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onRename?.(meeting)}>
          <Pencil />
          Rename
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDownload?.(meeting)}>
          <Download />
          Download
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onDelete?.(meeting)}
        >
          <Trash2 />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export { MeetingContextMenu };
