"use client";

import type { TranscriptCue } from "@/app/media/types";

import { TranscriptPanel } from "./transcript-panel";
import { usePlayer } from "./use-player";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SyncedTranscriptProps {
  cues: TranscriptCue[];
  muxAssetId: string;
  title?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function SyncedTranscript({ cues, muxAssetId, title }: SyncedTranscriptProps) {
  const { currentTime, seekTo } = usePlayer();

  if (cues.length === 0) {
    return null;
  }

  return (
    <TranscriptPanel
      cues={cues}
      currentTime={currentTime}
      onSeek={seekTo}
      muxAssetId={muxAssetId}
      title={title}
    />
  );
}
