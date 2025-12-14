import { getWritable } from "workflow";
import { start } from "workflow/api";

import type { CaptionStepId } from "@/app/media/[slug]/localization/constants";
import { translateCaptions } from "@mux/ai/workflows";

import { closeStream, sleepMs, writeToStream } from "./workflow-progress";

export type TranslateCaptionsResult = Awaited<ReturnType<typeof translateCaptions>>;
export type { CaptionStepId };

export interface CaptionWorkflowResult {
  success: boolean;
  currentStep: CaptionStepId;
  completedSteps: CaptionStepId[];
  result?: TranslateCaptionsResult;
  error?: string;
}

interface CaptionProgressEvent {
  type: "current" | "completed";
  step: CaptionStepId;
}

export async function translateCaptionsWorkflow(
  assetId: string,
  sourceLang: string,
  targetLang: string,
): Promise<CaptionWorkflowResult> {
  "use workflow";

  const completedSteps: CaptionStepId[] = [];
  const progress = getWritable<CaptionProgressEvent>({ namespace: "progress" });

  try {
    await prepareTranslation(progress, assetId, sourceLang, targetLang);
    completedSteps.push("prepare");

    const result = await doTranslateCaptions(progress, assetId, sourceLang, targetLang);
    completedSteps.push("translate");

    await confirmUpload(progress, result);
    completedSteps.push("upload");

    return {
      success: true,
      currentStep: "upload",
      completedSteps,
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Caption workflow failed";

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

async function prepareTranslation(
  progress: WritableStream<CaptionProgressEvent>,
  assetId: string,
  sourceLang: string,
  targetLang: string,
): Promise<void> {
  "use step";
  await writeToStream(progress, { type: "current", step: "prepare" });
  if (!assetId || !sourceLang || !targetLang) {
    throw new Error("Missing required parameters for caption translation");
  }
  await sleepMs(500);
  await writeToStream(progress, { type: "completed", step: "prepare" });
}

async function doTranslateCaptions(
  progress: WritableStream<CaptionProgressEvent>,
  assetId: string,
  sourceLang: string,
  targetLang: string,
): Promise<TranslateCaptionsResult> {
  "use step";
  await writeToStream(progress, { type: "current", step: "translate" });
  const run = await start(translateCaptions, [
    assetId,
    sourceLang,
    targetLang,
    {
      uploadToMux: true,
      provider: "openai",
    },
  ]);

  const result = await run.returnValue;
  await writeToStream(progress, { type: "completed", step: "translate" });
  return result;
}

async function confirmUpload(
  progress: WritableStream<CaptionProgressEvent>,
  result: TranslateCaptionsResult,
): Promise<void> {
  "use step";
  await writeToStream(progress, { type: "current", step: "upload" });
  if (!result) {
    throw new Error("Translation completed but no result returned");
  }
  await sleepMs(300);
  await writeToStream(progress, { type: "completed", step: "upload" });
  await closeStream(progress);
}
