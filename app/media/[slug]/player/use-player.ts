"use client";

import { use } from "react";

import { PlayerContext } from "./context";

export function usePlayer() {
  const context = use(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }
  return context;
}
