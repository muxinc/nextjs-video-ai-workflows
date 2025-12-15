"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  clearWorkflowProgress,
  getWorkflowProgress,
  markWorkflowCompleted,
  markWorkflowFailed,
  markWorkflowRunning,
  startWorkflow as persistWorkflowStart,
} from "@/app/lib/workflow-state";
import { mergeSteps } from "@/app/media/[slug]/workflows-panel/helpers";
import type { AspectRatio } from "@/remotion/social-clip/constants";
import { ASPECT_RATIO_CONFIG } from "@/remotion/social-clip/constants";

import type { TranscriptCue, WorkflowStatus } from "../../types";
import { CompletedStepIcon, CurrentStepIcon, PendingStepIcon, StatusBadge } from "../workflows-panel/ui";

import type { RenderStepId, RenderVideoResult, SocialClipInput } from "./actions";
import { pollSocialClipsRenderAction, startSocialClipsRenderAction } from "./actions";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const POLL_INTERVAL = 1500;

const RENDER_STEPS: readonly { id: RenderStepId; label: string }[] = [
  { id: "prepare", label: "Preparing" },
  { id: "render", label: "Rendering" },
  { id: "finalize", label: "Finalizing" },
] as const;

const ASPECT_RATIO_LABELS: Record<AspectRatio, string> = {
  portrait: "9:16",
  square: "1:1",
  landscape: "16:9",
};

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ClipState {
  status: WorkflowStatus;
  completedSteps: RenderStepId[];
  runId?: string;
  nextIndex: number;
  error?: string;
  result?: RenderVideoResult;
  renderProgress?: number;
}

interface Layer3SocialClipsProps {
  assetId: string;
  playbackId: string;
  playbackPolicy: "public" | "signed";
  transcriptCues: TranscriptCue[];
  title: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Get clip timing and captions from transcript cues
// ─────────────────────────────────────────────────────────────────────────────

interface ClipData {
  startTime: number;
  endTime: number;
  captions: TranscriptCue[];
}

function getClipDataFromCues(cues: TranscriptCue[]): ClipData {
  if (cues.length === 0) {
    // Default to first 15 seconds if no cues
    return { startTime: 0, endTime: 15, captions: [] };
  }

  // Use a segment from the middle of the video for interesting content
  // Take ~15 seconds worth of content from the first quarter of cues
  const quarterIndex = Math.floor(cues.length / 4);
  const startCue = cues[Math.max(0, quarterIndex)];
  const startTime = startCue.startTime;

  // Find end time ~15 seconds later
  const targetEndTime = startTime + 15;
  let endCue = startCue;
  for (const cue of cues.slice(quarterIndex)) {
    if (cue.endTime >= targetEndTime) {
      endCue = cue;
      break;
    }
    endCue = cue;
  }

  const endTime = Math.max(endCue.endTime, startTime + 5);

  // Filter captions to only include those within the clip time range
  const captions = cues.filter(
    cue => cue.startTime >= startTime && cue.endTime <= endTime,
  );

  return { startTime, endTime, captions };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mini Step Progress (compact for clip cards)
// ─────────────────────────────────────────────────────────────────────────────

function MiniStepProgress({
  completedSteps,
  isRunning,
  renderProgress,
  shouldReduceMotion,
}: {
  completedSteps: RenderStepId[];
  isRunning: boolean;
  renderProgress?: number;
  shouldReduceMotion: boolean | null;
}) {
  const currentStepIndex = completedSteps.length;

  return (
    <div className="flex items-center gap-1.5">
      {RENDER_STEPS.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = isRunning && index === currentStepIndex;

        let icon: React.ReactNode;
        let iconClassName: string;
        if (isCompleted) {
          icon = <CompletedStepIcon shouldReduceMotion={shouldReduceMotion} />;
          iconClassName = "text-[#22903d]";
        } else if (isCurrent) {
          icon = <CurrentStepIcon shouldReduceMotion={shouldReduceMotion} />;
          iconClassName = "text-[#1c65be]";
        } else {
          icon = <PendingStepIcon />;
          iconClassName = "text-foreground-muted";
        }

        return (
          <div
            key={step.id}
            className="relative"
            title={
              isCurrent && step.id === "render" && renderProgress !== undefined ?
                `${step.label}: ${Math.round(renderProgress * 100)}%` :
                step.label
            }
          >
            <span className={`flex h-4 w-4 items-center justify-center ${iconClassName}`}>
              {icon}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Clip Card Component
// ─────────────────────────────────────────────────────────────────────────────

function ClipCard({
  aspectRatio,
  state,
  shouldReduceMotion,
}: {
  aspectRatio: AspectRatio;
  state: ClipState;
  shouldReduceMotion: boolean | null;
}) {
  const config = ASPECT_RATIO_CONFIG[aspectRatio];
  const isRunning = state.status === "running" || state.status === "starting";
  const isCompleted = state.status === "completed";
  const isFailed = state.status === "failed";

  // Calculate aspect ratio for preview box
  const previewWidth = 48;
  const previewHeight = Math.round(previewWidth * (config.height / config.width));

  return (
    <motion.div
      className="flex items-center gap-3 border-2 border-border bg-surface-elevated p-2"
      initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: shouldReduceMotion ? 0 : 0.15 }}
    >
      {/* Aspect ratio preview box */}
      <div
        className="flex shrink-0 items-center justify-center border border-border bg-[#1a1a1a]"
        style={{
          width: previewWidth,
          height: Math.min(previewHeight, 64),
        }}
      >
        <span
          className="text-[9px] font-bold text-white/60"
          style={{ fontFamily: "var(--font-space-mono)" }}
        >
          {ASPECT_RATIO_LABELS[aspectRatio]}
        </span>
      </div>

      {/* Status area */}
      <div className="flex flex-1 flex-col gap-1">
        <span
          className="text-[10px] font-medium uppercase tracking-wide text-foreground-muted"
          style={{ fontFamily: "var(--font-space-mono)" }}
        >
          {config.label}
        </span>

        {/* Progress or status */}
        {isRunning && (
          <MiniStepProgress
            completedSteps={state.completedSteps}
            isRunning={isRunning}
            renderProgress={state.renderProgress}
            shouldReduceMotion={shouldReduceMotion}
          />
        )}

        {isFailed && state.error && (
          <span className="text-[10px] text-[#dc2626]">Error</span>
        )}
      </div>

      {/* Download button for completed clips */}
      {isCompleted && state.result && (
        <a
          href={state.result.url}
          download={`social-clip-${aspectRatio}.mp4`}
          className="flex h-8 w-8 items-center justify-center border-2 border-border bg-accent text-foreground transition-colors hover:bg-[#ff7f24]"
          title={`Download (${(state.result.size / 1024 / 1024).toFixed(1)} MB)`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="square" strokeLinejoin="miter" d="M19 14v5a2 2 0 01-2 2H7a2 2 0 01-2-2v-5M12 3v12m0 0l-4-4m4 4l4-4" />
          </svg>
        </a>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Social Clips Component
// ─────────────────────────────────────────────────────────────────────────────

export function Layer3SocialClips({ assetId, playbackId, playbackPolicy, transcriptCues, title }: Layer3SocialClipsProps) {
  const shouldReduceMotion = useReducedMotion();

  // Initialize clip states
  const initialClipStates = (): Record<AspectRatio, ClipState> => {
    const aspectRatios: AspectRatio[] = ["portrait", "square", "landscape"];
    const states: Record<AspectRatio, ClipState> = {} as Record<AspectRatio, ClipState>;

    for (const ar of aspectRatios) {
      let stored: ReturnType<typeof getWorkflowProgress> = null;
      if (typeof window !== "undefined") {
        stored = getWorkflowProgress(assetId, "socialClip", ar);
      }

      if (stored && (stored.status === "queued" || stored.status === "running")) {
        const startedAtMs = Date.parse(stored.startedAt);
        const ageMs = Number.isFinite(startedAtMs) ? Date.now() - startedAtMs : Number.POSITIVE_INFINITY;
        const staleAfterMs = 30 * 60 * 1000;

        if (ageMs <= staleAfterMs) {
          states[ar] = {
            status: "starting",
            completedSteps: [],
            runId: stored.workflowRunId,
            nextIndex: 0,
          };
          continue;
        }
      }

      states[ar] = { status: "idle", completedSteps: [], nextIndex: 0 };
    }

    return states;
  };

  const [clipStates, setClipStates] = useState<Record<AspectRatio, ClipState>>(initialClipStates);
  const [isPending, startTransition] = useTransition();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollInFlightRef = useRef(false);

  // Compute clip data (timing + captions) from transcript cues
  const clipData = useMemo(
    () => getClipDataFromCues(transcriptCues),
    [transcriptCues],
  );

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async () => {
    if (isPollInFlightRef.current) {
      return;
    }
    isPollInFlightRef.current = true;

    try {
      // Get clips that are still running
      const runningClips = (Object.entries(clipStates) as [AspectRatio, ClipState][])
        .filter(([, state]) => state.runId && (state.status === "running" || state.status === "starting"))
        .map(([ar, state]) => ({
          aspectRatio: ar,
          runId: state.runId!,
          nextIndex: state.nextIndex,
        }));

      if (runningClips.length === 0) {
        stopPolling();
        return;
      }

      const result = await pollSocialClipsRenderAction(runningClips);

      setClipStates((prev) => {
        const updated = { ...prev };
        for (const clipResult of result.clips) {
          const ar = clipResult.aspectRatio;
          const current = updated[ar];

          if (clipResult.status === "completed" || clipResult.status === "failed") {
            if (clipResult.status === "completed") {
              markWorkflowCompleted(assetId, "socialClip", ar);
            } else {
              markWorkflowFailed(assetId, "socialClip", ar, clipResult.error || "Workflow failed.");
              clearWorkflowProgress(assetId, "socialClip", ar);
            }
          } else if (clipResult.status === "running") {
            markWorkflowRunning(assetId, "socialClip", ar);
          }

          updated[ar] = {
            ...current,
            status: clipResult.status,
            completedSteps: mergeSteps(current.completedSteps, clipResult.completedSteps),
            nextIndex: clipResult.nextIndex,
            error: clipResult.error,
            result: clipResult.result,
            renderProgress: clipResult.renderProgress ?? current.renderProgress,
          };
        }
        return updated;
      });

      // Check if all clips are done
      const allDone = result.clips.every(c => c.status === "completed" || c.status === "failed");
      if (allDone) {
        stopPolling();
      }
    } finally {
      isPollInFlightRef.current = false;
    }
  }, [assetId, clipStates, stopPolling]);

  const startRender = useCallback(() => {
    stopPolling();

    // Reset all clips to starting state
    const aspectRatios: AspectRatio[] = ["portrait", "square", "landscape"];
    const resetStates: Record<AspectRatio, ClipState> = {} as Record<AspectRatio, ClipState>;
    for (const ar of aspectRatios) {
      resetStates[ar] = { status: "starting", completedSteps: [], nextIndex: 0 };
    }
    setClipStates(resetStates);

    startTransition(async () => {
      const clipInput: SocialClipInput = {
        playbackId,
        playbackPolicy,
        startTime: clipData.startTime,
        endTime: clipData.endTime,
        title,
        captions: clipData.captions,
      };

      const result = await startSocialClipsRenderAction({
        assetId,
        clip: clipInput,
      });

      // Update states with run IDs
      setClipStates((prev) => {
        const updated = { ...prev };
        for (const clipResult of result.clips) {
          const ar = clipResult.aspectRatio;
          if (clipResult.status === "failed") {
            updated[ar] = {
              status: "failed",
              completedSteps: [],
              nextIndex: 0,
              error: clipResult.error,
            };
          } else {
            persistWorkflowStart(assetId, "socialClip", ar, clipResult.runId);
            updated[ar] = {
              status: "starting",
              completedSteps: [],
              runId: clipResult.runId,
              nextIndex: 0,
            };
          }
        }
        return updated;
      });

      // Start polling
      pollRef.current = setInterval(() => {
        void pollStatus();
      }, POLL_INTERVAL);
      void pollStatus();
    });
  }, [assetId, playbackId, playbackPolicy, clipData, title, pollStatus, stopPolling]);

  const resetWorkflow = useCallback(() => {
    const aspectRatios: AspectRatio[] = ["portrait", "square", "landscape"];
    for (const ar of aspectRatios) {
      clearWorkflowProgress(assetId, "socialClip", ar);
    }
    const resetStates: Record<AspectRatio, ClipState> = {} as Record<AspectRatio, ClipState>;
    for (const ar of aspectRatios) {
      resetStates[ar] = { status: "idle", completedSteps: [], nextIndex: 0 };
    }
    setClipStates(resetStates);
  }, [assetId]);

  // Cleanup on unmount
  useEffect(() => stopPolling, [stopPolling]);

  // Resume polling for in-flight workflows
  useEffect(() => {
    const hasRunningClips = Object.values(clipStates).some(
      s => s.runId && (s.status === "starting" || s.status === "running"),
    );

    if (hasRunningClips && !pollRef.current) {
      pollRef.current = setInterval(() => {
        void pollStatus();
      }, POLL_INTERVAL);
      void pollStatus();
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [clipStates, pollStatus]);

  // Compute aggregate status
  const states = Object.values(clipStates);
  const anyRunning = states.some(s => s.status === "running" || s.status === "starting");
  const anyFailed = states.some(s => s.status === "failed");
  const allCompleted = states.every(s => s.status === "completed");
  const allIdle = states.every(s => s.status === "idle");

  const aggregateStatus: WorkflowStatus = anyRunning ?
    "running" :
    anyFailed ?
      "failed" :
      allCompleted ?
        "completed" :
        "idle";

  const isWorking = isPending || anyRunning;
  const showClipCards = anyRunning || allCompleted || anyFailed;

  // Format clip timing for display
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="space-y-4">
      {/* Header row with status badge */}
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted"
          style={{ fontFamily: "var(--font-space-mono)" }}
        >
          Social Clips
        </span>
        <StatusBadge status={aggregateStatus} />
      </div>

      {/* Clip timing info */}
      {!allIdle && (
        <div
          className="text-[10px] text-foreground-muted"
          style={{ fontFamily: "var(--font-space-mono)" }}
        >
          Clip:
          {" "}
          {formatTime(clipData.startTime)}
          {" → "}
          {formatTime(clipData.endTime)}
        </div>
      )}

      {/* Render Button */}
      {!allCompleted && (
        <button
          type="button"
          className="btn-action w-full"
          onClick={startRender}
          disabled={isWorking}
        >
          {isWorking && (
            <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
          {isWorking ? "RENDERING..." : "[RENDER VIDEOS]"}
          {!isWorking && (
            <span className="arrow-icon ml-2">↗</span>
          )}
        </button>
      )}

      {/* Clip Cards */}
      <AnimatePresence initial={false}>
        {showClipCards && (
          <motion.div
            className="space-y-2"
            initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" }}
          >
            {(["portrait", "square", "landscape"] as const).map(ar => (
              <ClipCard
                key={ar}
                aspectRatio={ar}
                state={clipStates[ar]}
                shouldReduceMotion={shouldReduceMotion}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success message */}
      {allCompleted && (
        <div className="border-2 border-[#22903d] bg-[#e9f5ec] p-2 text-xs text-[#22903d]">
          ✓ All clips rendered. Click icons to download.
        </div>
      )}

      {/* Error message */}
      {anyFailed && !anyRunning && (
        <div className="border-2 border-[#dc2626] bg-[#fde8e8] p-2 text-xs text-[#dc2626]">
          Some clips failed to render.
        </div>
      )}

      {/* Reset button */}
      {(allCompleted || (anyFailed && !anyRunning)) && (
        <button
          type="button"
          onClick={resetWorkflow}
          className="btn-action w-full bg-surface-elevated text-foreground hover:bg-surface"
        >
          {anyFailed ? "[TRY AGAIN]" : "[RESET]"}
        </button>
      )}

      {/* Info text */}
      <p className="text-[10px] text-foreground-muted" style={{ fontFamily: "var(--font-space-mono)" }}>
        Renders 3 aspect ratios for social sharing.
      </p>
    </div>
  );
}
