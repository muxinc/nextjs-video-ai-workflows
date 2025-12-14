"use client";

import { createContext } from "react";

import type MuxPlayerElement from "@mux/mux-player";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PlayerContextValue {
  currentTime: number;
  setCurrentTime: (time: number) => void;
  playerRef: React.RefObject<MuxPlayerElement | null>;
  seekTo: (time: number) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────────────────────

export const PlayerContext = createContext<PlayerContextValue | null>(null);
