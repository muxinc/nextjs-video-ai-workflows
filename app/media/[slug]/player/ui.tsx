"use client";

import "@videojs/react/video/skin.css";

import { MuxData } from "@videojs/react/extensions/mux-data";
import { MuxVideo } from "@videojs/react/media/mux-video";
import { VideoPlayer as VideoJsPlayer, VideoSkin } from "@videojs/react/video";
import { useCallback, useMemo, useSyncExternalStore } from "react";

import { usePlayer } from "./use-player";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface VideoPlayerProps {
  playbackId: string;
  title: string;
  accentColor?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser language
// ─────────────────────────────────────────────────────────────────────────────

function subscribeToLanguage(onChange: () => void) {
  window.addEventListener("languagechange", onChange);
  return () => window.removeEventListener("languagechange", onChange);
}

function useBrowserLanguage() {
  return useSyncExternalStore(subscribeToLanguage, () => navigator.language, () => undefined);
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function VideoPlayer({
  playbackId,
  title,
  accentColor = "#ff6101",
}: VideoPlayerProps) {
  const { consumePendingPlaybackState, playerKey, playerRef, setCurrentTime } = usePlayer();
  const browserLanguage = useBrowserLanguage();

  const source = useMemo(
    () => browserLanguage === undefined ?
      undefined :
        { playbackId, playback: { defaultSubtitlesLang: browserLanguage } },
    [playbackId, browserLanguage],
  );

  const handleTimeUpdate = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
    setCurrentTime(event.currentTarget.currentTime);
  }, [setCurrentTime]);

  const handleRef = useCallback((el: HTMLVideoElement | null) => {
    playerRef.current = el;
    if (!el) {
      return;
    }

    const pending = consumePendingPlaybackState();
    if (!pending) {
      return;
    }

    const restore = () => {
      el.currentTime = pending.time;
      if (!pending.wasPaused) {
        el.play().catch(() => {});
      }
    };

    if (el.readyState >= HTMLMediaElement.HAVE_METADATA) {
      restore();
    } else {
      el.addEventListener("loadedmetadata", restore, { once: true });
    }
  }, [consumePendingPlaybackState, playerRef]);

  return (
    <VideoJsPlayer key={playerKey} title={title}>
      <VideoSkin
        style={{
          "aspectRatio": "16 / 9",
          "width": "100%",
          "--media-accent-color": accentColor,
          "--media-border-radius": "0",
        } as React.CSSProperties}
      >
        <MuxVideo
          ref={handleRef}
          source={source}
          playsInline
          crossOrigin="anonymous"
          onTimeUpdate={handleTimeUpdate}
        />
        <MuxData metadata={{ video_title: title }} />
      </VideoSkin>
    </VideoJsPlayer>
  );
}
