"use server";

import { getRun, start } from "workflow/api";

import { findAudioTrack, findTextTrack, getAsset } from "@/app/lib/mux";
import { translateAudioWorkflow } from "@/workflows/translate-audio";
import { translateCaptionsWorkflow } from "@/workflows/translate-captions";

import { mapWorkflowStatus, readProgressEvents } from "../workflows-panel/helpers";

import type { AudioStepId, CaptionStepId, TranslationStatus } from "./constants";

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
 */
export async function startCaptionTranslationAction(
  assetId: string,
  targetLang: string,
): Promise<WorkflowStartResult> {
  return await startWorkflowAction(translateCaptionsWorkflow, [
    assetId,
    "en", // source language is always English for now
    targetLang,
  ]);
}

/**
 * Start audio translation workflow (non-blocking)
 * Returns immediately with run ID for polling
 */
export async function startAudioTranslationAction(
  assetId: string,
  targetLang: string,
): Promise<WorkflowStartResult> {
  return await startWorkflowAction(translateAudioWorkflow, [assetId, targetLang]);
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
 * Poll audio translation workflow status
 */
export async function pollAudioTranslationAction(
  runId: string,
  startIndex = 0,
): Promise<AudioTranslationResult> {
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
