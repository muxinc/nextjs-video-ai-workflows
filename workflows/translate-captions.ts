import { getWritable } from "workflow";
import { start } from "workflow/api";

import type { CaptionStepId } from "@/app/media/[slug]/layer-2-constants";
import { translateCaptions } from "@mux/ai/workflows";

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
  let streamClosed = false;

  try {
    // Step 1: Prepare
    await prepareTranslation(progress, assetId, sourceLang, targetLang);
    completedSteps.push("prepare");

    // Step 2: Translate (start the @mux/ai workflow using start() and await result)
    const result = await doTranslateCaptions(progress, assetId, sourceLang, targetLang);
    completedSteps.push("translate");

    // Step 3: Upload confirmation (the upload happens in doTranslateCaptions with uploadToMux: true)
    await confirmUpload(progress, result);
    completedSteps.push("upload");
    streamClosed = true;

    return {
      success: true,
      currentStep: "upload",
      completedSteps,
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Caption workflow failed";

    // Close the progress stream on error if not already closed
    if (!streamClosed) {
      try {
        const writer = progress.getWriter();
        await writer.close();
      } catch {
        // ignore - stream may be in an invalid state
      }
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
  const writer = progress.getWriter();
  await writer.write({ type: "current", step: "prepare" });
  // Validation and preparation step
  if (!assetId || !sourceLang || !targetLang) {
    throw new Error("Missing required parameters for caption translation");
  }
  // Small delay to make the step visible in UI
  await new Promise(resolve => setTimeout(resolve, 500));
  await writer.write({ type: "completed", step: "prepare" });
  writer.releaseLock();
}

async function doTranslateCaptions(
  progress: WritableStream<CaptionProgressEvent>,
  assetId: string,
  sourceLang: string,
  targetLang: string,
): Promise<TranslateCaptionsResult> {
  "use step";
  const writer = progress.getWriter();
  await writer.write({ type: "current", step: "translate" });

  // The @mux/ai translateCaptions is itself a workflow function,
  // so we must start it using start() from workflow/api
  const run = await start(translateCaptions, [
    assetId,
    sourceLang,
    targetLang,
    {
      uploadToMux: true,
      provider: "openai",
    },
  ]);

  // Wait for the nested workflow to complete and return its result
  const result = await run.returnValue;
  await writer.write({ type: "completed", step: "translate" });
  writer.releaseLock();
  return result;
}

async function confirmUpload(
  progress: WritableStream<CaptionProgressEvent>,
  result: TranslateCaptionsResult,
): Promise<void> {
  "use step";
  const writer = progress.getWriter();
  await writer.write({ type: "current", step: "upload" });
  // Verify the result contains expected data
  if (!result) {
    throw new Error("Translation completed but no result returned");
  }
  // Small delay to make the step visible in UI
  await new Promise(resolve => setTimeout(resolve, 300));
  await writer.write({ type: "completed", step: "upload" });
  await writer.close();
}
