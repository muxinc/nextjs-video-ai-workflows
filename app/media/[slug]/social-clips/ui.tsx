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
import { DEFAULT_COMPOSITION_ID } from "@/remotion/default-composition/constants";

import type { WorkflowStatus } from "../../types";
import { StatusBadge, StepProgress } from "../workflows-panel/ui";

import type { RenderStepId, RenderVideoResult } from "./actions";
import { pollRenderWorkflowAction, startRenderWorkflowAction } from "./actions";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const POLL_INTERVAL = 1500;

const RENDER_STEPS: readonly { id: RenderStepId; label: string }[] = [
  { id: "prepare", label: "Preparing render" },
  { id: "render", label: "Rendering video" },
  { id: "finalize", label: "Finalizing output" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Test Render Component
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_INPUT_PROPS = { title: "Hello friend" };

export function Layer3SocialClips({ assetId }: { assetId: string }) {
  const fileName = `test-render-${assetId}.mp4`;
  const shouldReduceMotion = useReducedMotion();

  const [workflowState, setWorkflowState] = useState<{
    status: WorkflowStatus;
    completedSteps: RenderStepId[];
    runId?: string;
    error?: string;
    result?: RenderVideoResult;
    renderProgress?: number;
  }>(() => {
    if (typeof window === "undefined") {
      return { status: "idle", completedSteps: [] };
    }
    const stored = getWorkflowProgress(assetId, "renderVideo");
    if (stored && (stored.status === "queued" || stored.status === "running")) {
      // Check for stale localStorage entries (> 30 min old)
      const startedAtMs = Date.parse(stored.startedAt);
      const ageMs = Number.isFinite(startedAtMs) ? Date.now() - startedAtMs : Number.POSITIVE_INFINITY;
      const staleAfterMs = 30 * 60 * 1000;
      if (ageMs > staleAfterMs) {
        return { status: "idle", completedSteps: [] };
      }
      return { status: "starting", completedSteps: [], runId: stored.workflowRunId };
    }
    return { status: "idle", completedSteps: [] };
  });

  const [isPending, startTransition] = useTransition();

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamIndexRef = useRef(0);
  const isPollInFlightRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollStatus = useCallback(async (runId: string) => {
    if (isPollInFlightRef.current) {
      return;
    }
    isPollInFlightRef.current = true;

    try {
      const result = await pollRenderWorkflowAction(runId, streamIndexRef.current);
      streamIndexRef.current = result.nextIndex;

      if (result.status === "completed" || result.status === "failed") {
        stopPolling();
        if (result.status === "completed") {
          markWorkflowCompleted(assetId, "renderVideo", undefined);
        } else {
          markWorkflowFailed(assetId, "renderVideo", undefined, result.error || "Workflow failed.");
          clearWorkflowProgress(assetId, "renderVideo", undefined);
        }
        setWorkflowState(prev => ({
          ...prev,
          status: result.status,
          completedSteps: mergeSteps(prev.completedSteps, result.completedSteps),
          runId,
          error: result.error,
          result: result.result,
        }));
        return;
      }

      if (result.status === "running") {
        markWorkflowRunning(assetId, "renderVideo");
      }
      setWorkflowState(prev => ({
        ...prev,
        status: result.status,
        completedSteps: mergeSteps(prev.completedSteps, result.completedSteps),
        renderProgress: result.renderProgress ?? prev.renderProgress,
      }));
    } finally {
      isPollInFlightRef.current = false;
    }
  }, [assetId, stopPolling]);

  const startWorkflow = useCallback(() => {
    stopPolling();
    streamIndexRef.current = 0;
    setWorkflowState({ status: "starting", completedSteps: [] });

    startTransition(async () => {
      const result = await startRenderWorkflowAction({
        assetId,
        compositionId: DEFAULT_COMPOSITION_ID,
        inputProps: DEFAULT_INPUT_PROPS,
        fileName,
      });

      if (result.status === "failed" || !result.runId) {
        setWorkflowState({
          status: "failed",
          completedSteps: [],
          error: result.error,
        });
        return;
      }

      persistWorkflowStart(assetId, "renderVideo", undefined, result.runId);
      setWorkflowState({ status: "starting", completedSteps: [], runId: result.runId });

      pollRef.current = setInterval(() => {
        void pollStatus(result.runId);
      }, POLL_INTERVAL);

      void pollStatus(result.runId);
    });
  }, [assetId, fileName, pollStatus, stopPolling]);

  const resetWorkflow = useCallback(() => {
    clearWorkflowProgress(assetId, "renderVideo", undefined);
    setWorkflowState({ status: "idle", completedSteps: [] });
  }, [assetId]);

  // Cleanup polling on unmount
  useEffect(() => stopPolling, [stopPolling]);

  // Resume polling if we rehydrated an in-flight workflow from localStorage
  useEffect(() => {
    if (!workflowState.runId) {
      return;
    }

    if (pollRef.current) {
      return;
    }

    if (workflowState.status === "starting" || workflowState.status === "running") {
      pollRef.current = setInterval(() => {
        void pollStatus(workflowState.runId!);
      }, POLL_INTERVAL);
      void pollStatus(workflowState.runId);
      return () => {
        if (pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      };
    }
  }, [pollStatus, workflowState.runId, workflowState.status]);

  const isRunning = workflowState.status === "running" || workflowState.status === "starting";
  const isWorking = isPending || isRunning;
  const showSteps = isRunning || workflowState.completedSteps.length > 0;

  const buttonText = useMemo(() => {
    if (!isWorking) {
      return "[TEST RENDER]";
    }
    if (workflowState.status === "starting") {
      return "QUEUING...";
    }
    if (workflowState.renderProgress !== undefined) {
      return `RENDERING ${Math.round(workflowState.renderProgress * 100)}%`;
    }
    return "PROCESSING...";
  }, [isWorking, workflowState.status, workflowState.renderProgress]);

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
        <StatusBadge status={workflowState.status} />
      </div>

      {/* Action Button */}
      {workflowState.status !== "completed" && (
        <button
          type="button"
          className="btn-action w-full"
          onClick={startWorkflow}
          disabled={isWorking}
        >
          {isWorking && (
            <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
          )}
          {buttonText}
          {!isWorking && (
            <span className="arrow-icon ml-2">↗</span>
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
                completedSteps={workflowState.completedSteps}
                isRunning={isRunning}
                shouldReduceMotion={shouldReduceMotion}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Message */}
      {workflowState.status === "failed" && workflowState.error && (
        <div className="border-2 border-[#dc2626] bg-[#fde8e8] p-2 text-xs text-[#dc2626]">
          {workflowState.error}
        </div>
      )}

      {/* Success State */}
      {workflowState.status === "completed" && workflowState.result && (
        <>
          <div className="border-2 border-[#22903d] bg-[#e9f5ec] p-2 text-xs text-[#22903d]">
            ✓ Render complete. Ready to download.
          </div>

          <div className="flex gap-2">
            <a
              href={workflowState.result.url}
              download={fileName}
              className="btn-action flex-1 text-center"
            >
              DOWNLOAD (
              {(workflowState.result.size / 1024 / 1024).toFixed(2)}
              {" "}
              MB)
              <span className="arrow-icon ml-2">↓</span>
            </a>
            <button
              type="button"
              onClick={resetWorkflow}
              className="btn-action bg-surface-elevated text-foreground hover:bg-surface"
            >
              [RESET]
            </button>
          </div>
        </>
      )}

      {/* Reset button for error state */}
      {workflowState.status === "failed" && (
        <button
          type="button"
          onClick={resetWorkflow}
          className="btn-action w-full bg-surface-elevated text-foreground hover:bg-surface"
        >
          [TRY AGAIN]
        </button>
      )}

      {/* Info text */}
      <p className="text-[10px] text-foreground-muted" style={{ fontFamily: "var(--font-space-mono)" }}>
        Test render uses Remotion Lambda via durable workflow.
      </p>
    </div>
  );
}
