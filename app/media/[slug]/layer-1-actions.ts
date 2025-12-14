"use server";

import { getRun, start } from "workflow/api";

import { env } from "@/app/lib/env";
import { getSummaryAndTagsWorkflow } from "@/workflows/get-summary-and-tags";
import type { SummaryStepId, SummaryWorkflowResult } from "@/workflows/get-summary-and-tags";
import type { getSummaryAndTags } from "@mux/ai/workflows";

export type SummaryTone = "normal" | "professional" | "sassy";

export type Layer1SummaryState =
  { status: "idle" } |
  { status: "running" } |
  { status: "success"; result: Awaited<ReturnType<typeof getSummaryAndTags>> } |
  { status: "error"; error: string };

export type SummaryStatus = "idle" | "starting" | "running" | "completed" | "failed";

interface ProgressEvent<TStep extends string> {
  type: "current" | "completed";
  step: TStep;
}

export interface SummaryWorkflowStartResult {
  runId: string;
  status: SummaryStatus;
  error?: string;
}

export interface SummaryWorkflowPollResult {
  status: SummaryStatus;
  completedSteps: SummaryStepId[];
  currentStep?: SummaryStepId;
  nextIndex: number;
  error?: string;
  result?: Awaited<ReturnType<typeof getSummaryAndTags>>;
}

function getProviderConfig() {
  if (env.ANTHROPIC_API_KEY) {
    return { provider: "anthropic" as const, anthropicApiKey: env.ANTHROPIC_API_KEY };
  }

  if (env.OPENAI_API_KEY) {
    return { provider: "openai" as const, openaiApiKey: env.OPENAI_API_KEY };
  }

  if (env.GOOGLE_GENERATIVE_AI_API_KEY) {
    return { provider: "google" as const, googleApiKey: env.GOOGLE_GENERATIVE_AI_API_KEY };
  }

  return null;
}

function mapWorkflowStatus(status: string): SummaryStatus {
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
  return "failed";
}

async function readProgressEvents<TEvent extends { type: string }>(
  stream: ReadableStream<TEvent>,
): Promise<TEvent[]> {
  const reader = stream.getReader();
  const events: TEvent[] = [];

  try {
    for (let i = 0; i < 50; i++) {
      const readPromise = reader.read();
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

export async function startSummaryWorkflowAction(
  assetId: string,
  tone: SummaryTone,
): Promise<SummaryWorkflowStartResult> {
  if (!assetId) {
    return { runId: "", status: "failed", error: "Missing assetId." };
  }

  const providerConfig = getProviderConfig();
  if (!providerConfig) {
    return {
      runId: "",
      status: "failed",
      error:
        "No AI provider API key found. Set one of OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY.",
    };
  }

  try {
    const run = await start(getSummaryAndTagsWorkflow, [assetId, {
      muxTokenId: env.MUX_TOKEN_ID,
      muxTokenSecret: env.MUX_TOKEN_SECRET,
      tone,
      includeTranscript: true,
      cleanTranscript: true,
      ...providerConfig,
    }]);

    return { runId: run.runId, status: "running" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start summary workflow";
    return { runId: "", status: "failed", error: message };
  }
}

export async function pollSummaryWorkflowAction(
  runId: string,
  startIndex = 0,
): Promise<SummaryWorkflowPollResult> {
  try {
    const run = getRun<SummaryWorkflowResult>(runId);

    const workflowStatus = await run.status;
    const status = mapWorkflowStatus(workflowStatus);

    const events = await readProgressEvents(
      run.getReadable<ProgressEvent<SummaryStepId>>({ namespace: "progress", startIndex }),
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

export async function generateSummaryAndTagsAction(
  _prevState: Layer1SummaryState,
  formData: FormData,
): Promise<Layer1SummaryState> {
  const assetId = String(formData.get("assetId") || "");
  const toneInput = formData.get("tone");
  const tone: SummaryTone =
    (toneInput === "professional" || toneInput === "sassy") ?
      toneInput :
      "normal";

  if (!assetId) {
    return { status: "error", error: "Missing assetId." };
  }

  const providerConfig = getProviderConfig();
  if (!providerConfig) {
    return {
      status: "error",
      error:
        "No AI provider API key found. Set one of OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY.",
    };
  }

  try {
    const run = await start(getSummaryAndTagsWorkflow, [assetId, {
      muxTokenId: env.MUX_TOKEN_ID,
      muxTokenSecret: env.MUX_TOKEN_SECRET,
      tone,
      includeTranscript: true,
      cleanTranscript: true,
      ...providerConfig,
    }]);

    const workflowResult = await run.returnValue;
    if (!workflowResult.success || !workflowResult.result) {
      return {
        status: "error",
        error: workflowResult.error || "Failed to generate summary.",
      };
    }

    return { status: "success", result: workflowResult.result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate summary.";
    return { status: "error", error: message };
  }
}
