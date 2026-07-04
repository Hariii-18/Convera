import * as React from "react";
import { Users } from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { initials } from "@/components/meetings/info-panel/format";
import type { Participant } from "@/components/meetings/info-panel/types";
import { cn } from "@/lib/utils";

type ParticipantsCardProps = React.ComponentProps<"div"> & {
  participants?: Participant[];
  loading?: boolean;
};

/**
 * Roster of meeting participants: avatar, name, and optional role. Purely
 * presentational — it renders whatever `participants` is passed and never
 * fetches attendee data itself.
 */
function ParticipantsCard({
  className,
  participants,
  loading = false,
  ...props
}: ParticipantsCardProps) {
  return (
    <Card data-slot="participants-card" className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle as="h2">Participants</CardTitle>
        {!loading && participants && participants.length > 0 && (
          <CardAction>
            <Badge variant="secondary">{participants.length}</Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Skeleton className="size-8 shrink-0 rounded-full" />
                <div className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : !participants || participants.length === 0 ? (
          <EmptyState
            icon={<Users />}
            title="No participants"
            description="Participants will show up here once they're added."
          />
        ) : (
          <ul role="list" className="flex flex-col gap-3">
            {participants.map((participant) => (
              <li key={participant.id} className="flex items-center gap-3">
                <Avatar size="sm">
                  {participant.avatarUrl && (
                    <AvatarImage src={participant.avatarUrl} alt="" />
                  )}
                  <AvatarFallback>
                    {initials(participant.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <p className="truncate text-sm font-medium text-foreground">
                    {participant.name}
                  </p>
                  {participant.role && (
                    <p className="truncate text-xs text-muted-foreground">
                      {participant.role}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export { ParticipantsCard };
export type { ParticipantsCardProps };
