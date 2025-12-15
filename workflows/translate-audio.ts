import { getWritable } from "workflow";
import { start } from "workflow/api";

import { env } from "@/app/lib/env";
import { findAudioTrack, getAsset } from "@/app/lib/mux";
import type { AudioStepId } from "@/app/media/[slug]/localization/constants";
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

    await confirmUpload(progress, assetId, targetLang, result);
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

function getTrackIdFromResult(result: TranslateAudioResult): string | undefined {
  const candidate = result as unknown as Record<string, unknown>;

  const direct = candidate.trackId;
  if (typeof direct === "string" && direct.length) {
    return direct;
  }

  const muxTrackId = candidate.muxTrackId;
  if (typeof muxTrackId === "string" && muxTrackId.length) {
    return muxTrackId;
  }

  const nestedTrack = candidate.track;
  if (nestedTrack && typeof nestedTrack === "object") {
    const id = (nestedTrack as { id?: unknown }).id;
    if (typeof id === "string" && id.length) {
      return id;
    }
  }

  const nestedMux = candidate.mux;
  if (nestedMux && typeof nestedMux === "object") {
    const id = (nestedMux as { trackId?: unknown }).trackId;
    if (typeof id === "string" && id.length) {
      return id;
    }
  }

  return undefined;
}

async function waitForMuxAudioTrackReady(
  assetId: string,
  targetLang: string,
  trackId?: string,
): Promise<void> {
  const startedAt = Date.now();
  const timeoutMs = 10 * 60 * 1000;
  let delayMs = 1000;

  while (Date.now() - startedAt < timeoutMs) {
    const asset = await getAsset(assetId);

    const track = trackId ?
        (asset.tracks || []).find(t => t.id === trackId) :
        findAudioTrack(asset, targetLang);

    if (track && track.status === "ready") {
      return;
    }

    await sleepMs(delayMs);
    delayMs = Math.min(Math.round(delayMs * 1.35), 15_000);
  }

  throw new Error(
    `Dubbed audio uploaded but is still processing on Mux (lang: ${targetLang}). Please try again in a few minutes.`,
  );
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
  if (!env.ELEVENLABS_API_KEY) {
    throw new Error("ElevenLabs env key required");
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
  assetId: string,
  targetLang: string,
  result: TranslateAudioResult,
): Promise<void> {
  "use step";
  await writeToStream(progress, { type: "current", step: "upload" });
  if (!result) {
    throw new Error("Audio dubbing completed but no result returned");
  }

  // `@mux/ai` returns once the upload request is accepted, but the newly-attached
  // audio track can take additional time to transition to `ready` on the asset.
  // Keep the workflow in the "upload" step until the track is actually ready.
  const trackId = getTrackIdFromResult(result);
  await waitForMuxAudioTrackReady(assetId, targetLang, trackId);

  await writeToStream(progress, { type: "completed", step: "upload" });
  await closeStream(progress);
}
