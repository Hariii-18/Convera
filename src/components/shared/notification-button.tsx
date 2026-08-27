"use client";

import { Bell, BellOff, CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { formatRelativeTime } from "@/components/meetings/format";
import { useMarkAllNotificationsRead } from "@/features/notifications/hooks/use-mark-all-notifications-read";
import { useMarkNotificationRead } from "@/features/notifications/hooks/use-mark-notification-read";
import { useNotifications } from "@/features/notifications/hooks/use-notifications";
import type { Notification } from "@/features/notifications/mappers";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";

export function NotificationButton() {
  const router = useRouter();
  const isSignedIn = useAuthStore((state) => Boolean(state.user));
  const { data: notifications } = useNotifications({ enabled: isSignedIn });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const items = notifications ?? [];
  const unreadCount = items.filter((item) => !item.isRead).length;

  function handleSelect(notification: Notification) {
    if (!notification.isRead) markRead.mutate(notification.id);
    if (notification.meetingId) router.push(`/meetings/${notification.meetingId}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative"
            aria-label={
              unreadCount > 0
                ? `Notifications, ${unreadCount} unread`
                : "Notifications"
            }
          />
        }
      >
        <Bell className="size-4" />
        {unreadCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </Badge>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between px-3 py-2.5 text-sm font-medium text-foreground">
            Notifications
            {unreadCount > 0 && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-normal text-muted-foreground hover:text-foreground"
                onClick={(event) => {
                  event.stopPropagation();
                  markAllRead.mutate();
                }}
              >
                <CheckCheck className="size-3.5" />
                Mark all read
              </button>
            )}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="my-0" />
        {items.length === 0 ? (
          <div className="p-2">
            <EmptyState
              icon={<BellOff />}
              title="No new notifications"
              description="You're all caught up."
              className="border-none py-8"
            />
          </div>
        ) : (
          <DropdownMenuGroup className="max-h-96 overflow-y-auto p-1">
            {items.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="flex-col items-start gap-0.5 py-2"
                onClick={() => handleSelect(notification)}
              >
                <span className="flex w-full items-center gap-2">
                  <span
                    className={cn(
                      "size-1.5 shrink-0 rounded-full",
                      notification.isRead ? "bg-transparent" : "bg-primary",
                    )}
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate text-sm font-medium text-foreground">
                    {notification.title}
                  </span>
                </span>
                <span className="line-clamp-2 pl-3.5 text-xs text-muted-foreground">
                  {notification.message}
                </span>
                <span className="pl-3.5 text-[11px] text-muted-foreground">
                  {formatRelativeTime(notification.createdAt)}
                </span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
