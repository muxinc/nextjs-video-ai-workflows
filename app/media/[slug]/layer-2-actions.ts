"use server";

import { getRun, start } from "workflow/api";

import { findAudioTrack, findTextTrack, getAsset } from "@/app/lib/mux";
import { translateAudioWorkflow } from "@/workflows/translate-audio";
import { translateCaptionsWorkflow } from "@/workflows/translate-captions";

import type { AudioStepId, CaptionStepId, TranslationStatus } from "./layer-2-constants";

// ─────────────────────────────────────────────────────────────────────────────
// Types (interfaces can be exported from server action files)
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkflowStartResult {
  runId: string;
  status: TranslationStatus;
  error?: string;
}

export interface CaptionTranslationResult {
  status: TranslationStatus;
  completedSteps: CaptionStepId[];
  currentStep?: CaptionStepId;
  events: CaptionProgressEvent[];
  nextIndex: number;
  error?: string;
}

export interface AudioTranslationResult {
  status: TranslationStatus;
  completedSteps: AudioStepId[];
  currentStep?: AudioStepId;
  events: AudioProgressEvent[];
  nextIndex: number;
  error?: string;
}

interface CaptionProgressEvent {
  type: "current" | "completed";
  step: CaptionStepId;
}

interface AudioProgressEvent {
  type: "current" | "completed";
  step: AudioStepId;
}

function mapWorkflowStatus(status: string): TranslationStatus {
  if (status === "pending") {
    return "starting";
  }
  if (status === "running") {
    return "running";
  }
  if (status === "completed") {
    return "completed";
  }
  if (status === "failed") {
    return "failed";
  }
  // paused/cancelled/unknown: treat as failed for UI
  return "failed";
}

async function readProgressEvents<TEvent extends { type: string }>(
  stream: ReadableStream<TEvent>,
): Promise<TEvent[]> {
  const reader = stream.getReader();
  const events: TEvent[] = [];

  // Read as many buffered events as are immediately available.
  // Guard with a short timeout so we never hang a server action.
  try {
    for (let i = 0; i < 50; i++) {
      const readPromise = reader.read();
      // Attach no-op catch to prevent unhandled rejection if timeout wins
      readPromise.catch(() => {});

      const next = await Promise.race([
        readPromise,
        new Promise<"timeout">(resolve => setTimeout(() => resolve("timeout"), 50)),
      ]);

      if (next === "timeout") {
        break;
      }

      if (next.done) {
        break;
      }

      if (next.value) {
        events.push(next.value);
      }
    }
  } finally {
    // Always release the reader lock to prevent listener accumulation
    try {
      reader.releaseLock();
    } catch {
      // ignore - reader may already be released
    }
  }

  return events;
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Actions: Start Workflows (Non-blocking)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start caption translation workflow (non-blocking)
 * Returns immediately with run ID for polling
 */
export async function startCaptionTranslationAction(
  assetId: string,
  targetLang: string,
): Promise<WorkflowStartResult> {
  try {
    const run = await start(translateCaptionsWorkflow, [
      assetId,
      "en", // source language is always English for now
      targetLang,
    ]);

    return {
      runId: run.runId,
      status: "running",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start caption translation";
    return {
      runId: "",
      status: "failed",
      error: message,
    };
  }
}

/**
 * Start audio translation workflow (non-blocking)
 * Returns immediately with run ID for polling
 */
export async function startAudioTranslationAction(
  assetId: string,
  targetLang: string,
): Promise<WorkflowStartResult> {
  try {
    const run = await start(translateAudioWorkflow, [
      assetId,
      targetLang,
    ]);

    return {
      runId: run.runId,
      status: "running",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start audio translation";
    return {
      runId: "",
      status: "failed",
      error: message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Actions: Poll for Workflow Status
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Poll caption translation workflow status
 */
export async function pollCaptionTranslationAction(
  runId: string,
  startIndex = 0,
): Promise<CaptionTranslationResult> {
  try {
    const run = getRun<{
      success: boolean;
      currentStep: CaptionStepId;
      completedSteps: CaptionStepId[];
      error?: string;
    }>(runId);

    const workflowStatus = await run.status;
    const status = mapWorkflowStatus(workflowStatus);

    const events = await readProgressEvents(
      run.getReadable<CaptionProgressEvent>({ namespace: "progress", startIndex }),
    );

    const lastCurrent = [...events].reverse().find(e => e.type === "current");
    const completedFromEvents = events
      .filter(e => e.type === "completed")
      .map(e => e.step);

    if (status === "completed" || status === "failed") {
      // Workflow finished - return the final structured result (and any events)
      const result = await run.returnValue;
      return {
        status: result.success ? "completed" : "failed",
        completedSteps: result.completedSteps,
        currentStep: result.currentStep,
        events,
        nextIndex: startIndex + events.length,
        error: result.error,
      };
    }

    return {
      status,
      completedSteps: completedFromEvents,
      currentStep: lastCurrent?.step,
      events,
      nextIndex: startIndex + events.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to poll workflow status";
    return {
      status: "failed",
      completedSteps: [],
      events: [],
      nextIndex: startIndex,
      error: message,
    };
  }
}

/**
 * Poll audio translation workflow status
 */
export async function pollAudioTranslationAction(
  runId: string,
  startIndex = 0,
): Promise<AudioTranslationResult> {
  try {
    const run = getRun<{
      success: boolean;
      currentStep: AudioStepId;
      completedSteps: AudioStepId[];
      error?: string;
    }>(runId);

    const workflowStatus = await run.status;
    const status = mapWorkflowStatus(workflowStatus);

    const events = await readProgressEvents(
      run.getReadable<AudioProgressEvent>({ namespace: "progress", startIndex }),
    );

    const lastCurrent = [...events].reverse().find(e => e.type === "current");
    const completedFromEvents = events
      .filter(e => e.type === "completed")
      .map(e => e.step);

    if (status === "completed" || status === "failed") {
      const result = await run.returnValue;
      return {
        status: result.success ? "completed" : "failed",
        completedSteps: result.completedSteps,
        currentStep: result.currentStep,
        events,
        nextIndex: startIndex + events.length,
        error: result.error,
      };
    }

    return {
      status,
      completedSteps: completedFromEvents,
      currentStep: lastCurrent?.step,
      events,
      nextIndex: startIndex + events.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to poll workflow status";
    return {
      status: "failed",
      completedSteps: [],
      events: [],
      nextIndex: startIndex,
      error: message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Actions: Mux Track Readiness
// ─────────────────────────────────────────────────────────────────────────────

export async function isCaptionTrackReadyAction(
  assetId: string,
  targetLang: string,
): Promise<boolean> {
  const asset = await getAsset(assetId);
  const track = findTextTrack(asset, targetLang);
  return Boolean(track);
}

export async function isAudioTrackReadyAction(
  assetId: string,
  targetLang: string,
): Promise<boolean> {
  const asset = await getAsset(assetId);
  const track = findAudioTrack(asset, targetLang);
  return Boolean(track);
}
