"use client";

import { usePlayer } from "./player-context";
import { TranscriptPanel } from "./transcript-panel";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TranscriptCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

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

