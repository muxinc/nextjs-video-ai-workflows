"use client";

import { Player } from "@remotion/player";
import { useCallback, useMemo, useState } from "react";
import { AbsoluteFill } from "remotion";

import type { AspectRatio, CaptionCue, SocialClipProps } from "@/remotion/social-clip/constants";
import { ASPECT_RATIO_CONFIG, getDurationInFrames, SOCIAL_CLIP_FPS } from "@/remotion/social-clip/constants";
import { SocialClipLandscape, SocialClipPortrait, SocialClipSquare } from "@/remotion/social-clip/index";

import type { ErrorFallback, RenderLoading } from "@remotion/player";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SocialClipPreviewProps {
  /** Instant clip audio URL (from Mux instant clipping) */
  audioUrl: string;
  /** Clip start time in the original video (seconds) */
  startTime: number;
  /** Clip end time in the original video (seconds) */
  endTime: number;
  /** Optional title overlay */
  title?: string;
  /** Captions for burnt-in subtitles */
  captions: CaptionCue[];
  /** Which aspect ratio to preview */
  aspectRatio: AspectRatio;
  /** Optional class name for the container */
  className?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component Map
// ─────────────────────────────────────────────────────────────────────────────

const COMPOSITION_COMPONENTS: Record<AspectRatio, React.FC<SocialClipProps>> = {
  portrait: SocialClipPortrait,
  square: SocialClipSquare,
  landscape: SocialClipLandscape,
};

// ─────────────────────────────────────────────────────────────────────────────
// Social Clip Preview Component
// ─────────────────────────────────────────────────────────────────────────────

export function SocialClipPreview({
  audioUrl,
  startTime,
  endTime,
  title,
  captions,
  aspectRatio,
  className = "",
}: SocialClipPreviewProps) {
  const config = ASPECT_RATIO_CONFIG[aspectRatio];
  const Component = COMPOSITION_COMPONENTS[aspectRatio];

  // Calculate duration and player dimensions
  const durationInFrames = useMemo(
    () => getDurationInFrames(startTime, endTime),
    [startTime, endTime],
  );

  // Input props for the composition
  // For preview, we pass startTime=0 because the instant clip URL already handles the offset
  const inputProps: SocialClipProps = useMemo(
    () => ({
      audioUrl,
      startTime: 0, // Audio is already clipped, so composition starts at 0
      endTime: endTime - startTime, // Duration of the clip
      title,
      // Adjust caption times relative to clip start
      captions: captions.map(cue => ({
        ...cue,
        startTime: cue.startTime - startTime,
        endTime: cue.endTime - startTime,
      })),
    }),
    [audioUrl, startTime, endTime, title, captions],
  );

  // Calculate preview dimensions
  const previewWidth = aspectRatio === "landscape" ? 400 : aspectRatio === "square" ? 300 : 220;
  const previewHeight = Math.round(previewWidth * (config.height / config.width));

  // Loading state renderer for Remotion Player
  const renderLoading: RenderLoading = useCallback(
    () => (
      <AbsoluteFill style={{ backgroundColor: "#1a1a1a" }}>
        <div className="flex h-full w-full flex-col items-center justify-center gap-2">
          <span className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-[#FF6101] border-t-transparent" />
          <span
            className="text-[10px] text-white/60"
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            Loading preview...
          </span>
        </div>
      </AbsoluteFill>
    ),
    [],
  );

  // Error fallback for Remotion Player
  const errorFallback: ErrorFallback = useCallback(
    ({ error }) => (
      <AbsoluteFill
        style={{
          backgroundColor: "#1a1a1a",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}
      >
        <div className="text-center">
          <span className="mb-2 block text-2xl">⚠️</span>
          <span
            className="block text-[11px] text-white/80"
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            Preview error:
            {" "}
            {error.message}
          </span>
        </div>
      </AbsoluteFill>
    ),
    [],
  );

  return (
    <div
      className={`relative overflow-hidden border-2 border-border bg-[#1a1a1a] ${className}`}
      style={{
        width: previewWidth,
        height: previewHeight,
      }}
    >
      <Player
        component={Component}
        inputProps={inputProps}
        durationInFrames={durationInFrames}
        compositionWidth={config.width}
        compositionHeight={config.height}
        fps={SOCIAL_CLIP_FPS}
        controls
        renderLoading={renderLoading}
        errorFallback={errorFallback}
        style={{
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-Aspect Preview Grid
// ─────────────────────────────────────────────────────────────────────────────

export interface MultiAspectPreviewProps {
  /** Instant clip audio URL */
  audioUrl: string;
  /** Clip start time (seconds) */
  startTime: number;
  /** Clip end time (seconds) */
  endTime: number;
  /** Optional title */
  title?: string;
  /** Captions */
  captions: CaptionCue[];
  /** Selected aspect ratio for focused preview */
  selectedAspectRatio: AspectRatio;
  /** Callback when aspect ratio is selected */
  onSelectAspectRatio: (ar: AspectRatio) => void;
}

export function MultiAspectPreview({
  audioUrl,
  startTime,
  endTime,
  title,
  captions,
  selectedAspectRatio,
  onSelectAspectRatio,
}: MultiAspectPreviewProps) {
  const aspectRatios: AspectRatio[] = ["portrait", "square", "landscape"];

  return (
    <div className="space-y-4">
      {/* Main Preview */}
      <div className="flex justify-center">
        <SocialClipPreview
          audioUrl={audioUrl}
          startTime={startTime}
          endTime={endTime}
          title={title}
          captions={captions}
          aspectRatio={selectedAspectRatio}
        />
      </div>

      {/* Aspect Ratio Selector */}
      <div className="flex items-center justify-center gap-2">
        {aspectRatios.map((ar) => {
          const config = ASPECT_RATIO_CONFIG[ar];
          const isSelected = ar === selectedAspectRatio;

          return (
            <button
              key={ar}
              type="button"
              onClick={() => onSelectAspectRatio(ar)}
              className={`flex flex-col items-center gap-1 border-2 p-2 transition-colors ${isSelected ?
                "border-accent bg-accent/10" :
                "border-border bg-surface-elevated hover:border-foreground-muted"
              }`}
            >
              {/* Aspect ratio icon */}
              <div
                className={`border-2 ${isSelected ? "border-accent bg-accent" : "border-border bg-[#1a1a1a]"}`}
                style={{
                  width: ar === "landscape" ? 32 : ar === "square" ? 24 : 18,
                  height: ar === "portrait" ? 32 : ar === "square" ? 24 : 18,
                }}
              />
              <span
                className={`text-[9px] font-bold uppercase tracking-wide ${
                  isSelected ? "text-accent" : "text-foreground-muted"
                }`}
                style={{ fontFamily: "var(--font-space-mono)" }}
              >
                {config.label.split(" ")[0]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Aspect Ratio Tabs with Individual Players
// ─────────────────────────────────────────────────────────────────────────────

export interface AspectRatioTabsProps {
  audioUrl: string;
  startTime: number;
  endTime: number;
  title?: string;
  captions: CaptionCue[];
}

export function AspectRatioTabs({
  audioUrl,
  startTime,
  endTime,
  title,
  captions,
}: AspectRatioTabsProps) {
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>("portrait");

  const handleSelect = useCallback((ar: AspectRatio) => {
    setSelectedAspectRatio(ar);
  }, []);

  return (
    <MultiAspectPreview
      audioUrl={audioUrl}
      startTime={startTime}
      endTime={endTime}
      title={title}
      captions={captions}
      selectedAspectRatio={selectedAspectRatio}
      onSelectAspectRatio={handleSelect}
    />
  );
}
