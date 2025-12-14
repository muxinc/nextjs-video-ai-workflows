"use client";

import MuxPlayer from "@mux/mux-player-react";
import { useCallback, useEffect } from "react";

import { usePlayer } from "./use-player";

import type MuxPlayerElement from "@mux/mux-player";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface VideoPlayerProps {
  playbackId: string;
  title: string;
  accentColor?: string;
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

  const handleTimeUpdate = useCallback(() => {
    if (playerRef.current) {
      setCurrentTime(playerRef.current.currentTime);
    }
  }, [playerRef, setCurrentTime]);

  const handleRef = useCallback((el: MuxPlayerElement | null) => {
    (playerRef as React.MutableRefObject<MuxPlayerElement | null>).current = el;
    if (el) {
      const pending = consumePendingPlaybackState();
      if (pending) {
        const applyRestore = () => {
          try {
            el.currentTime = pending.time;
            if (!pending.wasPaused) {
              void el.play();
            }
          } catch {
            // ignore - player may not be ready yet
          }
          el.removeEventListener("loadedmetadata", applyRestore);
        };

        // Try immediately, but also retry once metadata is ready
        applyRestore();
        el.addEventListener("loadedmetadata", applyRestore);
      }
    }
  }, [consumePendingPlaybackState, playerRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      (playerRef as React.MutableRefObject<MuxPlayerElement | null>).current = null;
    };
  }, [playerRef]);

  return (
    <MuxPlayer
      key={playerKey}
      ref={handleRef}
      playbackId={playbackId}
      metadata={{
        video_title: title,
      }}
      accentColor={accentColor}
      onTimeUpdate={handleTimeUpdate}
      style={{
        aspectRatio: "16 / 9",
        width: "100%",
      }}
    />
  );
}
