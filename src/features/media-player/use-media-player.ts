"use client";

import * as React from "react";

export type MediaPlayerStatus = "unavailable" | "loading" | "error" | "ready";

type UseMediaPlayerOptions = {
  mediaType: "audio" | "video" | undefined;
  /**
   * Recording resolution state as seen from outside the media element (no
   * upload at all, still processing, the signed-URL fetch failed, or a
   * playable URL is in hand). Native playback failures (unsupported codec,
   * a dead signed URL) are tracked separately, from inside the element
   * itself, and layered on top below.
   */
  status: MediaPlayerStatus;
  playbackUrl?: string;
};

/**
 * Owns playback state — current time, duration, play state — for the single
 * `<audio>`/`<video>` element mounted in the meeting workspace, and exposes
 * `seek` so Transcript/Conversation/Timeline timestamp clicks can drive that
 * one element without any of those viewers knowing it exists. One instance
 * is created per meeting page render and threaded down as plain props —
 * this app doesn't use context for this kind of shared UI state elsewhere,
 * and the page component is already the single common ancestor for every
 * consumer (the player itself and every tab).
 */
export function useMediaPlayer({
  mediaType,
  status: resolutionStatus,
  playbackUrl,
}: UseMediaPlayerOptions) {
  const mediaRef = React.useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [elementError, setElementError] = React.useState(false);

  // A new source (a different recording, or a freshly re-signed URL for the
  // same one) means the previous element's progress no longer applies.
  // Adjusted during render rather than in an effect, per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  const [previousUrl, setPreviousUrl] = React.useState(playbackUrl);
  if (playbackUrl !== previousUrl) {
    setPreviousUrl(playbackUrl);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setElementError(false);
  }

  const status: MediaPlayerStatus =
    elementError && resolutionStatus === "ready" ? "error" : resolutionStatus;

  const seek = React.useCallback((seconds: number) => {
    const media = mediaRef.current;
    if (!media) return;
    media.currentTime = Math.max(0, seconds);
    void media.play().catch(() => {
      // Autoplay can be blocked by the browser; the seek itself still
      // applies and the user can press play manually.
    });
  }, []);

  const onLoadedMetadata = React.useCallback(
    (event: React.SyntheticEvent<HTMLMediaElement>) => {
      setDuration(event.currentTarget.duration || 0);
    },
    [],
  );
  const onTimeUpdate = React.useCallback(
    (event: React.SyntheticEvent<HTMLMediaElement>) => {
      setCurrentTime(event.currentTarget.currentTime);
    },
    [],
  );
  const onPlay = React.useCallback(() => setIsPlaying(true), []);
  const onPause = React.useCallback(() => setIsPlaying(false), []);
  const onError = React.useCallback(() => setElementError(true), []);

  return {
    mediaRef,
    mediaType,
    src: playbackUrl,
    status,
    isPlaying,
    currentTime,
    duration,
    seek,
    onLoadedMetadata,
    onTimeUpdate,
    onPlay,
    onPause,
    onError,
  };
}

export type MediaPlayerController = ReturnType<typeof useMediaPlayer>;
