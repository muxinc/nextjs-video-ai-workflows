"use server";

import { eq } from "drizzle-orm";
import { getRun, start } from "workflow/api";

import { env } from "@/app/lib/env";
import { recordMetric } from "@/app/lib/metrics";
import { checkRateLimit, formatTimeUntilReset, getClientIp } from "@/app/lib/rate-limit";
import type { WorkflowStatus } from "@/app/media/types";
import { db, videos } from "@/db";
import { getSummaryAndTagsWorkflow } from "@/workflows/get-summary-and-tags";
import type { GetSummaryAndTagsResult, SummaryStepId, SummaryWorkflowResult } from "@/workflows/get-summary-and-tags";

import { mapWorkflowStatus, readProgressEvents } from "../workflows-panel/helpers";

export type SummaryTone = "neutral" | "professional" | "playful";

type MuxSummaryTone = NonNullable<Parameters<typeof getSummaryAndTagsWorkflow>[1]>["tone"];

export type SummaryStatus = WorkflowStatus;
export type SummaryResult = NonNullable<GetSummaryAndTagsResult>;

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
  result?: SummaryResult;
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

export async function startSummaryWorkflowAction(
  assetId: string,
  tone: SummaryTone,
): Promise<SummaryWorkflowStartResult> {
  if (!assetId) {
    return { runId: "", status: "failed", error: "Missing assetId." };
  }

  // Check rate limit
  const clientIp = await getClientIp();
  const rateLimitResult = await checkRateLimit(clientIp, "summary");

  if (!rateLimitResult.allowed) {
    const retryAfterSeconds = Math.ceil((rateLimitResult.resetAt.getTime() - Date.now()) / 1000);
    return {
      runId: "",
      status: "failed",
      error: `Rate limit exceeded. Try again ${formatTimeUntilReset(retryAfterSeconds)}.`,
    };
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
    const muxTone: MuxSummaryTone = tone;
    const run = await start(getSummaryAndTagsWorkflow, [assetId, {
      tone: muxTone,
      includeTranscript: true,
      cleanTranscript: true,
      ...providerConfig,
    }]);

    // Record metric
    void recordMetric("summarize-and-tag", { assetId, tone });

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

export interface SaveSummaryResult {
  success: boolean;
  error?: string;
}

export async function saveSummaryAndTagsAction(
  assetId: string,
  summary: string,
  tags: string[],
): Promise<SaveSummaryResult> {
  try {
    await db
      .update(videos)
      .set({
        summary,
        tags,
        updatedAt: new Date(),
      })
      .where(eq(videos.muxAssetId, assetId));

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save summary";
    return { success: false, error: message };
  }
}
