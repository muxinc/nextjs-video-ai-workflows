"use server";

import { headers } from "next/headers";
import { getRun, start } from "workflow/api";

import { env } from "@/app/lib/env";
import { getMuxAudioUrl } from "@/app/lib/mux";
import type { PlaybackPolicy } from "@/app/lib/mux";
import type { WorkflowStatus } from "@/app/media/types";
import type { AspectRatio, CaptionCue } from "@/remotion/social-clip/constants";
import { ASPECT_RATIO_CONFIG } from "@/remotion/social-clip/constants";
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

export interface SocialClipInput {
  playbackId: string;
  playbackPolicy: PlaybackPolicy;
  startTime: number;
  endTime: number;
  title?: string;
  captions: CaptionCue[];
}

export interface RenderSocialClipsInput {
  assetId: string;
  clip: SocialClipInput;
}

export interface ClipRenderResult {
  aspectRatio: AspectRatio;
  runId: string;
  status: WorkflowStatus;
  error?: string;
}

export interface RenderSocialClipsResult {
  clips: ClipRenderResult[];
}

export interface ClipPollResult {
  aspectRatio: AspectRatio;
  status: WorkflowStatus;
  completedSteps: RenderStepId[];
  currentStep?: RenderStepId;
  nextIndex: number;
  error?: string;
  result?: RenderVideoResult;
  renderProgress?: number;
}

export interface PollSocialClipsResult {
  clips: ClipPollResult[];
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
 * Start render workflows for all 3 aspect ratios (non-blocking)
 * Returns immediately with run IDs for polling
 */
export async function startSocialClipsRenderAction(
  input: RenderSocialClipsInput,
): Promise<RenderSocialClipsResult> {
  const { assetId, clip } = input;

  if (!env.REMOTION_AWS_ACCESS_KEY_ID || !env.REMOTION_AWS_SECRET_ACCESS_KEY) {
    const aspectRatios: AspectRatio[] = ["portrait", "square", "landscape"];
    return {
      clips: aspectRatios.map(aspectRatio => ({
        aspectRatio,
        runId: "",
        status: "failed",
        error: "Remotion Lambda env keys required",
      })),
    };
  }

  const baseUrl = await getBaseUrl();

  // Generate signed audio URL if needed (server-side to support signed playback)
  const audioUrl = await getMuxAudioUrl(clip.playbackId, clip.playbackPolicy);

  const aspectRatios: AspectRatio[] = ["portrait", "square", "landscape"];
  const results: ClipRenderResult[] = [];

  for (const aspectRatio of aspectRatios) {
    const config = ASPECT_RATIO_CONFIG[aspectRatio];
    const fileName = `social-clip-${aspectRatio}-${assetId}.mp4`;

    try {
      const run = await start(renderVideoWorkflow, [{
        assetId,
        compositionId: config.id,
        inputProps: {
          audioUrl,
          startTime: clip.startTime,
          endTime: clip.endTime,
          title: clip.title,
          captions: clip.captions,
        },
        fileName,
        baseUrl,
      }]);

      results.push({
        aspectRatio,
        runId: run.runId,
        status: "running",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start render";
      results.push({
        aspectRatio,
        runId: "",
        status: "failed",
        error: message,
      });
    }
  }

  return { clips: results };
}

/**
 * Poll render workflow status for multiple clips
 */
export async function pollSocialClipsRenderAction(
  clips: Array<{ aspectRatio: AspectRatio; runId: string; nextIndex: number }>,
): Promise<PollSocialClipsResult> {
  const results: ClipPollResult[] = [];

  for (const clipInfo of clips) {
    try {
      const run = getRun<RenderWorkflowResult>(clipInfo.runId);
      const workflowStatus = await run.status;
      const status = mapWorkflowStatus(workflowStatus);

      const events = await readProgressEvents(
        run.getReadable<RenderProgressEvent>({ namespace: "progress", startIndex: clipInfo.nextIndex }),
      );

      const lastCurrent = [...events].reverse().find(e => e.type === "current");
      const completedFromEvents = events
        .filter(e => e.type === "completed")
        .map(e => e.step);

      const renderProgressEvent = [...events].reverse().find(
        e => e.step === "render" && e.progress !== undefined,
      );

      if (status === "completed" || status === "failed") {
        const result = await run.returnValue;
        results.push({
          aspectRatio: clipInfo.aspectRatio,
          status: result.success ? "completed" : "failed",
          completedSteps: result.completedSteps,
          currentStep: result.currentStep,
          nextIndex: clipInfo.nextIndex + events.length,
          error: result.error,
          result: result.result,
        });
      } else {
        results.push({
          aspectRatio: clipInfo.aspectRatio,
          status,
          completedSteps: completedFromEvents,
          currentStep: lastCurrent?.step,
          nextIndex: clipInfo.nextIndex + events.length,
          renderProgress: renderProgressEvent?.progress,
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to poll workflow";
      results.push({
        aspectRatio: clipInfo.aspectRatio,
        status: "failed",
        completedSteps: [],
        nextIndex: clipInfo.nextIndex,
        error: message,
      });
    }
  }

  return { clips: results };
}
