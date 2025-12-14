"use client";

import { Level1SummaryAndTags } from "./level-1-summary";
import { PlayerProvider } from "./player-context-provider";
import { SyncedTranscript } from "./synced-transcript";
import { VideoPlayer } from "./video-player";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TranscriptCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

interface MediaContentProps {
  playbackId: string;
  muxAssetId: string;
  title: string;
  transcriptCues: TranscriptCue[];
}

// ─────────────────────────────────────────────────────────────────────────────
// AI Processors Panel Component
// ─────────────────────────────────────────────────────────────────────────────

function WorkflowsPanel({ assetId }: { assetId: string }) {
  return (
    <aside className="panel-brutal" aria-label="Workflows">
      {/* Panel Header with stripes */}
      <div className="stripes-accent panel-brutal-header text-foreground">
        <h2 style={{ fontFamily: "var(--font-syne)" }}>WORKFLOWS</h2>
      </div>

      {/* Level 1: Smart Summary */}
      <section className="panel-section" aria-labelledby="smart-summary-heading">
        <div className="panel-section-header" style={{ fontFamily: "var(--font-space-mono)" }}>
          <h3 id="smart-summary-heading" className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 border border-border bg-[#ffb202]" />
            SMART SUMMARY
            <span className="ml-auto text-[9px] text-foreground-muted">LVL 1</span>
          </h3>
        </div>
        <div className="p-4">
          <Level1SummaryAndTags assetId={assetId} />
        </div>
      </section>

      {/* Level 2: Localization */}
      <section className="panel-section" aria-labelledby="localization-heading">
        <div className="panel-section-header" style={{ fontFamily: "var(--font-space-mono)" }}>
          <h3 id="localization-heading" className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 border border-border bg-[#1c65be]" />
            LOCALIZATION
            <span className="ml-auto text-[9px] text-foreground-muted">LVL 2</span>
          </h3>
        </div>
        <div className="hatched p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold" style={{ fontFamily: "var(--font-syne)" }}>
                Translate Captions & Audio
              </p>
              <p className="mt-1 text-xs text-foreground-muted">
                Async workflow • Coming soon
              </p>
            </div>
            <div className="stripes-dark flex h-10 w-10 shrink-0 items-center justify-center border-2 border-border">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="square" strokeLinejoin="miter" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Level 3: Social Clips */}
      <section className="panel-section" aria-labelledby="social-clips-heading">
        <div className="panel-section-header" style={{ fontFamily: "var(--font-space-mono)" }}>
          <h3 id="social-clips-heading" className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 border border-border bg-[#22903d]" />
            SOCIAL CLIPS
            <span className="ml-auto text-[9px] text-foreground-muted">LVL 3</span>
          </h3>
        </div>
        <div className="hatched p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold" style={{ fontFamily: "var(--font-syne)" }}>
                Create Social Clip
              </p>
              <p className="mt-1 text-xs text-foreground-muted">
                Custom workflow • Coming soon
              </p>
            </div>
            <div className="stripes-dark flex h-10 w-10 shrink-0 items-center justify-center border-2 border-border">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="square" strokeLinejoin="miter" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>
      </section>
    </aside>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function MediaContent({
  playbackId,
  muxAssetId,
  title,
  transcriptCues,
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
          <WorkflowsPanel assetId={muxAssetId} />
        </div>
      </div>
    </PlayerProvider>
  );
}
