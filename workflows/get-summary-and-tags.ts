import { getWritable } from "workflow";
import { start } from "workflow/api";

import { getSummaryAndTags } from "@mux/ai/workflows";

import { closeStream, sleepMs, writeToStream } from "./workflow-progress";

export type GetSummaryAndTagsOptions = Parameters<typeof getSummaryAndTags>[1];
export type GetSummaryAndTagsResult = Awaited<ReturnType<typeof getSummaryAndTags>>;

export type SummaryStepId = "prepare" | "generate" | "finalize";

export interface SummaryWorkflowResult {
  success: boolean;
  currentStep: SummaryStepId;
  completedSteps: SummaryStepId[];
  result?: GetSummaryAndTagsResult;
  error?: string;
}

interface SummaryProgressEvent {
  type: "current" | "completed";
  step: SummaryStepId;
}

export async function getSummaryAndTagsWorkflow(
  assetId: string,
  options?: GetSummaryAndTagsOptions,
): Promise<SummaryWorkflowResult> {
  "use workflow";

  const completedSteps: SummaryStepId[] = [];
  const progress = getWritable<SummaryProgressEvent>({ namespace: "progress" });

  try {
    await prepareSummaryStep(progress, assetId);
    completedSteps.push("prepare");

    const result = await generateSummaryAndTagsStep(progress, assetId, options);
    completedSteps.push("generate");

    await finalizeSummaryStep(progress);
    completedSteps.push("finalize");

    return {
      success: true,
      currentStep: "finalize",
      completedSteps,
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Summary workflow failed";

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

async function prepareSummaryStep(
  progress: WritableStream<SummaryProgressEvent>,
  assetId: string,
): Promise<void> {
  "use step";
  await writeToStream(progress, { type: "current", step: "prepare" });
  if (!assetId) {
    throw new Error("Missing required parameters for summary generation");
  }
  await sleepMs(250);
  await writeToStream(progress, { type: "completed", step: "prepare" });
}

async function generateSummaryAndTagsStep(
  progress: WritableStream<SummaryProgressEvent>,
  assetId: string,
  options?: GetSummaryAndTagsOptions,
): Promise<GetSummaryAndTagsResult> {
  "use step";
  await writeToStream(progress, { type: "current", step: "generate" });
  const run = await start(getSummaryAndTags, [assetId, options]);
  const result = await run.returnValue;
  await writeToStream(progress, { type: "completed", step: "generate" });
  return result;
}

async function finalizeSummaryStep(progress: WritableStream<SummaryProgressEvent>): Promise<void> {
  "use step";
  await writeToStream(progress, { type: "current", step: "finalize" });
  await sleepMs(150);
  await writeToStream(progress, { type: "completed", step: "finalize" });
  await closeStream(progress);
}
