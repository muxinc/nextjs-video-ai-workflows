"use server";

import { headers } from "next/headers";
import { getRun, start } from "workflow/api";

import type { WorkflowStatus } from "@/app/media/types";
import { renderVideoWorkflow } from "@/workflows/render-video";
import type { RenderStepId, RenderVideoResult, RenderWorkflowResult } from "@/workflows/render-video";

import { mapWorkflowStatus, readProgressEvents } from "../workflows-panel/helpers";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface RenderProgressEvent {
  type: "current" | "completed";
  step: RenderStepId;
  progress?: number;
}

export interface RenderWorkflowStartInput {
  assetId: string;
  compositionId: string;
  inputProps: Record<string, unknown>;
  fileName: string;
}

export interface RenderWorkflowStartResult {
  runId: string;
  status: WorkflowStatus;
  error?: string;
}

export interface RenderWorkflowPollResult {
  status: WorkflowStatus;
  completedSteps: RenderStepId[];
  currentStep?: RenderStepId;
  nextIndex: number;
  error?: string;
  result?: RenderVideoResult;
  renderProgress?: number;
}

export type { RenderStepId, RenderVideoResult };

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getBaseUrl(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const protocol = headersList.get("x-forwarded-proto") || "http";
  return `${protocol}://${host}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Start render video workflow (non-blocking)
 * Returns immediately with run ID for polling
 */
export async function startRenderWorkflowAction(
  input: RenderWorkflowStartInput,
): Promise<RenderWorkflowStartResult> {
  if (!input.assetId) {
    return { runId: "", status: "failed", error: "Missing assetId." };
  }

  if (!input.fileName) {
    return { runId: "", status: "failed", error: "Missing fileName." };
  }

  if (!input.compositionId) {
    return { runId: "", status: "failed", error: "Missing compositionId." };
  }

  try {
    const baseUrl = await getBaseUrl();

    const run = await start(renderVideoWorkflow, [{
      ...input,
      baseUrl,
    }]);

    return { runId: run.runId, status: "running" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start render workflow";
    return { runId: "", status: "failed", error: message };
  }
}

/**
 * Poll render workflow status
 */
export async function pollRenderWorkflowAction(
  runId: string,
  startIndex = 0,
): Promise<RenderWorkflowPollResult> {
  try {
    const run = getRun<RenderWorkflowResult>(runId);

    const workflowStatus = await run.status;
    const status = mapWorkflowStatus(workflowStatus);

    const events = await readProgressEvents(
      run.getReadable<RenderProgressEvent>({ namespace: "progress", startIndex }),
    );

    const lastCurrent = [...events].reverse().find(e => e.type === "current");
    const completedFromEvents = events
      .filter(e => e.type === "completed")
      .map(e => e.step);

    // Extract render progress from latest render step event
    const renderProgressEvent = [...events].reverse().find(
      e => e.step === "render" && e.progress !== undefined,
    );

    if (status === "completed" || status === "failed") {
      const result = await run.returnValue;
      return {
        status: result.success ? "completed" : "failed",
        completedSteps: result.completedSteps,
        currentStep: result.currentStep,
        nextIndex: startIndex + events.length,
        error: result.error,
        result: result.result,
      };
    }

    return {
      status,
      completedSteps: completedFromEvents,
      currentStep: lastCurrent?.step,
      nextIndex: startIndex + events.length,
      renderProgress: renderProgressEvent?.progress,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to poll workflow status";
    return {
      status: "failed",
      completedSteps: [],
      nextIndex: startIndex,
      error: message,
    };
  }
}
