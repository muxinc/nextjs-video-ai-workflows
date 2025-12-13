"use client";

import type MuxPlayerElement from "@mux/mux-player";
import { createContext, useCallback, useContext, useRef, useState } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PlayerContextValue {
  currentTime: number;
  setCurrentTime: (time: number) => void;
  playerRef: React.RefObject<MuxPlayerElement | null>;
  seekTo: (time: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

const PlayerContext = createContext<PlayerContextValue | null>(null);

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

  return (
    <PlayerContext value={{ currentTime, setCurrentTime, playerRef, seekTo }}>
      {children}
    </PlayerContext>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return context;
}

