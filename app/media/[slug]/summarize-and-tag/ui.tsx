"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  clearWorkflowProgress,
  getWorkflowProgress,
  markWorkflowCompleted,
  markWorkflowFailed,
  markWorkflowRunning,
  startWorkflow as persistWorkflowStart,
} from "@/app/lib/workflow-state";
import { mergeSteps } from "@/app/media/[slug]/workflows-panel/helpers";
import type { SummaryStepId } from "@/workflows/get-summary-and-tags";

import { StatusBadge, StepProgress } from "../workflows-panel/ui";

import type { SummaryStatus, SummaryTone } from "./actions";
import { pollSummaryWorkflowAction, saveSummaryAndTagsAction, startSummaryWorkflowAction } from "./actions";
import { POLL_INTERVAL, SUMMARY_STEPS, TONE_OPTIONS } from "./constants";

function TagChip({ tag }: { tag: string }) {
  return (
    <span
      className="inline-flex items-center border-2 border-border bg-surface-elevated px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
      style={{ fontFamily: "var(--font-space-mono)" }}
    >
      {tag}
    </span>
  );
}

export function Layer1SummaryAndTags({ assetId }: { assetId: string }) {
  return <Layer1SummaryAndTagsInner assetId={assetId} />;
}

function ToneSelector({
  selectedTone,
  onToneChange,
  disabled,
}: {
  selectedTone: SummaryTone;
  onToneChange: (tone: SummaryTone) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {TONE_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => onToneChange(option.value)}
            disabled={disabled}
            className={`tone-btn ${selectedTone === option.value ? "active" : ""}`}
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            [
            {option.label}
            ]
          </button>
        ))}
      </div>
    </div>
  );
}

function Layer1SummaryAndTagsInner({ assetId }: { assetId: string }) {
  const [selectedTone, setSelectedTone] = useState<SummaryTone>("neutral");
  const [isMetadataCollapsed, setIsMetadataCollapsed] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  type SummaryResult = NonNullable<Awaited<ReturnType<typeof pollSummaryWorkflowAction>>["result"]>;

  const [workflowState, setWorkflowState] = useState<{
    status: SummaryStatus;
    completedSteps: SummaryStepId[];
    runId?: string;
    error?: string;
    result?: SummaryResult;
  }>(() => {
    const stored = getWorkflowProgress(assetId, "summarizeAndTag");
    if (stored && (stored.status === "queued" || stored.status === "running")) {
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
    // Guard against concurrent polls to prevent race conditions with streamIndexRef
    if (isPollInFlightRef.current) {
      return;
    }
    isPollInFlightRef.current = true;

    try {
      const result = await pollSummaryWorkflowAction(runId, streamIndexRef.current);
      streamIndexRef.current = result.nextIndex;

      if (result.status === "completed" || result.status === "failed") {
        stopPolling();
        if (result.status === "completed") {
          markWorkflowCompleted(assetId, "summarizeAndTag", undefined);
          // Save summary and tags to database
          if (result.result?.description && result.result?.tags) {
            void saveSummaryAndTagsAction(assetId, result.result.description, result.result.tags);
          }
        } else {
          markWorkflowFailed(assetId, "summarizeAndTag", undefined, result.error || "Workflow failed.");
          clearWorkflowProgress(assetId, "summarizeAndTag", undefined);
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
        markWorkflowRunning(assetId, "summarizeAndTag");
      }
      setWorkflowState(prev => ({
        ...prev,
        status: result.status,
        completedSteps: mergeSteps(prev.completedSteps, result.completedSteps),
      }));
    } finally {
      isPollInFlightRef.current = false;
    }
  }, [assetId, stopPolling]);

  const startWorkflow = useCallback(() => {
    stopPolling();
    streamIndexRef.current = 0;
    setWorkflowState({ status: "starting", completedSteps: [] });
    setIsMetadataCollapsed(false);

    startTransition(async () => {
      const result = await startSummaryWorkflowAction(assetId, selectedTone);

      if (result.status === "failed" || !result.runId) {
        setWorkflowState({
          status: "failed",
          completedSteps: [],
          error: result.error,
        });
        return;
      }

      persistWorkflowStart(assetId, "summarizeAndTag", undefined, result.runId);
      setWorkflowState({ status: "starting", completedSteps: [], runId: result.runId });

      pollRef.current = setInterval(() => {
        void pollStatus(result.runId);
      }, POLL_INTERVAL);

      void pollStatus(result.runId);
    });
  }, [assetId, pollStatus, selectedTone, startTransition, stopPolling]);

  useEffect(() => stopPolling, [stopPolling]);

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
  const isError = workflowState.status === "failed";
  const isSuccess = workflowState.status === "completed";

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <ToneSelector selectedTone={selectedTone} onToneChange={setSelectedTone} disabled={isWorking} />

        <div className="flex items-center justify-between">
          <span
            className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted"
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            Smart Summary
          </span>
          <StatusBadge status={workflowState.status} />
        </div>

        <button
          type="button"
          className="btn-action w-full"
          onClick={startWorkflow}
          disabled={isWorking}
        >
          {isWorking ? "PROCESSING..." : "SUMMARIZE & TAG"}
          {!isWorking && (
            <span className="arrow-icon ml-2">↗</span>
          )}
        </button>

        <AnimatePresence initial={false}>
          {(isRunning || workflowState.completedSteps.length > 0) && (
            <motion.div
              key="summary-progress"
              className="border-2 border-border bg-surface-elevated"
              initial={shouldReduceMotion ? false : { height: 0, opacity: 0, y: -4 }}
              animate={{ height: "auto", opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0, y: -4 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" }}
            >
              <div className="p-3">
                <StepProgress
                  steps={SUMMARY_STEPS}
                  completedSteps={workflowState.completedSteps}
                  isRunning={isRunning}
                  shouldReduceMotion={shouldReduceMotion}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {workflowState.status === "completed" && (
          <div className="border-2 border-[#22903d] bg-[#e9f5ec] p-2 text-xs text-[#22903d]">
            ✓ Summary generated. Ready below.
          </div>
        )}

        {isError && workflowState.error && (
          <div className="border-3 border-border bg-surface-elevated p-4">
            <div
              className="mb-1 text-xs font-bold uppercase tracking-wider text-foreground"
              style={{ fontFamily: "var(--font-space-mono)" }}
            >
              Generation failed
            </div>
            <div className="text-sm text-foreground-muted">{workflowState.error}</div>
          </div>
        )}
      </div>

      {isSuccess && (
        <div className="space-y-4">
          <div className="border-3 border-border bg-surface-elevated">
            <div className="flex items-center justify-between gap-3 border-b-2 border-border bg-surface px-4 py-2">
              <div
                className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground-muted"
                style={{ fontFamily: "var(--font-space-mono)" }}
              >
                GENERATED METADATA
              </div>

              <button
                type="button"
                className="tone-btn"
                onClick={() => setIsMetadataCollapsed(prev => !prev)}
                aria-expanded={!isMetadataCollapsed}
                style={{ fontFamily: "var(--font-space-mono)" }}
              >
                [
                {isMetadataCollapsed ? "EXPAND" : "COLLAPSE"}
                ]
              </button>
            </div>

            <AnimatePresence initial={false}>
              {!isMetadataCollapsed && (
                <motion.div
                  key="generated-metadata"
                  className="overflow-hidden"
                  initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" }}
                >
                  <div className="space-y-4 p-4">
                    <div>
                      <div
                        className="mb-1 text-[10px] font-bold uppercase tracking-wider text-foreground-muted"
                        style={{ fontFamily: "var(--font-space-mono)" }}
                      >
                        Title
                      </div>
                      <div
                        className="text-base font-bold"
                        style={{ fontFamily: "var(--font-syne)" }}
                      >
                        {workflowState.result?.title}
                      </div>
                    </div>

                    <div>
                      <div
                        className="mb-1 text-[10px] font-bold uppercase tracking-wider text-foreground-muted"
                        style={{ fontFamily: "var(--font-space-mono)" }}
                      >
                        Description
                      </div>
                      <p className="text-sm leading-relaxed text-foreground-muted">
                        {workflowState.result?.description}
                      </p>
                    </div>

                    <div>
                      <div
                        className="mb-2 text-[10px] font-bold uppercase tracking-wider text-foreground-muted"
                        style={{ fontFamily: "var(--font-space-mono)" }}
                      >
                        Tags
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {(workflowState.result?.tags ?? []).map(tag => (
                          <TagChip key={tag} tag={tag} />
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
