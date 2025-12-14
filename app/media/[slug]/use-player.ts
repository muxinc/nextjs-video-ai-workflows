"use client";

import { use } from "react";

import { PlayerContext } from "./player-context-value";

export function usePlayer() {
  const context = use(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return context;
}
