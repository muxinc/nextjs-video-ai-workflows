import { getWritable } from "workflow";
import { start } from "workflow/api";

import type { AudioStepId } from "@/app/media/[slug]/layer-2-constants";
import { translateAudio } from "@mux/ai/workflows";

export type TranslateAudioResult = Awaited<ReturnType<typeof translateAudio>>;
export type { AudioStepId };

export interface AudioWorkflowResult {
  success: boolean;
  currentStep: AudioStepId;
  completedSteps: AudioStepId[];
  result?: TranslateAudioResult;
  error?: string;
}

interface AudioProgressEvent {
  type: "current" | "completed";
  step: AudioStepId;
}

export async function translateAudioWorkflow(
  assetId: string,
  targetLang: string,
): Promise<AudioWorkflowResult> {
  "use workflow";

  const completedSteps: AudioStepId[] = [];
  const progress = getWritable<AudioProgressEvent>({ namespace: "progress" });
  let streamClosed = false;

  try {
    // Step 1: Prepare
    await prepareAudio(progress, assetId, targetLang);
    completedSteps.push("prepare");

    // Step 2: Generate dubbed audio (start the @mux/ai workflow using start() and await result)
    const result = await doTranslateAudio(progress, assetId, targetLang);
    completedSteps.push("generate");

    // Step 3: Upload confirmation (the upload happens in doTranslateAudio with uploadToMux: true)
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
    const message = error instanceof Error ? error.message : "Audio workflow failed";

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

async function prepareAudio(
  progress: WritableStream<AudioProgressEvent>,
  assetId: string,
  targetLang: string,
): Promise<void> {
  "use step";
  const writer = progress.getWriter();
  await writer.write({ type: "current", step: "prepare" });
  // Validation and preparation step
  if (!assetId || !targetLang) {
    throw new Error("Missing required parameters for audio translation");
  }
  // Small delay to make the step visible in UI
  await new Promise(resolve => setTimeout(resolve, 500));
  await writer.write({ type: "completed", step: "prepare" });
  writer.releaseLock();
}

async function doTranslateAudio(
  progress: WritableStream<AudioProgressEvent>,
  assetId: string,
  targetLang: string,
): Promise<TranslateAudioResult> {
  "use step";
  const writer = progress.getWriter();
  await writer.write({ type: "current", step: "generate" });

  // The @mux/ai translateAudio is itself a workflow function,
  // so we must start it using start() from workflow/api
  const run = await start(translateAudio, [
    assetId,
    targetLang,
    {
      uploadToMux: true,
    },
  ]);

  // Wait for the nested workflow to complete and return its result
  const result = await run.returnValue;
  await writer.write({ type: "completed", step: "generate" });
  writer.releaseLock();
  return result;
}

async function confirmUpload(
  progress: WritableStream<AudioProgressEvent>,
  result: TranslateAudioResult,
): Promise<void> {
  "use step";
  const writer = progress.getWriter();
  await writer.write({ type: "current", step: "upload" });
  // Verify the result contains expected data
  if (!result) {
    throw new Error("Audio dubbing completed but no result returned");
  }
  // Small delay to make the step visible in UI
  await new Promise(resolve => setTimeout(resolve, 300));
  await writer.write({ type: "completed", step: "upload" });
  await writer.close();
}
