import { getWritable } from "workflow";
import { start } from "workflow/api";

import type { AudioStepId } from "@/app/media/[slug]/layer-2-constants";
import { translateAudio } from "@mux/ai/workflows";

import { closeStream, sleepMs, writeToStream } from "./workflow-progress";

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

  try {
    await prepareAudio(progress, assetId, targetLang);
    completedSteps.push("prepare");

    const result = await doTranslateAudio(progress, assetId, targetLang);
    completedSteps.push("generate");

    await confirmUpload(progress, result);
    completedSteps.push("upload");

    return {
      success: true,
      currentStep: "upload",
      completedSteps,
      result,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Audio workflow failed";

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

async function prepareAudio(
  progress: WritableStream<AudioProgressEvent>,
  assetId: string,
  targetLang: string,
): Promise<void> {
  "use step";
  await writeToStream(progress, { type: "current", step: "prepare" });
  if (!assetId || !targetLang) {
    throw new Error("Missing required parameters for audio translation");
  }
  await sleepMs(500);
  await writeToStream(progress, { type: "completed", step: "prepare" });
}

async function doTranslateAudio(
  progress: WritableStream<AudioProgressEvent>,
  assetId: string,
  targetLang: string,
): Promise<TranslateAudioResult> {
  "use step";
  await writeToStream(progress, { type: "current", step: "generate" });
  const run = await start(translateAudio, [
    assetId,
    targetLang,
    {
      uploadToMux: true,
    },
  ]);

  const result = await run.returnValue;
  await writeToStream(progress, { type: "completed", step: "generate" });
  return result;
}

async function confirmUpload(
  progress: WritableStream<AudioProgressEvent>,
  result: TranslateAudioResult,
): Promise<void> {
  "use step";
  await writeToStream(progress, { type: "current", step: "upload" });
  if (!result) {
    throw new Error("Audio dubbing completed but no result returned");
  }
  await sleepMs(300);
  await writeToStream(progress, { type: "completed", step: "upload" });
  await closeStream(progress);
}
