"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { PlayerContext } from "./context";

import type MuxPlayerElement from "@mux/mux-player";

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTime, setCurrentTime] = useState(0);
  const [playerKey, setPlayerKey] = useState(0);
  const playerRef = useRef<MuxPlayerElement | null>(null);
  const pendingPlaybackStateRef = useRef<{ time: number; wasPaused: boolean } | null>(null);

  const seekTo = useCallback((time: number) => {
    if (playerRef.current) {
      playerRef.current.currentTime = time;
      if (playerRef.current.paused) {
        playerRef.current.play();
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
