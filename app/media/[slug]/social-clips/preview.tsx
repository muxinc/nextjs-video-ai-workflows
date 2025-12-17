"use client";

import { Player } from "@remotion/player";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill } from "remotion";

import { ASPECT_RATIO_CONFIG, getDurationInFrames, SOCIAL_CLIP_FPS } from "@/remotion/social-clip/constants";
import type { AspectRatio, CaptionCue, SocialClipProps } from "@/remotion/social-clip/constants";
import { SocialClipLandscape, SocialClipPortrait, SocialClipSquare } from "@/remotion/social-clip/index";

import type { ErrorFallback, PlayerRef, RenderLoading } from "@remotion/player";

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
  /** Initial frame to seek to on mount (for maintaining position across aspect ratio changes) */
  initialFrame?: number;
  /** Callback when frame updates (for tracking position across aspect ratio changes) */
  onFrameUpdate?: (frame: number) => void;
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
  initialFrame = 0,
  onFrameUpdate,
}: SocialClipPreviewProps) {
  const config = ASPECT_RATIO_CONFIG[aspectRatio];
  const Component = COMPOSITION_COMPONENTS[aspectRatio];
  const playerRef = useRef<PlayerRef>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  // Player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentFrame, setCurrentFrame] = useState(initialFrame);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(true); // Start muted for audio autoplay workaround
  const [isDraggingTimeline, setIsDraggingTimeline] = useState(false);
  const [isDraggingVolume, setIsDraggingVolume] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);

  // Calculate duration and player dimensions
  const durationInFrames = useMemo(
    () => getDurationInFrames(startTime, endTime),
    [startTime, endTime],
  );

  // Input props for the composition
  // We pass the ORIGINAL startTime so the Audio component can use startFrom to skip
  // to the correct position in the full audio file. Captions have original times
  // and the composition uses clipStartTime for proper lookup.
  const inputProps: SocialClipProps = useMemo(
    () => ({
      audioUrl,
      startTime, // Original clip start - used for audio startFrom offset
      endTime, // Original clip end
      title,
      captions, // Original times - composition handles offset via clipStartTime
    }),
    [audioUrl, startTime, endTime, title, captions],
  );

  // Calculate preview dimensions
  const previewWidth = aspectRatio === "landscape" ? 400 : aspectRatio === "square" ? 300 : 220;
  const previewHeight = Math.round(previewWidth * (config.height / config.width));

  // Progress as percentage
  const progressPercent = durationInFrames > 0 ? (currentFrame / durationInFrames) * 100 : 0;

  // Format time display
  const formatTime = useCallback((frame: number) => {
    const seconds = frame / SOCIAL_CLIP_FPS;
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }, []);

  // Audio autoplay workaround: mute on mount, then unmute after a short delay
  // This tricks browsers into allowing audio playback
  // Also seek to initial frame if provided (for maintaining position across aspect ratio changes)
  useEffect(() => {
    const player = playerRef.current;
    if (!player || isAudioReady) {
      return;
    }

    // Small delay to ensure player is fully mounted
    const timer = setTimeout(() => {
      // Seek to initial frame if provided
      if (initialFrame > 0) {
        player.seekTo(initialFrame);
      }
      player.unmute();
      setIsMuted(false);
      setIsAudioReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [isAudioReady, initialFrame]);

  // Set up event listeners for player state
  useEffect(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => setIsPlaying(false);
    const handleFrameUpdate = (e: { detail: { frame: number } }) => {
      if (!isDraggingTimeline) {
        setCurrentFrame(e.detail.frame);
        onFrameUpdate?.(e.detail.frame);
      }
    };
    const handleVolumeChange = (e: { detail: { volume: number } }) => {
      if (!isDraggingVolume) {
        setVolume(e.detail.volume);
      }
    };
    const handleMuteChange = (e: { detail: { isMuted: boolean } }) => {
      setIsMuted(e.detail.isMuted);
    };

    player.addEventListener("play", handlePlay);
    player.addEventListener("pause", handlePause);
    player.addEventListener("ended", handleEnded);
    player.addEventListener("frameupdate", handleFrameUpdate);
    player.addEventListener("volumechange", handleVolumeChange);
    player.addEventListener("mutechange", handleMuteChange);

    return () => {
      player.removeEventListener("play", handlePlay);
      player.removeEventListener("pause", handlePause);
      player.removeEventListener("ended", handleEnded);
      player.removeEventListener("frameupdate", handleFrameUpdate);
      player.removeEventListener("volumechange", handleVolumeChange);
      player.removeEventListener("mutechange", handleMuteChange);
    };
  }, [isDraggingTimeline, isDraggingVolume, onFrameUpdate]);

  // Toggle play/pause
  const handleTogglePlay = useCallback(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    if (isPlaying) {
      player.pause();
    } else {
      // If at end, restart from beginning
      if (currentFrame >= durationInFrames - 1) {
        player.seekTo(0);
      }
      player.play();
    }
  }, [isPlaying, currentFrame, durationInFrames]);

  // Calculate frame from mouse position on timeline
  const getFrameFromTimelinePosition = useCallback((clientX: number) => {
    const timeline = timelineRef.current;
    if (!timeline) {
      return 0;
    }
    const rect = timeline.getBoundingClientRect();
    const x = clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    return Math.round(percent * durationInFrames);
  }, [durationInFrames]);

  // Handle timeline scrubbing
  const handleTimelineMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const player = playerRef.current;
    if (!player) {
      return;
    }

    setIsDraggingTimeline(true);

    // Initial seek
    const frame = getFrameFromTimelinePosition(e.clientX);
    player.seekTo(frame);
    setCurrentFrame(frame);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const newFrame = getFrameFromTimelinePosition(moveEvent.clientX);
      player.seekTo(newFrame);
      setCurrentFrame(newFrame);
    };

    const handleMouseUp = () => {
      setIsDraggingTimeline(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [getFrameFromTimelinePosition]);

  // Calculate volume from mouse position
  const getVolumeFromPosition = useCallback((clientX: number) => {
    const volumeTrack = volumeRef.current;
    if (!volumeTrack) {
      return 1;
    }
    const rect = volumeTrack.getBoundingClientRect();
    const x = clientX - rect.left;
    return Math.max(0, Math.min(1, x / rect.width));
  }, []);

  // Handle volume slider
  const handleVolumeMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const player = playerRef.current;
    if (!player) {
      return;
    }

    setIsDraggingVolume(true);

    // Initial volume set
    const newVolume = getVolumeFromPosition(e.clientX);
    player.setVolume(newVolume);
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      player.unmute();
    }

    const handleMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const vol = getVolumeFromPosition(moveEvent.clientX);
      player.setVolume(vol);
      setVolume(vol);
      if (vol > 0 && isMuted) {
        player.unmute();
      }
    };

    const handleMouseUp = () => {
      setIsDraggingVolume(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }, [getVolumeFromPosition, isMuted]);

  // Toggle mute
  const handleToggleMute = useCallback(() => {
    const player = playerRef.current;
    if (!player) {
      return;
    }

    if (isMuted) {
      player.unmute();
    } else {
      player.mute();
    }
  }, [isMuted]);

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
    <div className={`flex flex-col ${className}`} style={{ width: previewWidth }}>
      {/* Video container with click-to-play */}
      <div
        className="group relative cursor-pointer overflow-hidden border-2 border-border bg-[#1a1a1a]"
        style={{ height: previewHeight }}
        onClick={handleTogglePlay}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            handleTogglePlay();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={isPlaying ? "Pause video" : "Play video"}
      >
        <Player
          ref={playerRef}
          component={Component}
          inputProps={inputProps}
          durationInFrames={durationInFrames}
          compositionWidth={config.width}
          compositionHeight={config.height}
          fps={SOCIAL_CLIP_FPS}
          initiallyMuted
          renderLoading={renderLoading}
          errorFallback={errorFallback}
          style={{
            width: "100%",
            height: "100%",
          }}
        />

        {/* Play/Pause overlay indicator */}
        <div
          className={`pointer-events-none absolute inset-0 flex items-center justify-center transition-opacity duration-150 ${
            isPlaying ? "opacity-0 group-hover:opacity-100" : "opacity-100"
          }`}
        >
          <div className="flex h-12 w-12 items-center justify-center border-2 border-white bg-black/70 shadow-[2px_2px_0_rgba(0,0,0,0.8)]">
            {isPlaying ?
                (
                  // Pause icon
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="text-white"
                  >
                    <rect x="3" y="2" width="4" height="12" fill="currentColor" />
                    <rect x="9" y="2" width="4" height="12" fill="currentColor" />
                  </svg>
                ) :
                (
                  // Play icon
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    className="ml-1 text-white"
                  >
                    <path d="M4 2L14 8L4 14V2Z" fill="currentColor" />
                  </svg>
                )}
          </div>
        </div>
      </div>

      {/* Controls bar */}
      <div className="border-x-2 border-b-2 border-border bg-[#1a1a1a] p-2">
        {/* Time display */}
        <div
          className="mb-1.5 flex justify-between text-[9px] text-white/60"
          style={{ fontFamily: "var(--font-space-mono)" }}
        >
          <span>{formatTime(currentFrame)}</span>
          <span>{formatTime(durationInFrames)}</span>
        </div>

        {/* Timeline scrubber track */}
        <div
          ref={timelineRef}
          className="group relative h-3 cursor-pointer border-2 border-white/30 bg-white/10"
          onMouseDown={handleTimelineMouseDown}
          role="slider"
          aria-label="Video timeline"
          aria-valuemin={0}
          aria-valuemax={durationInFrames}
          aria-valuenow={currentFrame}
          tabIndex={0}
          onKeyDown={(e) => {
            const player = playerRef.current;
            if (!player) {
              return;
            }

            let newFrame = currentFrame;
            if (e.key === "ArrowLeft") {
              newFrame = Math.max(0, currentFrame - SOCIAL_CLIP_FPS);
            } else if (e.key === "ArrowRight") {
              newFrame = Math.min(durationInFrames, currentFrame + SOCIAL_CLIP_FPS);
            }
            if (newFrame !== currentFrame) {
              player.seekTo(newFrame);
              setCurrentFrame(newFrame);
            }
          }}
        >
          {/* Progress fill */}
          <div
            className="pointer-events-none absolute inset-y-0 left-0 bg-accent"
            style={{ width: `${progressPercent}%` }}
          />

          {/* Scrubber handle */}
          <div
            className="pointer-events-none absolute top-1/2 h-4 w-2 -translate-y-1/2 border-2 border-white bg-accent shadow-[1px_1px_0_rgba(0,0,0,0.8)] transition-transform group-hover:scale-110"
            style={{ left: `calc(${progressPercent}% - 4px)` }}
          />
        </div>

        {/* Volume control */}
        <div className="mt-2 flex items-center gap-2">
          {/* Mute button */}
          <button
            type="button"
            onClick={handleToggleMute}
            className="flex h-5 w-5 shrink-0 items-center justify-center border border-white/30 bg-white/10 text-white/60 transition-colors hover:border-white/50 hover:text-white"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ?
                (
                  // Muted icon
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2L4 6H1V10H4L8 14V2Z" fill="currentColor" />
                    <path d="M12 5L15 8M15 5L12 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" />
                  </svg>
                ) :
                (
                  // Volume icon
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <path d="M8 2L4 6H1V10H4L8 14V2Z" fill="currentColor" />
                    <path
                      d="M11 5.5C11.8 6.3 12 7.1 12 8C12 8.9 11.8 9.7 11 10.5"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="square"
                    />
                  </svg>
                )}
          </button>

          {/* Volume slider */}
          <div
            ref={volumeRef}
            className="group relative h-2 flex-1 cursor-pointer border border-white/30 bg-white/10"
            onMouseDown={handleVolumeMouseDown}
            role="slider"
            aria-label="Volume"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(volume * 100)}
            tabIndex={0}
            onKeyDown={(e) => {
              const player = playerRef.current;
              if (!player) {
                return;
              }

              let newVolume = volume;
              if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                newVolume = Math.max(0, volume - 0.1);
              } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                newVolume = Math.min(1, volume + 0.1);
              }
              if (newVolume !== volume) {
                player.setVolume(newVolume);
                setVolume(newVolume);
                if (newVolume > 0 && isMuted) {
                  player.unmute();
                }
              }
            }}
          >
            {/* Volume fill */}
            <div
              className="pointer-events-none absolute inset-y-0 left-0 bg-white/60"
              style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
            />

            {/* Volume handle */}
            <div
              className="pointer-events-none absolute top-1/2 h-3 w-1.5 -translate-y-1/2 border border-white bg-white/80 shadow-[1px_1px_0_rgba(0,0,0,0.6)] transition-transform group-hover:scale-110"
              style={{ left: `calc(${(isMuted ? 0 : volume) * 100}% - 3px)` }}
            />
          </div>

          {/* Volume percentage */}
          <span
            className="w-7 shrink-0 text-right text-[8px] text-white/50"
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            {isMuted ? 0 : Math.round(volume * 100)}
          </span>
        </div>
      </div>
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

// Calculate preview dimensions for a given aspect ratio
function getPreviewDimensions(aspectRatio: AspectRatio) {
  const config = ASPECT_RATIO_CONFIG[aspectRatio];
  const previewWidth = aspectRatio === "landscape" ? 400 : aspectRatio === "square" ? 300 : 220;
  const previewHeight = Math.round(previewWidth * (config.height / config.width));
  // Add height for controls bar (approx 72px: padding + time display + timeline + volume)
  const controlsHeight = 72;
  return { width: previewWidth, height: previewHeight + controlsHeight };
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

  // Track current frame across aspect ratio changes using a ref to avoid re-renders
  const currentFrameRef = useRef(0);

  const handleFrameUpdate = useCallback((frame: number) => {
    currentFrameRef.current = frame;
  }, []);

  // Get dimensions for animation
  const { width: targetWidth, height: targetHeight } = getPreviewDimensions(selectedAspectRatio);

  return (
    <div className="space-y-4">
      {/* Animated container for smooth size transitions */}
      <motion.div
        className="flex justify-center"
        animate={{
          height: targetHeight,
        }}
        transition={{
          height: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={selectedAspectRatio}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{ width: targetWidth }}
          >
            <SocialClipPreview
              audioUrl={audioUrl}
              startTime={startTime}
              endTime={endTime}
              title={title}
              captions={captions}
              aspectRatio={selectedAspectRatio}
              initialFrame={currentFrameRef.current}
              onFrameUpdate={handleFrameUpdate}
            />
          </motion.div>
        </AnimatePresence>
      </motion.div>

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
