"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { PlayerContext } from "./context";

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [playerKey, setPlayerKey] = useState(0);
  const playerRef = useRef<HTMLVideoElement | null>(null);
  const pendingPlaybackStateRef = useRef<{ time: number; wasPaused: boolean } | null>(null);

  const seekTo = useCallback((time: number) => {
    const media = playerRef.current;
    if (media) {
      media.currentTime = time;
      if (media.paused) {
        media.play().catch(() => {});
      }
    }
  }, []);

  // Increment the player key to force remount and reload tracks from Mux
  const refreshPlayer = useCallback(() => {
    if (playerRef.current) {
      pendingPlaybackStateRef.current = {
        time: playerRef.current.currentTime,
        wasPaused: playerRef.current.paused,
      };
    }
    setPlayerKey(prev => prev + 1);
  }, []);

  const consumePendingPlaybackState = useCallback(() => {
    const value = pendingPlaybackStateRef.current;
    pendingPlaybackStateRef.current = null;
    return value;
  }, []);

  const value = useMemo(
    () => ({
      currentTime,
      setCurrentTime,
      playerRef,
      seekTo,
      playerKey,
      refreshPlayer,
      consumePendingPlaybackState,
    }),
    [currentTime, seekTo, playerKey, refreshPlayer, consumePendingPlaybackState],
  );

  return (
    <PlayerContext value={value}>
      {children}
    </PlayerContext>
  );
}
