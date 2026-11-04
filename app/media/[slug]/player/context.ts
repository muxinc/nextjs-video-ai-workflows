"use client";

import { createContext } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PlayerContextValue {
  currentTime: number;
  setCurrentTime: (time: number) => void;
  playerRef: React.RefObject<HTMLVideoElement | null>;
  seekTo: (time: number) => void;
  playerKey: number;
  refreshPlayer: () => void;
  consumePendingPlaybackState: () => { time: number; wasPaused: boolean } | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

export const PlayerContext = createContext<PlayerContextValue | null>(null);
