"use client";

import * as React from "react";
import { Mic, Video as VideoIcon } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { MediaPlayerController } from "@/features/media-player/use-media-player";

type MeetingMediaPlayerProps = React.ComponentProps<"div"> & {
  player: MediaPlayerController;
};

/**
 * Persistent playback surface for the meeting workspace: the actual
 * `<audio>`/`<video>` element (native controls, so play/pause, seek,
 * current time, duration, and volume all come for free) plus its own
 * no-recording/loading/error states. Mounted once, outside the
 * tab-switching area, so Transcript/Conversation/Timeline can drive this
 * same element via `player.seek` without it remounting when the active tab
 * changes.
 */
function MeetingMediaPlayer({ className, player, ...props }: MeetingMediaPlayerProps) {
  const { mediaRef, mediaType, src, status } = player;

  if (status === "unavailable") {
    return (
      <div
        data-slot="meeting-media-player"
        className={cn("rounded-xl bg-card ring-1 ring-foreground/10", className)}
        {...props}
      >
        <EmptyState
          icon={<Mic />}
          title="No recording available"
          description="This meeting has no recorded audio or video to play back."
          className="rounded-xl border-0 py-6"
        />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        data-slot="meeting-media-player"
        className={cn("rounded-xl bg-card ring-1 ring-foreground/10", className)}
        {...props}
      >
        <EmptyState
          icon={<VideoIcon />}
          title="Recording unavailable"
          description="The recording couldn't be loaded. Try refreshing the page."
          className="rounded-xl border-0 py-6"
        />
      </div>
    );
  }

  const isLoading = status === "loading";

  return (
    <div
      data-slot="meeting-media-player"
      className={cn(
        "flex flex-col gap-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10",
        className,
      )}
      {...props}
    >
      {isLoading && (
        <Skeleton
          className={cn("w-full rounded-lg", mediaType === "video" ? "h-52" : "h-11")}
        />
      )}
      {mediaType === "video" ? (
        // No captions track: this recording has no caption/subtitle data —
        // ASR output is plain transcript text, not a timed caption format —
        // so there's nothing honest to attach here.
        <video
          ref={mediaRef as React.RefObject<HTMLVideoElement>}
          src={src}
          controls
          preload="metadata"
          className={cn("max-h-64 w-full rounded-lg bg-black", isLoading && "hidden")}
          onLoadedMetadata={player.onLoadedMetadata}
          onTimeUpdate={player.onTimeUpdate}
          onPlay={player.onPlay}
          onPause={player.onPause}
          onError={player.onError}
        />
      ) : (
        <audio
          ref={mediaRef as React.RefObject<HTMLAudioElement>}
          src={src}
          controls
          preload="metadata"
          className={cn("w-full", isLoading && "hidden")}
          onLoadedMetadata={player.onLoadedMetadata}
          onTimeUpdate={player.onTimeUpdate}
          onPlay={player.onPlay}
          onPause={player.onPause}
          onError={player.onError}
        />
      )}
    </div>
  );
}

export { MeetingMediaPlayer };
export type { MeetingMediaPlayerProps };
