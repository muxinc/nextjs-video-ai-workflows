import { getWritable } from "workflow";

import { env } from "@/app/lib/env";
import type { ProgressResponse } from "@/remotion/domain/schema";

import { closeStream, sleepMs, writeToStream } from "./workflow-progress";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type RenderStepId = "prepare" | "render" | "finalize";

export interface RenderVideoInput {
  assetId: string;
  compositionId: string;
  inputProps: Record<string, unknown>;
  fileName: string;
  baseUrl: string; // Required: the app's base URL for API calls
}

export interface RenderVideoResult {
  url: string;
  size: number;
}

export interface RenderWorkflowResult {
  success: boolean;
  currentStep: RenderStepId;
  completedSteps: RenderStepId[];
  result?: RenderVideoResult;
  error?: string;
}

interface RenderProgressEvent {
  type: "current" | "completed";
  step: RenderStepId;
  progress?: number; // 0-1 for render step
}

interface LambdaRenderResponse {
  renderId: string;
  bucketName: string;
}

interface ApiResponse<T> {
  type: "success" | "error";
  data?: T;
  message?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Workflow
// ─────────────────────────────────────────────────────────────────────────────

export async function renderVideoWorkflow(
  input: RenderVideoInput,
): Promise<RenderWorkflowResult> {
  "use workflow";

  const completedSteps: RenderStepId[] = [];
  const progress = getWritable<RenderProgressEvent>({ namespace: "progress" });

  try {
    await prepareRenderStep(progress, input);
    completedSteps.push("prepare");

    const lambdaResult = await startRenderStep(progress, input);
    completedSteps.push("render");

    const result = await finalizeRenderStep(progress, input, lambdaResult);
    completedSteps.push("finalize");

    return {
      success: true,
      currentStep: "finalize",
      completedSteps,
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Render workflow failed";

    try {
      await closeStream(progress);
    } catch {
      // ignore - stream may already be closed or in an invalid state
    }

    return {
      success: false,
      currentStep: completedSteps.at(-1) ?? "prepare",
      completedSteps,
      error: message,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow Steps
// ─────────────────────────────────────────────────────────────────────────────

async function prepareRenderStep(
  progress: WritableStream<RenderProgressEvent>,
  input: RenderVideoInput,
): Promise<void> {
  "use step";
  await writeToStream(progress, { type: "current", step: "prepare" });

  // Validate inputs
  if (!input.assetId || !input.fileName || !input.compositionId) {
    throw new Error("Missing required parameters for video render");
  }

  if (!input.baseUrl) {
    throw new Error("Missing baseUrl for API calls");
  }

  if (!env.REMOTION_AWS_ACCESS_KEY_ID || !env.REMOTION_AWS_SECRET_ACCESS_KEY) {
    throw new Error("Remotion Lambda env keys required");
  }

  await sleepMs(300);
  await writeToStream(progress, { type: "completed", step: "prepare" });
}

async function startRenderStep(
  progress: WritableStream<RenderProgressEvent>,
  input: RenderVideoInput,
): Promise<LambdaRenderResponse> {
  "use step";
  await writeToStream(progress, { type: "current", step: "render", progress: 0 });

  // Call the render API route
  const renderResponse = await fetch(`${input.baseUrl}/api/lambda/render`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: input.compositionId,
      inputProps: input.inputProps,
      fileName: input.fileName,
    }),
  });

  const renderJson = await renderResponse.json() as ApiResponse<LambdaRenderResponse>;

  if (renderJson.type === "error") {
    throw new Error(renderJson.message || "Failed to start render");
  }

  if (!renderJson.data) {
    throw new Error("No render data returned");
  }

  const { renderId, bucketName } = renderJson.data;

  // Poll for completion
  let pending = true;
  while (pending) {
    const progressResponse = await fetch(`${input.baseUrl}/api/lambda/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: renderId,
        bucketName,
      }),
    });

    const progressJson = await progressResponse.json() as ApiResponse<ProgressResponse>;

    if (progressJson.type === "error") {
      throw new Error(progressJson.message || "Failed to get render progress");
    }

    if (!progressJson.data) {
      throw new Error("No progress data returned");
    }

    const progressData = progressJson.data;

    if (progressData.type === "error") {
      throw new Error(progressData.message);
    }

    if (progressData.type === "done") {
      pending = false;
    } else {
      // Update progress
      await writeToStream(progress, {
        type: "current",
        step: "render",
        progress: progressData.progress,
      });
      await sleepMs(1000);
    }
  }

  await writeToStream(progress, { type: "completed", step: "render" });
  return { renderId, bucketName };
}

async function finalizeRenderStep(
  progress: WritableStream<RenderProgressEvent>,
  input: RenderVideoInput,
  lambdaResult: LambdaRenderResponse,
): Promise<RenderVideoResult> {
  "use step";
  await writeToStream(progress, { type: "current", step: "finalize" });

  // Get final render info
  const progressResponse = await fetch(`${input.baseUrl}/api/lambda/progress`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: lambdaResult.renderId,
      bucketName: lambdaResult.bucketName,
    }),
  });

  const progressJson = await progressResponse.json() as ApiResponse<ProgressResponse>;

  if (progressJson.type === "error" || !progressJson.data) {
    throw new Error(progressJson.message || "Failed to get final render status");
  }

  const progressData = progressJson.data;

  if (progressData.type !== "done") {
    throw new Error("Render not complete in finalize step");
  }

  await sleepMs(200);
  await writeToStream(progress, { type: "completed", step: "finalize" });
  await closeStream(progress);

  return {
    url: progressData.url,
    size: progressData.size,
  };
}
