"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { PlayerContext } from "./player-context-value";

import type MuxPlayerElement from "@mux/mux-player";

// ─────────────────────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────────────────────

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [currentTime, setCurrentTime] = useState(0);
  const playerRef = useRef<MuxPlayerElement | null>(null);

  const seekTo = useCallback((time: number) => {
    if (playerRef.current) {
      playerRef.current.currentTime = time;
      if (playerRef.current.paused) {
        playerRef.current.play();
      }
    }
  }, []);

  const value = useMemo(
    () => ({ currentTime, setCurrentTime, playerRef, seekTo }),
    [currentTime, seekTo],
  );

  return (
    <PlayerContext value={value}>
      {children}
    </PlayerContext>
  );
}
