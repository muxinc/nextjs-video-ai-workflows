"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo } from "react";

import { useRendering } from "@/app/lib/remotion/use-rendering";
import { DEFAULT_COMPOSITION_ID } from "@/remotion/default-composition/constants";

import type { WorkflowStatus } from "../../types";
import { StatusBadge, StepProgress } from "../workflows-panel/ui";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

type RenderStepId = "invoking" | "rendering" | "finalizing";

const RENDER_STEPS: readonly { id: RenderStepId; label: string }[] = [
  { id: "invoking", label: "Starting render" },
  { id: "rendering", label: "Rendering video" },
  { id: "finalizing", label: "Finalizing output" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function mapRenderStateToWorkflowStatus(status: string): WorkflowStatus {
  switch (status) {
    case "init":
      return "idle";
    case "invoking":
      return "starting";
    case "rendering":
      return "running";
    case "done":
      return "completed";
    case "error":
      return "failed";
    default:
      return "idle";
  }
}

function getCompletedSteps(status: string, progress: number): RenderStepId[] {
  switch (status) {
    case "invoking":
      return [];
    case "rendering":
      // Mark "invoking" as complete, and if progress is high enough, mark "rendering" too
      if (progress >= 0.95) {
        return ["invoking", "rendering"];
      }
      return ["invoking"];
    case "done":
      return ["invoking", "rendering", "finalizing"];
    default:
      return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Render Component
// ─────────────────────────────────────────────────────────────────────────────

export function Layer3SocialClips({ assetId }: { assetId: string }) {
  const inputProps = { title: "Hello friend" };
  const fileName = `test-render-${assetId}.mp4`;
  const shouldReduceMotion = useReducedMotion();

  const { renderMedia, state, undo } = useRendering(
    DEFAULT_COMPOSITION_ID,
    inputProps,
    fileName,
  );

  const workflowStatus = mapRenderStateToWorkflowStatus(state.status);
  const isRunning = state.status === "invoking" || state.status === "rendering";
  const isWorking = isRunning;

  const completedSteps = useMemo(() => {
    const progress = state.status === "rendering" ? state.progress : 0;
    return getCompletedSteps(state.status, progress);
  }, [state]);

  const showSteps = isRunning || completedSteps.length > 0;

  return (
    <div className="space-y-4">
      {/* Header row with status badge */}
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted"
          style={{ fontFamily: "var(--font-space-mono)" }}
        >
          Video Render
        </span>
        <StatusBadge status={workflowStatus} />
      </div>

      {/* Action Button */}
      {state.status !== "done" && (
        <button
          type="button"
          className="btn-action w-full"
          onClick={renderMedia}
          disabled={isWorking}
        >
          {isWorking ?
              (
                <>
                  <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {state.status === "invoking" ?
                    "QUEUING..." :
                    `RENDERING ${Math.round((state.status === "rendering" ? state.progress : 0) * 100)}%`}
                </>
              ) :
              (
                <>
                  [TEST RENDER]
                  <span className="arrow-icon ml-2">↗</span>
                </>
              )}
        </button>
      )}

      {/* Step Progress */}
      <AnimatePresence initial={false}>
        {showSteps && (
          <motion.div
            key="render-progress"
            className="border-2 border-border bg-surface-elevated"
            initial={shouldReduceMotion ? false : { height: 0, opacity: 0, y: -4 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0, y: -4 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" }}
          >
            <div className="p-3">
              <StepProgress
                steps={RENDER_STEPS}
                completedSteps={completedSteps}
                isRunning={isRunning}
                shouldReduceMotion={shouldReduceMotion}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      {state.status === "error" && (
        <div className="border-2 border-[#dc2626] bg-[#fde8e8] p-2 text-xs text-[#dc2626]">
          {state.error.message}
        </div>
      )}

      {/* Success State */}
      {state.status === "done" && (
        <>
          <div className="border-2 border-[#22903d] bg-[#e9f5ec] p-2 text-xs text-[#22903d]">
            ✓ Render complete. Ready to download.
          </div>

          <div className="flex gap-2">
            <a
              href={state.url}
              download={fileName}
              className="btn-action flex-1 text-center"
            >
              DOWNLOAD (
              {(state.size / 1024 / 1024).toFixed(2)}
              {" "}
              MB)
              <span className="arrow-icon ml-2">↓</span>
            </a>
            <button
              type="button"
              onClick={undo}
              className="btn-action bg-surface-elevated text-foreground hover:bg-surface"
            >
              [RESET]
            </button>
          </div>
        </>
      )}

      {/* Reset button for error state */}
      {state.status === "error" && (
        <button
          type="button"
          onClick={undo}
          className="btn-action w-full bg-surface-elevated text-foreground hover:bg-surface"
        >
          [TRY AGAIN]
        </button>
      )}

      {/* Info text */}
      <p className="text-[10px] text-foreground-muted" style={{ fontFamily: "var(--font-space-mono)" }}>
        Test render uses Remotion Lambda to generate video.
      </p>
    </div>
  );
}
