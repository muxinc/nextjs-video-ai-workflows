"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  clearWorkflowProgress,
  getAllInFlightWorkflows,
  getWorkflowProgress,
  markWorkflowCompleted,
  markWorkflowFailed,
  markWorkflowRunning,
  startWorkflow as persistWorkflowStart,
} from "@/app/lib/workflow-state";
import { mergeSteps } from "@/app/media/[slug]/workflows-panel/helpers";

import { usePlayer } from "../player/use-player";
import { StatusBadge, StepProgress } from "../workflows-panel/ui";

import {
  isAudioTrackReadyAction,
  isCaptionTrackReadyAction,
  pollAudioTranslationAction,
  pollCaptionTranslationAction,
  startAudioTranslationAction,
  startCaptionTranslationAction,
} from "./actions";
import {
  AUDIO_STEPS,
  CAPTION_STEPS,
  TARGET_LANGUAGES,
} from "./constants";
import type {
  AudioStepId,
  CaptionStepId,
  TargetLanguage,
  TranslationStatus,
} from "./constants";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Layer2LocalizationProps {
  assetId: string;
  hasElevenLabsKey: boolean;
}

interface WorkflowState<TStep extends string> {
  status: TranslationStatus;
  completedSteps: TStep[];
  runId?: string;
  error?: string;
  isUpdatingPlayer?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Language Selector Component
// ─────────────────────────────────────────────────────────────────────────────

function LanguageSelector({
  selectedLang,
  onSelect,
  disabled,
}: {
  selectedLang: TargetLanguage;
  onSelect: (lang: TargetLanguage) => void;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <select
        value={selectedLang.code}
        onChange={(e) => {
          const lang = TARGET_LANGUAGES.find(l => l.code === e.target.value);
          if (lang) {
            onSelect(lang);
          }
        }}
        disabled={disabled}
        className="w-full appearance-none border-2 border-border bg-surface px-3 py-2 pr-8 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-50"
        style={{ fontFamily: "var(--font-space-mono)" }}
      >
        {TARGET_LANGUAGES.map(lang => (
          <option key={lang.code} value={lang.code}>
            {lang.flag}
            {" "}
            {lang.name.toUpperCase()}
          </option>
        ))}
      </select>
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Translation Action Button Component
// ─────────────────────────────────────────────────────────────────────────────

function TranslationButton({
  label,
  onClick,
  disabled,
  isPending,
  status,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  isPending: boolean;
  status: TranslationStatus;
}) {
  const isWorking = isPending || status === "running" || status === "starting";

  let buttonContent: React.ReactNode;
  if (isWorking) {
    const statusLabel = status === "starting" ?
      "QUEUING..." :
      "PROCESSING...";
    buttonContent = (
      <>
        <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
        {statusLabel}
      </>
    );
  } else {
    buttonContent = (
      <>
        {label}
        <span className="arrow-icon ml-2">↗</span>
      </>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isWorking}
      className="btn-action w-full text-xs"
    >
      {buttonContent}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

// Polling interval in milliseconds
const POLL_INTERVAL = 1500;

const CAPTION_TRACK_DELAYS = [500, 750, 1000, 1500, 2000, 3000, 4000, 5000] as const;
const AUDIO_TRACK_DELAYS = [500, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 7000, 8000] as const;

async function delay(ms: number) {
  await new Promise<void>(resolve => setTimeout(resolve, ms));
}

async function waitForMuxTrack(
  checkReady: () => Promise<boolean>,
  delays: readonly number[],
) {
  for (const ms of delays) {
    if (await checkReady()) {
      return true;
    }
    await delay(ms);
  }
  return false;
}

/**
 * Computes the initial language selection based on in-flight workflows.
 * Called only after mount to avoid hydration mismatch.
 */
function getLanguageFromWorkflows(assetId: string): TargetLanguage | null {
  if (typeof window === "undefined") {
    return null;
  }

  const workflows = getAllInFlightWorkflows(assetId)
    .filter(w => w.workflowType === "translateCaptions" || w.workflowType === "translateAudio")
    .sort((a, b) => b.progress.startedAt.localeCompare(a.progress.startedAt));

  const withLang = workflows.find(w => w.targetLang);
  if (withLang?.targetLang) {
    const match = TARGET_LANGUAGES.find(l => l.code === withLang.targetLang);
    if (match) {
      return match;
    }
  }

  return null;
}

function useTranslationWorkflow<TStep extends string>({
  assetId,
  workflowType,
  startAction,
  pollAction,
  targetLang,
  onCompleted,
}: {
  assetId: string;
  targetLang: string;
  workflowType: "translateCaptions" | "translateAudio";
  startAction: (assetId: string, targetLang: string) => Promise<{ runId: string; status: TranslationStatus; error?: string }>;
  pollAction: (runId: string, startIndex: number) => Promise<{ status: TranslationStatus; completedSteps: TStep[]; nextIndex: number; error?: string }>;
  onCompleted?: () => Promise<void>;
}) {
  // Start with idle state to avoid hydration mismatch (server has no localStorage).
  // Rehydration from localStorage happens in useEffect after mount.
  const [state, setState] = useState<WorkflowState<TStep>>({
    status: "idle",
    completedSteps: [],
  });

  const [isPending, startTransition] = useTransition();

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamIndexRef = useRef(0);
  const isPollInFlightRef = useRef(false);
  const autoRefreshDoneRef = useRef(false);
  const onCompletedRef = useRef(onCompleted);

  useEffect(() => {
    onCompletedRef.current = onCompleted;
  }, [onCompleted]);

  const isRunning = state.status === "running" || state.status === "starting";

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
      const result = await pollAction(runId, streamIndexRef.current);
      streamIndexRef.current = result.nextIndex;

      if (result.status === "completed" || result.status === "failed") {
        stopPolling();
        if (result.status === "completed") {
          markWorkflowCompleted(assetId, workflowType, targetLang);
        } else {
          markWorkflowFailed(assetId, workflowType, targetLang, result.error || "Workflow failed.");
          clearWorkflowProgress(assetId, workflowType, targetLang);
        }
        setState(prev => ({
          ...prev,
          status: result.status,
          completedSteps: mergeSteps(prev.completedSteps, result.completedSteps),
          runId,
          error: result.error,
        }));

        const onCompletedFn = onCompletedRef.current;
        if (result.status === "completed" && onCompletedFn && !autoRefreshDoneRef.current) {
          autoRefreshDoneRef.current = true;
          setState(prev => ({ ...prev, isUpdatingPlayer: true }));
          await onCompletedFn();
          setState(prev => ({ ...prev, isUpdatingPlayer: false }));
        }
        return;
      }

      if (result.status === "running") {
        markWorkflowRunning(assetId, workflowType, targetLang);
      }
      setState(prev => ({
        ...prev,
        status: result.status,
        completedSteps: mergeSteps(prev.completedSteps, result.completedSteps),
      }));
    } finally {
      isPollInFlightRef.current = false;
    }
  }, [assetId, pollAction, stopPolling, targetLang, workflowType]);

  const startWorkflow = useCallback(() => {
    stopPolling();
    streamIndexRef.current = 0;
    autoRefreshDoneRef.current = false;
    setState({ status: "starting", completedSteps: [] });

    startTransition(async () => {
      const result = await startAction(assetId, targetLang);

      if (result.status === "failed" || !result.runId) {
        setState({ status: "failed", completedSteps: [], error: result.error });
        return;
      }

      persistWorkflowStart(assetId, workflowType, targetLang, result.runId);
      setState({ status: "starting", completedSteps: [], runId: result.runId });

      pollRef.current = setInterval(() => {
        void pollStatus(result.runId);
      }, POLL_INTERVAL);

      void pollStatus(result.runId);
    });
  }, [assetId, pollStatus, startAction, stopPolling, targetLang, workflowType]);

  // Cleanup polling on unmount
  useEffect(() => stopPolling, [stopPolling]);

  // Rehydrate state from localStorage after mount and resume polling if needed.
  // Combined into one effect to avoid the hasMounted state pattern.
  useEffect(() => {
    const stored = getWorkflowProgress(assetId, workflowType, targetLang);
    if (!stored || (stored.status !== "queued" && stored.status !== "running")) {
      return;
    }

    // Check for stale localStorage entries (> 30 min old)
    const startedAtMs = Date.parse(stored.startedAt);
    const ageMs = Number.isFinite(startedAtMs) ? Date.now() - startedAtMs : Number.POSITIVE_INFINITY;
    const staleAfterMs = 30 * 60 * 1000;
    if (ageMs > staleAfterMs) {
      clearWorkflowProgress(assetId, workflowType, targetLang);
      return;
    }

    // Rehydrate state and start polling — intentional post-mount hydration from localStorage
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setState({ status: "starting", completedSteps: [], runId: stored.workflowRunId });

    pollRef.current = setInterval(() => {
      void pollStatus(stored.workflowRunId);
    }, POLL_INTERVAL);
    void pollStatus(stored.workflowRunId);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [assetId, workflowType, targetLang, pollStatus]);

  return { isPending, isRunning, startWorkflow, state };
}

function WorkflowSection<TStep extends string>({
  buttonLabel,
  completedMessage,
  disabled,
  error,
  headerBadge,
  isPending,
  isRunning,
  status,
  steps,
  title,
  completedSteps,
  onStart,
  shouldReduceMotion,
}: {
  title: string;
  status: TranslationStatus;
  isRunning: boolean;
  isPending: boolean;
  disabled: boolean;
  steps: readonly { id: TStep; label: string }[];
  completedSteps: TStep[];
  buttonLabel: string;
  completedMessage: React.ReactNode;
  error?: string;
  headerBadge?: React.ReactNode;
  onStart: () => void;
  shouldReduceMotion: boolean | null;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span
          className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted"
          style={{ fontFamily: "var(--font-space-mono)" }}
        >
          {title}
        </span>
        <div className="flex items-center gap-2">
          {headerBadge}
          <StatusBadge status={status} />
        </div>
      </div>

      <TranslationButton
        label={buttonLabel}
        onClick={onStart}
        disabled={disabled}
        isPending={isPending}
        status={status}
      />

      <AnimatePresence initial={false}>
        {(isRunning || completedSteps.length > 0) && (
          <motion.div
            key={`${title}-progress`}
            className="border-2 border-border bg-surface-elevated"
            initial={shouldReduceMotion ? false : { height: 0, opacity: 0, y: -4 }}
            animate={{ height: "auto", opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { height: 0, opacity: 0, y: -4 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.18, ease: "easeOut" }}
          >
            <div className="p-3">
              <StepProgress
                steps={steps}
                completedSteps={completedSteps}
                isRunning={isRunning}
                shouldReduceMotion={shouldReduceMotion}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {status === "failed" && error && (
        <div className="border-2 border-[#dc2626] bg-[#fde8e8] p-2 text-xs text-[#dc2626]">
          {error}
        </div>
      )}

      {status === "completed" && (
        <div className="border-2 border-[#22903d] bg-[#e9f5ec] p-2 text-xs text-[#22903d]">
          {completedMessage}
        </div>
      )}
    </div>
  );
}

function RequirementBadge({ children }: { children: string }) {
  return (
    <span
      className="inline-flex items-center border-2 border-border bg-surface-elevated px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-foreground-muted"
      style={{ fontFamily: "var(--font-space-mono)" }}
    >
      {children}
    </span>
  );
}

export function Layer2Localization({ assetId, hasElevenLabsKey }: Layer2LocalizationProps) {
  const { refreshPlayer } = usePlayer();
  // Start with default language to avoid hydration mismatch.
  // Rehydrate from localStorage in useEffect after mount for resumability.
  const [selectedLang, setSelectedLang] = useState<TargetLanguage>(TARGET_LANGUAGES[0]);
  const shouldReduceMotion = useReducedMotion();

  // Rehydrate language selection from in-flight workflows after mount
  // Intentional post-mount hydration from localStorage
  useEffect(() => {
    const langFromWorkflows = getLanguageFromWorkflows(assetId);
    if (langFromWorkflows) {
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setSelectedLang(langFromWorkflows);
    }
  }, [assetId]);

  const captions = useTranslationWorkflow<CaptionStepId>({
    assetId,
    workflowType: "translateCaptions",
    targetLang: selectedLang.code,
    startAction: startCaptionTranslationAction,
    pollAction: pollCaptionTranslationAction,
    onCompleted: async () => {
      const ready = await waitForMuxTrack(
        () => isCaptionTrackReadyAction(assetId, selectedLang.code),
        CAPTION_TRACK_DELAYS,
      );
      if (ready) {
        refreshPlayer();
      }
    },
  });

  const audio = useTranslationWorkflow<AudioStepId>({
    assetId,
    workflowType: "translateAudio",
    targetLang: selectedLang.code,
    startAction: startAudioTranslationAction,
    pollAction: pollAudioTranslationAction,
    onCompleted: async () => {
      const ready = await waitForMuxTrack(
        () => isAudioTrackReadyAction(assetId, selectedLang.code),
        AUDIO_TRACK_DELAYS,
      );
      if (ready) {
        refreshPlayer();
      }
    },
  });

  const isAnyWorkflowRunning = captions.isRunning || audio.isRunning;
  const captionCompletedMessage = `✓ Captions translated to ${selectedLang.name}. ${captions.state.isUpdatingPlayer ? "Updating player…" : "Ready in player."}`;
  const audioCompletedMessage = `✓ Audio dubbed to ${selectedLang.name}. ${audio.state.isUpdatingPlayer ? "Updating player…" : "Ready in player."}`;

  return (
    <div className="space-y-4">
      {/* Language Selection */}
      <div className="space-y-2">
        <label
          className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted"
          style={{ fontFamily: "var(--font-space-mono)" }}
        >
          Target Language
        </label>
        <LanguageSelector
          selectedLang={selectedLang}
          onSelect={setSelectedLang}
          disabled={isAnyWorkflowRunning}
        />
      </div>

      <WorkflowSection
        title="Captions"
        status={captions.state.status}
        isRunning={captions.isRunning}
        isPending={captions.isPending}
        disabled={isAnyWorkflowRunning}
        steps={CAPTION_STEPS}
        completedSteps={captions.state.completedSteps}
        buttonLabel={`TRANSLATE CAPTIONS → ${selectedLang.name.toUpperCase()}`}
        error={captions.state.error}
        onStart={captions.startWorkflow}
        completedMessage={captionCompletedMessage}
        shouldReduceMotion={shouldReduceMotion}
      />

      <WorkflowSection
        title="Audio"
        status={audio.state.status}
        isRunning={audio.isRunning}
        isPending={audio.isPending}
        disabled={isAnyWorkflowRunning || !hasElevenLabsKey}
        steps={AUDIO_STEPS}
        completedSteps={audio.state.completedSteps}
        buttonLabel={`TRANSLATE AUDIO → ${selectedLang.name.toUpperCase()}`}
        error={audio.state.error}
        onStart={audio.startWorkflow}
        completedMessage={audioCompletedMessage}
        headerBadge={!hasElevenLabsKey ? <RequirementBadge>ElevenLabs env key required</RequirementBadge> : undefined}
        shouldReduceMotion={shouldReduceMotion}
      />

      {/* Info text */}
      <p className="text-[10px] text-foreground-muted" style={{ fontFamily: "var(--font-space-mono)" }}>
        Translations are attached directly to the Mux asset.
        The player will auto-refresh when new tracks are ready.
      </p>
    </div>
  );
}
