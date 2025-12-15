"use client";

import type { TranscriptCue } from "@/app/media/types";

import { PlayerProvider } from "./player/provider";
import { VideoPlayer } from "./player/ui";
import { SyncedTranscript } from "./transcript/ui";
import { WorkflowsPanel } from "./workflows-panel/ui";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface MediaContentProps {
  playbackId: string;
  playbackPolicy: "public" | "signed";
  muxAssetId: string;
  title: string;
  transcriptCues: TranscriptCue[];
  hasElevenLabsKey: boolean;
  hasRemotionLambdaKeys: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function MediaContent({
  playbackId,
  playbackPolicy,
  muxAssetId,
  title,
  transcriptCues,
  hasElevenLabsKey,
  hasRemotionLambdaKeys,
}: MediaContentProps) {
  return (
    <PlayerProvider>
      {/* Two-column layout */}
      <div className="grid grid-cols-1 items-start gap-6 md:grid-cols-[1.2fr_1fr] lg:grid-cols-[1.3fr_1fr] xl:grid-cols-[1.4fr_1fr]">
        {/* Left Column: Video + Transcript (with title) */}
        <div className="space-y-6">
          {/* Video Player */}
          <div className="panel-brutal overflow-hidden">
            <VideoPlayer
              playbackId={playbackId}
              title={title}
              accentColor="#ff6101"
            />
          </div>

          {/* Transcript Panel (with title as header) */}
          {transcriptCues.length > 0 && (
            <SyncedTranscript
              cues={transcriptCues}
              muxAssetId={muxAssetId}
              title={title}
            />
          )}
        </div>

        {/* Right Column: Workflows Panel (sticky on desktop) */}
        <div className="md:sticky md:top-6">
          <WorkflowsPanel
            assetId={muxAssetId}
            playbackId={playbackId}
            playbackPolicy={playbackPolicy}
            transcriptCues={transcriptCues}
            title={title}
            hasElevenLabsKey={hasElevenLabsKey}
            hasRemotionLambdaKeys={hasRemotionLambdaKeys}
          />
        </div>
      </div>
    </PlayerProvider>
  );
}
