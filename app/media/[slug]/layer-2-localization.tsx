"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  isAudioTrackReadyAction,
  isCaptionTrackReadyAction,
  pollAudioTranslationAction,
  pollCaptionTranslationAction,
  startAudioTranslationAction,
  startCaptionTranslationAction,
} from "./layer-2-actions";
import {
  AUDIO_STEPS,
  CAPTION_STEPS,
  TARGET_LANGUAGES,
} from "./layer-2-constants";
import type {
  AudioStepId,
  CaptionStepId,
  TargetLanguage,
  TranslationStatus,
} from "./layer-2-constants";
import { usePlayer } from "./use-player";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Layer2LocalizationProps {
  assetId: string;
}

interface CaptionWorkflowState {
  status: TranslationStatus;
  completedSteps: CaptionStepId[];
  runId?: string;
  error?: string;
  isUpdatingPlayer?: boolean;
}

interface AudioWorkflowState {
  status: TranslationStatus;
  completedSteps: AudioStepId[];
  runId?: string;
  error?: string;
  isUpdatingPlayer?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Badge Component
// ─────────────────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TranslationStatus }) {
  const config: Record<TranslationStatus, { label: string; className: string }> = {
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

// ─────────────────────────────────────────────────────────────────────────────
// Step Progress Component
// ─────────────────────────────────────────────────────────────────────────────

function StepProgress<T extends string>({
  steps,
  completedSteps,
  isRunning,
}: {
  steps: readonly { id: T; label: string }[];
  completedSteps: T[];
  isRunning: boolean;
}) {
  // Find the current step (first incomplete step)
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
            {/* Step indicator */}
            <span className="flex h-4 w-4 items-center justify-center">
              {indicatorContent}
            </span>
            {/* Step label */}
            <span className={labelClassName}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
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

export function Layer2Localization({ assetId }: Layer2LocalizationProps) {
  const { refreshPlayer } = usePlayer();
  const [selectedLang, setSelectedLang] = useState<TargetLanguage>(TARGET_LANGUAGES[0]);

  // Separate states for captions and audio workflows
  const [captionState, setCaptionState] = useState<CaptionWorkflowState>({
    status: "idle",
    completedSteps: [],
  });
  const [audioState, setAudioState] = useState<AudioWorkflowState>({
    status: "idle",
    completedSteps: [],
  });

  const [isCaptionPending, startCaptionTransition] = useTransition();
  const [isAudioPending, startAudioTransition] = useTransition();

  // Refs to track polling intervals
  const captionPollRef = useRef<NodeJS.Timeout | null>(null);
  const audioPollRef = useRef<NodeJS.Timeout | null>(null);
  const captionStreamIndexRef = useRef(0);
  const audioStreamIndexRef = useRef(0);
  const captionAutoRefreshDoneRef = useRef(false);
  const audioAutoRefreshDoneRef = useRef(false);

  const sleep = useCallback(async (ms: number) => {
    await new Promise(resolve => setTimeout(resolve, ms));
  }, []);

  const waitForMuxTrack = useCallback(async (type: "captions" | "audio") => {
    // Audio tracks take longer to process than text tracks, so use longer delays
    const delays = type === "audio" ?
        [500, 1000, 1500, 2000, 3000, 4000, 5000, 6000, 7000, 8000] :
        [500, 750, 1000, 1500, 2000, 3000, 4000, 5000];

    for (const delay of delays) {
      let ready = false;
      if (type === "captions") {
        ready = await isCaptionTrackReadyAction(assetId, selectedLang.code);
      } else {
        ready = await isAudioTrackReadyAction(assetId, selectedLang.code);
      }
      if (ready) {
        return true;
      }
      await sleep(delay);
    }
    return false;
  }, [assetId, selectedLang.code, sleep]);

  const mergeSteps = useCallback(<T extends string>(prev: T[], next: T[]) => {
    if (!next.length) {
      return prev;
    }
    return Array.from(new Set([...prev, ...next]));
  }, []);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (captionPollRef.current) {
        clearInterval(captionPollRef.current);
      }
      if (audioPollRef.current) {
        clearInterval(audioPollRef.current);
      }
    };
  }, []);

  // Poll for caption workflow status
  const pollCaptionStatus = useCallback(async (runId: string) => {
    const result = await pollCaptionTranslationAction(runId, captionStreamIndexRef.current);
    captionStreamIndexRef.current = result.nextIndex;

    if (result.status === "completed" || result.status === "failed") {
      // Stop polling when workflow completes
      if (captionPollRef.current) {
        clearInterval(captionPollRef.current);
        captionPollRef.current = null;
      }
      setCaptionState({
        status: result.status,
        completedSteps: result.completedSteps,
        runId,
        error: result.error,
      });
      // Auto-refresh the player when captions are successfully translated,
      // but only after the new track is actually visible on the Mux asset.
      if (result.status === "completed" && !captionAutoRefreshDoneRef.current) {
        captionAutoRefreshDoneRef.current = true;
        setCaptionState(prev => ({ ...prev, isUpdatingPlayer: true }));
        const trackReady = await waitForMuxTrack("captions");
        if (trackReady) {
          refreshPlayer();
        }
        setCaptionState(prev => ({ ...prev, isUpdatingPlayer: false }));
      }
    } else {
      // Update state with any progress
      setCaptionState(prev => ({
        ...prev,
        status: result.status,
        completedSteps: mergeSteps(prev.completedSteps, result.completedSteps),
      }));
    }
  }, [mergeSteps, refreshPlayer, waitForMuxTrack]);

  // Poll for audio workflow status
  const pollAudioStatus = useCallback(async (runId: string) => {
    const result = await pollAudioTranslationAction(runId, audioStreamIndexRef.current);
    audioStreamIndexRef.current = result.nextIndex;

    if (result.status === "completed" || result.status === "failed") {
      // Stop polling when workflow completes
      if (audioPollRef.current) {
        clearInterval(audioPollRef.current);
        audioPollRef.current = null;
      }
      setAudioState({
        status: result.status,
        completedSteps: result.completedSteps,
        runId,
        error: result.error,
      });
      // Auto-refresh the player when audio is successfully dubbed,
      // but only after the new track is actually visible on the Mux asset.
      if (result.status === "completed" && !audioAutoRefreshDoneRef.current) {
        audioAutoRefreshDoneRef.current = true;
        setAudioState(prev => ({ ...prev, isUpdatingPlayer: true }));
        // Wait for track to be ready, but refresh player regardless
        // since the track will eventually be available
        await waitForMuxTrack("audio");
        refreshPlayer();
        setAudioState(prev => ({ ...prev, isUpdatingPlayer: false }));
      }
    } else {
      // Update state with any progress
      setAudioState(prev => ({
        ...prev,
        status: result.status,
        completedSteps: mergeSteps(prev.completedSteps, result.completedSteps),
      }));
    }
  }, [mergeSteps, refreshPlayer, waitForMuxTrack]);

  const handleTranslateCaptions = useCallback(() => {
    setCaptionState({ status: "starting", completedSteps: [] });
    captionStreamIndexRef.current = 0;
    captionAutoRefreshDoneRef.current = false;

    startCaptionTransition(async () => {
      const result = await startCaptionTranslationAction(assetId, selectedLang.code);

      if (result.status === "failed" || !result.runId) {
        setCaptionState({
          status: "failed",
          completedSteps: [],
          error: result.error,
        });
        return;
      }

      // Workflow started successfully - begin polling
      setCaptionState({
        status: "running",
        completedSteps: [],
        runId: result.runId,
      });

      // Start polling for status
      captionPollRef.current = setInterval(() => {
        pollCaptionStatus(result.runId);
      }, POLL_INTERVAL);

      // Also poll immediately
      pollCaptionStatus(result.runId);
    });
  }, [assetId, selectedLang.code, pollCaptionStatus]);

  const handleTranslateAudio = useCallback(() => {
    setAudioState({ status: "starting", completedSteps: [] });
    audioStreamIndexRef.current = 0;
    audioAutoRefreshDoneRef.current = false;

    startAudioTransition(async () => {
      const result = await startAudioTranslationAction(assetId, selectedLang.code);

      if (result.status === "failed" || !result.runId) {
        setAudioState({
          status: "failed",
          completedSteps: [],
          error: result.error,
        });
        return;
      }

      // Workflow started successfully - begin polling
      setAudioState({
        status: "running",
        completedSteps: [],
        runId: result.runId,
      });

      // Start polling for status
      audioPollRef.current = setInterval(() => {
        pollAudioStatus(result.runId);
      }, POLL_INTERVAL);

      // Also poll immediately
      pollAudioStatus(result.runId);
    });
  }, [assetId, selectedLang.code, pollAudioStatus]);

  const isAnyWorkflowRunning =
    captionState.status === "running" ||
    captionState.status === "starting" ||
    audioState.status === "running" ||
    audioState.status === "starting";

  const isCaptionRunning = captionState.status === "running" || captionState.status === "starting";
  const isAudioRunning = audioState.status === "running" || audioState.status === "starting";

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

      {/* Caption Translation */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span
            className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted"
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            Captions
          </span>
          <StatusBadge status={captionState.status} />
        </div>

        <TranslationButton
          label={`TRANSLATE CAPTIONS → ${selectedLang.name.toUpperCase()}`}
          onClick={handleTranslateCaptions}
          disabled={isAnyWorkflowRunning}
          isPending={isCaptionPending}
          status={captionState.status}
        />

        {/* Step progress for captions */}
        {(isCaptionRunning || captionState.completedSteps.length > 0) && (
          <div className="border-2 border-border bg-surface-elevated p-3">
            <StepProgress
              steps={CAPTION_STEPS}
              completedSteps={captionState.completedSteps}
              isRunning={isCaptionRunning}
            />
          </div>
        )}

        {captionState.status === "failed" && captionState.error && (
          <div className="border-2 border-[#dc2626] bg-[#fde8e8] p-2 text-xs text-[#dc2626]">
            {captionState.error}
          </div>
        )}
        {captionState.status === "completed" && (
          <div className="border-2 border-[#22903d] bg-[#e9f5ec] p-2 text-xs text-[#22903d]">
            ✓ Captions translated to
            {" "}
            {selectedLang.name}
            .
            {" "}
            {captionState.isUpdatingPlayer ? "Updating player…" : "Ready in player."}
          </div>
        )}
      </div>

      {/* Audio Dubbing */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span
            className="text-[10px] font-bold uppercase tracking-wider text-foreground-muted"
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            Audio
          </span>
          <StatusBadge status={audioState.status} />
        </div>

        <TranslationButton
          label={`TRANSLATE AUDIO → ${selectedLang.name.toUpperCase()}`}
          onClick={handleTranslateAudio}
          disabled={isAnyWorkflowRunning}
          isPending={isAudioPending}
          status={audioState.status}
        />

        {/* Step progress for audio */}
        {(isAudioRunning || audioState.completedSteps.length > 0) && (
          <div className="border-2 border-border bg-surface-elevated p-3">
            <StepProgress
              steps={AUDIO_STEPS}
              completedSteps={audioState.completedSteps}
              isRunning={isAudioRunning}
            />
          </div>
        )}

        {audioState.status === "failed" && audioState.error && (
          <div className="border-2 border-[#dc2626] bg-[#fde8e8] p-2 text-xs text-[#dc2626]">
            {audioState.error}
          </div>
        )}
        {audioState.status === "completed" && (
          <div className="border-2 border-[#22903d] bg-[#e9f5ec] p-2 text-xs text-[#22903d]">
            ✓ Audio dubbed to
            {" "}
            {selectedLang.name}
            .
            {" "}
            {audioState.isUpdatingPlayer ? "Updating player…" : "Ready in player."}
          </div>
        )}
      </div>

      {/* Info text */}
      <p className="text-[10px] text-foreground-muted" style={{ fontFamily: "var(--font-space-mono)" }}>
        Translations are attached directly to the Mux asset.
        The player will auto-refresh when new tracks are ready.
      </p>
    </div>
  );
}
