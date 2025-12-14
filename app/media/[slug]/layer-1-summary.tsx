"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import type { SummaryStepId } from "@/workflows/get-summary-and-tags";

import type { SummaryStatus, SummaryTone } from "./layer-1-actions";
import { pollSummaryWorkflowAction, startSummaryWorkflowAction } from "./layer-1-actions";

const TONE_OPTIONS: { value: SummaryTone; label: string }[] = [
  { value: "normal", label: "NORMAL" },
  { value: "professional", label: "PROFESSIONAL" },
  { value: "sassy", label: "PLAYFUL" },
];

const POLL_INTERVAL = 1500;

const SUMMARY_STEPS: readonly { id: SummaryStepId; label: string }[] = [
  { id: "prepare", label: "Preparing inputs" },
  { id: "generate", label: "Generating summary + tags" },
  { id: "finalize", label: "Finalizing output" },
] as const;

function StatusBadge({ status }: { status: SummaryStatus }) {
  const config: Record<SummaryStatus, { label: string; className: string }> = {
    idle: { label: "READY", className: "bg-surface-elevated text-foreground-muted" },
    starting: { label: "QUEUED", className: "bg-[#fff8e6] text-[#b8860b]" },
    running: { label: "RUNNING", className: "bg-[#e8f0fa] text-[#1c65be]" },
    completed: { label: "DONE", className: "bg-[#e9f5ec] text-[#22903d]" },
    failed: { label: "FAILED", className: "bg-[#fde8e8] text-[#dc2626]" },
  };

  const { label, className } = config[status];

  return (
    <span
      className={`inline-flex items-center border-2 border-border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${className}`}
      style={{ fontFamily: "var(--font-space-mono)" }}
    >
      {status === "running" && (
        <span className="mr-1.5 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {label}
    </span>
  );
}

function StepProgress<T extends string>({
  steps,
  completedSteps,
  isRunning,
}: {
  steps: readonly { id: T; label: string }[];
  completedSteps: T[];
  isRunning: boolean;
}) {
  const currentStepIndex = completedSteps.length;

  return (
    <div className="space-y-1.5">
      {steps.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = isRunning && index === currentStepIndex;

        let indicatorContent: React.ReactNode;
        if (isCompleted) {
          indicatorContent = <span className="text-[#22903d]">✓</span>;
        } else if (isCurrent) {
          indicatorContent = <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#1c65be]" />;
        } else {
          indicatorContent = <span className="inline-block h-2 w-2 rounded-full border border-foreground-muted" />;
        }

        let labelClassName: string;
        if (isCompleted) {
          labelClassName = "text-[#22903d]";
        } else if (isCurrent) {
          labelClassName = "font-bold text-[#1c65be]";
        } else {
          labelClassName = "text-foreground-muted";
        }

        return (
          <div
            key={step.id}
            className="flex items-center gap-2 text-[10px]"
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            <span className="flex h-4 w-4 items-center justify-center">
              {indicatorContent}
            </span>
            <span className={labelClassName}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

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
}: {
  selectedTone: SummaryTone;
  onToneChange: (tone: SummaryTone) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {TONE_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            onClick={() => onToneChange(option.value)}
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
  const [selectedTone, setSelectedTone] = useState<SummaryTone>("normal");
  const [isMetadataCollapsed, setIsMetadataCollapsed] = useState(false);
  const shouldReduceMotion = useReducedMotion();

  type SummaryResult = NonNullable<Awaited<ReturnType<typeof pollSummaryWorkflowAction>>["result"]>;

  const [workflowState, setWorkflowState] = useState<{
    status: SummaryStatus;
    completedSteps: SummaryStepId[];
    runId?: string;
    error?: string;
    result?: SummaryResult;
  }>({ status: "idle", completedSteps: [] });

  const [isPending, startTransition] = useTransition();

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamIndexRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const mergeSteps = useCallback((prev: SummaryStepId[], next: SummaryStepId[]) => {
    return next.length ? Array.from(new Set([...prev, ...next])) : prev;
  }, []);

  const pollStatus = useCallback(async (runId: string) => {
    const result = await pollSummaryWorkflowAction(runId, streamIndexRef.current);
    streamIndexRef.current = result.nextIndex;

    if (result.status === "completed" || result.status === "failed") {
      stopPolling();
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

    setWorkflowState(prev => ({
      ...prev,
      status: result.status,
      completedSteps: mergeSteps(prev.completedSteps, result.completedSteps),
    }));
  }, [mergeSteps, stopPolling]);

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

      setWorkflowState({ status: "running", completedSteps: [], runId: result.runId });

      pollRef.current = setInterval(() => {
        void pollStatus(result.runId);
      }, POLL_INTERVAL);

      void pollStatus(result.runId);
    });
  }, [assetId, pollStatus, selectedTone, startTransition, stopPolling]);

  useEffect(() => stopPolling, [stopPolling]);

  const isRunning = workflowState.status === "running" || workflowState.status === "starting";
  const isWorking = isPending || isRunning;
  const isError = workflowState.status === "failed";
  const isSuccess = workflowState.status === "completed";

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <ToneSelector selectedTone={selectedTone} onToneChange={setSelectedTone} />

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

        {(isRunning || workflowState.completedSteps.length > 0) && (
          <div className="border-2 border-border bg-surface-elevated p-3">
            <StepProgress
              steps={SUMMARY_STEPS}
              completedSteps={workflowState.completedSteps}
              isRunning={isRunning}
            />
          </div>
        )}

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
