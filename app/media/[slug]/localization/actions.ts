"use server";

import { getRun, start } from "workflow/api";

import { env } from "@/app/lib/env";
import { recordMetric } from "@/app/lib/metrics";
import { findAudioTrack, findTextTrack, getAsset } from "@/app/lib/mux";
import { translateAudioWorkflow } from "@/workflows/translate-audio";
import { translateCaptionsWorkflow } from "@/workflows/translate-captions";

import { mapWorkflowStatus, readProgressEvents } from "../workflows-panel/helpers";

import type { AudioStepId, CaptionStepId, TranslationStatus } from "./constants";

// ─────────────────────────────────────────────────────────────────────────────
// Simulated Workflow Helpers
// ─────────────────────────────────────────────────────────────────────────────
// When a translation track already exists on the Mux asset, we skip the real
// workflow and simulate progress updates to give the user visual feedback.

const SIMULATED_AUDIO_PREFIX = "simulated-audio:";
const SIMULATED_CAPTION_PREFIX = "simulated-caption:";

/**
 * Creates a simulated run ID that encodes the start time.
 * Format: `simulated-{type}:{timestamp}`
 */
function createSimulatedRunId(type: "audio" | "caption"): string {
  const prefix = type === "audio" ? SIMULATED_AUDIO_PREFIX : SIMULATED_CAPTION_PREFIX;
  return `${prefix}${Date.now()}`;
}

/**
 * Checks if a run ID is a simulated run.
 */
function isSimulatedRun(runId: string): boolean {
  return runId.startsWith(SIMULATED_AUDIO_PREFIX) || runId.startsWith(SIMULATED_CAPTION_PREFIX);
}

/**
 * Extracts the start timestamp from a simulated run ID.
 */
function getSimulatedStartTime(runId: string): number {
  const parts = runId.split(":");
  return Number.parseInt(parts[1], 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// Types (interfaces can be exported from server action files)
// ─────────────────────────────────────────────────────────────────────────────

interface WorkflowReturnValue<TStep extends string> {
  success: boolean;
  currentStep: TStep;
  completedSteps: TStep[];
  error?: string;
}

interface ProgressEvent<TStep extends string> {
  type: "current" | "completed";
  step: TStep;
}

export interface WorkflowStartResult {
  runId: string;
  status: TranslationStatus;
  error?: string;
}

export interface TranslationResult<TStep extends string> {
  status: TranslationStatus;
  completedSteps: TStep[];
  currentStep?: TStep;
  events: ProgressEvent<TStep>[];
  nextIndex: number;
  error?: string;
}

export type CaptionTranslationResult = TranslationResult<CaptionStepId>;
export type AudioTranslationResult = TranslationResult<AudioStepId>;

async function startWorkflowAction<TArgs extends unknown[]>(
  workflow: (...args: TArgs) => Promise<unknown>,
  args: TArgs,
): Promise<WorkflowStartResult> {
  try {
    const run = await start(workflow, args);
    return { runId: run.runId, status: "running" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start workflow";
    return { runId: "", status: "failed", error: message };
  }
}

async function pollTranslationAction<TStep extends string>(
  runId: string,
  startIndex: number,
): Promise<TranslationResult<TStep>> {
  const run = getRun<WorkflowReturnValue<TStep>>(runId);

  const workflowStatus = await run.status;
  const status = mapWorkflowStatus(workflowStatus);

  const events = await readProgressEvents(
    run.getReadable<ProgressEvent<TStep>>({ namespace: "progress", startIndex }),
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
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Actions: Start Workflows (Non-blocking)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start caption translation workflow (non-blocking)
 * Returns immediately with run ID for polling
 *
 * OPTIMIZATION: If the target caption track already exists on the Mux asset,
 * we skip the real workflow and return a simulated run ID. The poll action
 * will then return fake progress updates.
 */
export async function startCaptionTranslationAction(
  assetId: string,
  targetLang: string,
): Promise<WorkflowStartResult> {
  // Check if caption track already exists - skip real workflow if so
  try {
    const asset = await getAsset(assetId);
    const existingTrack = findTextTrack(asset, targetLang);
    if (existingTrack) {
      // Track already exists! Return simulated run ID to fake the progress
      console.warn(`[SIMULATED] Caption track already exists for ${targetLang} on asset ${assetId} - skipping real workflow`);
      return { runId: createSimulatedRunId("caption"), status: "running" };
    }
  } catch {
    // If we can't check, proceed with real workflow
  }

  // Record metric
  void recordMetric("translate-captions", { assetId, targetLang });

  return await startWorkflowAction(translateCaptionsWorkflow, [
    assetId,
    "en", // source language is always English for now
    targetLang,
  ]);
}

/**
 * Start audio translation workflow (non-blocking)
 * Returns immediately with run ID for polling
 *
 * OPTIMIZATION: If the target audio track already exists on the Mux asset,
 * we skip the real workflow and return a simulated run ID. The poll action
 * will then return fake progress updates.
 */
export async function startAudioTranslationAction(
  assetId: string,
  targetLang: string,
): Promise<WorkflowStartResult> {
  if (!env.ELEVENLABS_API_KEY) {
    return { runId: "", status: "failed", error: "ElevenLabs env key required" };
  }

  // Check if audio track already exists - skip real workflow if so
  try {
    const asset = await getAsset(assetId);
    const existingTrack = findAudioTrack(asset, targetLang);
    if (existingTrack) {
      // Track already exists! Return simulated run ID to fake the progress
      console.warn(`[SIMULATED] Audio track already exists for ${targetLang} on asset ${assetId} - skipping real workflow`);
      return { runId: createSimulatedRunId("audio"), status: "running" };
    }
  } catch {
    // If we can't check, proceed with real workflow
  }

  // Record metric
  void recordMetric("translate-audio", { assetId, targetLang });

  return await startWorkflowAction(translateAudioWorkflow, [assetId, targetLang]);
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Actions: Poll for Workflow Status
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Poll caption translation workflow status
 *
 * OPTIMIZATION: For simulated runs (when track already existed), returns
 * fake progress updates based on elapsed time to give realistic UX feedback.
 */
export async function pollCaptionTranslationAction(
  runId: string,
  startIndex = 0,
): Promise<CaptionTranslationResult> {
  // Handle simulated runs for existing tracks
  if (isSimulatedRun(runId)) {
    console.warn(`[SIMULATED] Polling simulated caption run: ${runId}, startIndex: ${startIndex}`);
    return simulateCaptionProgress(runId, startIndex);
  }

  try {
    return await pollTranslationAction<CaptionStepId>(runId, startIndex);
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
 * Simulates caption workflow progress for existing tracks.
 * Returns step completions based on elapsed time since the simulated run started.
 *
 * Timeline:
 * - 0-400ms: prepare in progress
 * - 400-800ms: prepare complete, translate in progress
 * - 800-1200ms: translate complete, upload in progress
 * - 1200ms+: all complete
 */
function simulateCaptionProgress(
  runId: string,
  startIndex: number,
): CaptionTranslationResult {
  const startTime = getSimulatedStartTime(runId);
  const elapsed = Date.now() - startTime;
  console.warn(`[SIMULATED] Caption progress: elapsed=${elapsed}ms, startIndex=${startIndex}`);

  const allSteps: CaptionStepId[] = ["prepare", "translate", "upload"];

  // Determine completed steps based on elapsed time
  let completedSteps: CaptionStepId[] = [];
  let status: TranslationStatus = "running";
  let currentStep: CaptionStepId = "prepare";

  if (elapsed >= 1200) {
    // All done
    completedSteps = [...allSteps];
    status = "completed";
    currentStep = "upload";
  } else if (elapsed >= 800) {
    // Upload in progress
    completedSteps = ["prepare", "translate"];
    currentStep = "upload";
  } else if (elapsed >= 400) {
    // Translate in progress
    completedSteps = ["prepare"];
    currentStep = "translate";
  }
  // else: prepare in progress (no completed steps yet)

  // Build events based on what's new since startIndex
  const events: Array<{ type: "current" | "completed"; step: CaptionStepId }> = [];
  const stepIndex = completedSteps.length;

  // Only emit events for steps we haven't reported yet
  for (let i = startIndex; i <= stepIndex && i < allSteps.length; i++) {
    if (i < completedSteps.length) {
      events.push({ type: "completed", step: allSteps[i] });
    }
    if (i === stepIndex && status !== "completed") {
      events.push({ type: "current", step: allSteps[i] });
    }
  }

  console.warn(`[SIMULATED] Caption result: status=${status}, completedSteps=[${completedSteps.join(", ")}]`);

  return {
    status,
    completedSteps,
    currentStep,
    events,
    nextIndex: stepIndex,
  };
}

/**
 * Poll audio translation workflow status
 *
 * OPTIMIZATION: For simulated runs (when track already existed), returns
 * fake progress updates based on elapsed time to give realistic UX feedback.
 */
export async function pollAudioTranslationAction(
  runId: string,
  startIndex = 0,
): Promise<AudioTranslationResult> {
  // Handle simulated runs for existing tracks
  if (isSimulatedRun(runId)) {
    console.warn(`[SIMULATED] Polling simulated audio run: ${runId}, startIndex: ${startIndex}`);
    return simulateAudioProgress(runId, startIndex);
  }

  try {
    return await pollTranslationAction<AudioStepId>(runId, startIndex);
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
 * Simulates audio workflow progress for existing tracks.
 * Returns step completions based on elapsed time since the simulated run started.
 *
 * Timeline:
 * - 0-400ms: prepare in progress
 * - 400-800ms: prepare complete, generate in progress
 * - 800-1200ms: generate complete, upload in progress
 * - 1200ms+: all complete
 */
function simulateAudioProgress(
  runId: string,
  startIndex: number,
): AudioTranslationResult {
  const startTime = getSimulatedStartTime(runId);
  const elapsed = Date.now() - startTime;
  console.warn(`[SIMULATED] Audio progress: elapsed=${elapsed}ms, startIndex=${startIndex}`);

  const allSteps: AudioStepId[] = ["prepare", "generate", "upload"];

  // Determine completed steps based on elapsed time
  let completedSteps: AudioStepId[] = [];
  let status: TranslationStatus = "running";
  let currentStep: AudioStepId = "prepare";

  if (elapsed >= 1200) {
    // All done
    completedSteps = [...allSteps];
    status = "completed";
    currentStep = "upload";
  } else if (elapsed >= 800) {
    // Upload in progress
    completedSteps = ["prepare", "generate"];
    currentStep = "upload";
  } else if (elapsed >= 400) {
    // Generate in progress
    completedSteps = ["prepare"];
    currentStep = "generate";
  }
  // else: prepare in progress (no completed steps yet)

  // Build events based on what's new since startIndex
  const events: Array<{ type: "current" | "completed"; step: AudioStepId }> = [];
  const stepIndex = completedSteps.length;

  // Only emit events for steps we haven't reported yet
  for (let i = startIndex; i <= stepIndex && i < allSteps.length; i++) {
    if (i < completedSteps.length) {
      events.push({ type: "completed", step: allSteps[i] });
    }
    if (i === stepIndex && status !== "completed") {
      events.push({ type: "current", step: allSteps[i] });
    }
  }

  console.warn(`[SIMULATED] Audio result: status=${status}, completedSteps=[${completedSteps.join(", ")}]`);

  return {
    status,
    completedSteps,
    currentStep,
    events,
    nextIndex: stepIndex,
  };
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
