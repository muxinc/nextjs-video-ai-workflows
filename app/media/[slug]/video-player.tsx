"use client";

import MuxPlayer from "@mux/mux-player-react";
import { useCallback, useEffect } from "react";

import { usePlayer } from "./player-context";

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
  const { playerRef, setCurrentTime } = usePlayer();

  const handleTimeUpdate = useCallback(() => {
    if (playerRef.current) {
      setCurrentTime(playerRef.current.currentTime);
    }
  }, [playerRef, setCurrentTime]);

  const handleRef = useCallback((el: MuxPlayerElement | null) => {
    (playerRef as React.MutableRefObject<MuxPlayerElement | null>).current = el;
  }, [playerRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      (playerRef as React.MutableRefObject<MuxPlayerElement | null>).current = null;
    };
  }, [playerRef]);

  return (
    <MuxPlayer
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

