"use client";

import MuxPlayer from "@mux/mux-player-react";
import { useRef, useState } from "react";

import { TranscriptPanel } from "./transcript-panel";

import type MuxPlayerElement from "@mux/mux-player";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TranscriptCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

interface MediaPlayerWithTranscriptProps {
  playbackId: string;
  title: string;
  transcriptCues: TranscriptCue[];
  accentColor?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function MediaPlayerWithTranscript({
  playbackId,
  title,
  transcriptCues,
  accentColor = "#ff6101",
}: MediaPlayerWithTranscriptProps) {
  const playerRef = useRef<MuxPlayerElement>(null);
  const [currentTime, setCurrentTime] = useState(0);

  const handleSeek = (time: number) => {
    if (playerRef.current) {
      playerRef.current.currentTime = time;
      // Also start playing if paused
      if (playerRef.current.paused) {
        playerRef.current.play();
      }
    }
  };

  const handleTimeUpdate = () => {
    if (playerRef.current) {
      setCurrentTime(playerRef.current.currentTime);
    }
  };

  return (
    <div className="grid items-start gap-8 lg:grid-cols-2">
      {/* Video Player */}
      <div className="card-brutal overflow-hidden">
        <MuxPlayer
          ref={playerRef}
          playbackId={playbackId}
          metadata={{
            video_title: title,
          }}
          accentColor={accentColor}
          onTimeUpdate={handleTimeUpdate}
          style={{
            aspectRatio: "16 / 9",
            width: "100%",
          }}
        />
      </div>

      {/* Transcript Panel */}
      {transcriptCues.length > 0 && (
        <TranscriptPanel
          cues={transcriptCues}
          currentTime={currentTime}
          onSeek={handleSeek}
        />
      )}
    </div>
  );
}
