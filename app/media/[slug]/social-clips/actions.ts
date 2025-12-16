"use server";

import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import dedent from "dedent";
import { headers } from "next/headers";
import { getRun, start } from "workflow/api";
import { z } from "zod";

import { env } from "@/app/lib/env";
import { findTextTrack, getMuxAudioUrl, getPlaybackIdForAsset, getTrackVtt } from "@/app/lib/mux";
import type { PlaybackPolicy } from "@/app/lib/mux";
import { parseVtt } from "@/app/media/[slug]/transcript/helpers";
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

export interface SuggestSocialClipRangeResult {
  startTime: number;
  endTime: number;
  trackId: string;
  languageCode?: string;
  rationale: string;
}

export interface PreviewClipResult extends SuggestSocialClipRangeResult {
  /** Audio URL for Remotion Player preview (full audio, use startTime for offset) */
  audioUrl: string;
  /** Playback ID for the asset */
  playbackId: string;
  /** Playback policy */
  playbackPolicy: PlaybackPolicy;
  /**
   * Captions with ORIGINAL video times (not adjusted).
   * The Remotion composition handles the offset using startTime/clipStartTime.
   */
  captions: CaptionCue[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompts
// ─────────────────────────────────────────────────────────────────────────────

const CLIP_SELECTION_SYSTEM_PROMPT = dedent`
  <role>
    You are an expert video editor specializing in creating viral social media clips.
    Your goal is to identify the most engaging, shareable moments from longer content.
  </role>

  <context>
    You are given candidate clip windows extracted from video transcripts.
    Each candidate includes an excerpt of the spoken content and timing information.
    Your job is to select the single best segment for a social media clip.
  </context>

  <selection_criteria>
    Choose segments that:
    - Stand alone without needing additional context
    - Have a clear point, punchline, or compelling insight
    - Are interesting and engaging out of context
    - Start with strong hooks that immediately grab attention
    - End on a complete thought or natural conclusion
  </selection_criteria>

  <timing_guidelines>
    Target duration is approximately 15 seconds, but natural cue boundaries take priority.

    DO:
    - Align start/end times with natural speech boundaries (sentence ends, pauses)
    - Extend slightly past 15s if it means completing a thought or sentence
    - Start slightly before 15s if it captures a complete, punchy moment
    - Respect the natural rhythm of the speaker
    - Use the candidate's startTime and endTime as your boundaries

    DON'T:
    - Cut off mid-sentence or mid-word to hit exactly 15 seconds
    - Start in the middle of a thought
    - End abruptly if the speaker is still making their point
    - Sacrifice content quality for arbitrary duration targets

    Acceptable range: 10-20 seconds, with 12-18 seconds being ideal.
  </timing_guidelines>

  <content_to_avoid>
    - Introductions ("Hey everyone, welcome to...")
    - Outros and closings ("Thanks for watching", "Subscribe", "See you next time")
    - Housekeeping ("Before we get started...", "Quick announcement...")
    - Sponsor reads and advertisements
    - Meta-commentary about the video itself
    - Filler content with low information density
  </content_to_avoid>

  <output_requirements>
    - Select exactly one candidate from the provided list
    - Return startTime and endTime in seconds
    - Times must fall within the chosen candidate's boundaries
    - Provide a brief rationale explaining your choice
  </output_requirements>`;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function getBaseUrl(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("host") || "localhost:3000";
  const protocol = headersList.get("x-forwarded-proto") || "http";
  return `${protocol}://${host}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function countWords(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) {
    return 0;
  }
  return trimmed.split(/\s+/).length;
}

function pickClipCandidates(
  cues: Array<{ startTime: number; endTime: number; text: string }>,
  options?: { targetDurationS?: number; minDurationS?: number; maxCandidates?: number; maxTextChars?: number },
) {
  const targetDurationS = options?.targetDurationS ?? 15;
  const minDurationS = options?.minDurationS ?? 8;
  const maxCandidates = options?.maxCandidates ?? 12;
  const maxTextChars = options?.maxTextChars ?? 260;

  if (cues.length === 0) {
    return [];
  }

  const lastEnd = cues[cues.length - 1].endTime;
  const step = Math.max(1, Math.floor(cues.length / 80)); // cap raw windows ~80

  const raw = [];

  for (let i = 0; i < cues.length; i += step) {
    const startTime = cues[i].startTime;
    const targetEnd = startTime + targetDurationS;

    let endTime = targetEnd;
    for (let j = i; j < cues.length; j++) {
      if (cues[j].endTime >= targetEnd) {
        endTime = cues[j].endTime;
        break;
      }
    }

    endTime = clamp(endTime, startTime + minDurationS, lastEnd);

    const windowText = cues
      .filter(c => c.endTime > startTime && c.startTime < endTime)
      .map(c => c.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const excerpt = windowText.slice(0, maxTextChars);
    const wordCount = countWords(windowText);

    // Cheap heuristic scoring: dense content + punctuation + fewer filler closings
    const punctuationBonus = /[!?]/.test(windowText) ? 10 : 0;
    const closingPenalty = /\b(?:thank you|thanks|subscribe|follow me|see you|goodbye)\b/i.test(windowText) ? 25 : 0;
    const score = wordCount + punctuationBonus - closingPenalty;

    raw.push({
      id: `w${i}`,
      startTime,
      endTime,
      excerpt,
      score,
    });
  }

  // Prefer higher score, de-dupe near-identical start times
  raw.sort((a, b) => b.score - a.score);
  const picked: typeof raw = [];
  for (const item of raw) {
    const tooClose = picked.some(p => Math.abs(p.startTime - item.startTime) < 5);
    if (tooClose) {
      continue;
    }
    picked.push(item);
    if (picked.length >= maxCandidates) {
      break;
    }
  }

  return picked.map(({ score, ...rest }) => rest);
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Suggest an interesting clip window by fetching the asset's VTT and asking GPT-5.2 to choose
 * a strong ~15s segment. Falls back to a simple heuristic if the model cannot decide.
 */
export async function suggestSocialClipRangeAction(assetId: string): Promise<SuggestSocialClipRangeResult> {
  const { asset, playbackId } = await getPlaybackIdForAsset(assetId);

  const track = findTextTrack(asset, "en") ?? findTextTrack(asset);
  if (!track?.id) {
    throw new Error("No ready text track found for this asset.");
  }

  const vtt = await getTrackVtt(playbackId, track.id);
  const cues = parseVtt(vtt);
  if (cues.length === 0) {
    return {
      startTime: 0,
      endTime: 15,
      trackId: track.id,
      languageCode: track.language_code ?? undefined,
      rationale: "No cues found in VTT; defaulting to first 15 seconds.",
    };
  }

  const candidates = pickClipCandidates(cues, { targetDurationS: 15, minDurationS: 8, maxCandidates: 12 });
  if (candidates.length === 0) {
    return {
      startTime: cues[0].startTime,
      endTime: Math.max(cues[0].endTime, cues[0].startTime + 8),
      trackId: track.id,
      languageCode: track.language_code ?? undefined,
      rationale: "Unable to form candidates; defaulting to first cue window.",
    };
  }

  const SuggestSchema = z.object({
    candidateId: z.string(),
    startTime: z.number(),
    endTime: z.number(),
    rationale: z.string(),
  });

  const { object } = await generateObject({
    model: openai("gpt-5.2"),
    schema: SuggestSchema,
    system: CLIP_SELECTION_SYSTEM_PROMPT,
    prompt: dedent`
      <candidates>
        ${JSON.stringify(candidates, null, 2)}
      </candidates>

      Select the best candidate and return your choice as a JSON object.
      Remember: prefer natural speech boundaries over exact duration targets.
    `,
  });

  const chosen = candidates.find(c => c.id === object.candidateId) ?? candidates[0];
  const startTime = clamp(object.startTime, chosen.startTime, chosen.endTime - 5);
  const endTime = clamp(object.endTime, startTime + 5, chosen.endTime);

  return {
    startTime,
    endTime,
    trackId: track.id,
    languageCode: track.language_code ?? undefined,
    rationale: object.rationale,
  };
}

/**
 * Get a preview-ready clip suggestion with instant clip audio URL.
 * This is designed for the preview flow - it returns everything needed to
 * render a Remotion Player preview instantly without waiting for a render.
 *
 * Uses Mux's instant clipping feature to generate an audio URL that streams
 * just the selected segment, enabling immediate preview playback.
 *
 * IMPORTANT: Returns captions from the SAME VTT source used for AI clip selection
 * to ensure caption timing aligns with the selected clip range.
 */
export async function getPreviewClipAction(assetId: string): Promise<PreviewClipResult> {
  // Get asset and playback info
  const { asset, playbackId, policy } = await getPlaybackIdForAsset(assetId);

  // Find text track for transcript
  const track = findTextTrack(asset, "en") ?? findTextTrack(asset);
  if (!track?.id) {
    throw new Error("No ready text track found for this asset.");
  }

  // Get VTT and parse cues - this is the SAME source used for AI clip selection
  const vtt = await getTrackVtt(playbackId, track.id);
  const cues = parseVtt(vtt);

  let startTime = 0;
  let endTime = 15;
  let rationale = "Default clip: first 15 seconds.";

  if (cues.length > 0) {
    // Try to get an AI-suggested clip range
    const candidates = pickClipCandidates(cues, { targetDurationS: 15, minDurationS: 8, maxCandidates: 12 });

    if (candidates.length > 0) {
      try {
        const SuggestSchema = z.object({
          candidateId: z.string(),
          startTime: z.number(),
          endTime: z.number(),
          rationale: z.string(),
        });

        const { object } = await generateObject({
          model: openai("gpt-5.2"),
          schema: SuggestSchema,
          system: CLIP_SELECTION_SYSTEM_PROMPT,
          prompt: dedent`
            <candidates>
              ${JSON.stringify(candidates, null, 2)}
            </candidates>

            Select the best candidate and return your choice as a JSON object.
            Remember: prefer natural speech boundaries over exact duration targets.
          `,
        });

        const chosen = candidates.find(c => c.id === object.candidateId) ?? candidates[0];
        startTime = clamp(object.startTime, chosen.startTime, chosen.endTime - 5);
        endTime = clamp(object.endTime, startTime + 5, chosen.endTime);
        rationale = object.rationale;
      } catch {
        // Fallback to first candidate if AI fails
        startTime = candidates[0].startTime;
        endTime = candidates[0].endTime;
        rationale = "AI suggestion unavailable; using best heuristic match.";
      }
    } else {
      // Use first cue window
      startTime = cues[0].startTime;
      endTime = Math.max(cues[0].endTime, cues[0].startTime + 8);
      rationale = "Unable to form candidates; using first cue window.";
    }
  }

  // Generate audio URL for preview
  // Note: We use the full audio URL and handle offset via startFrom in Remotion
  // because static audio renditions don't support instant clip time parameters
  const audioUrl = await getMuxAudioUrl(playbackId, policy);

  // Filter captions from the SAME cues used for AI selection to ensure alignment
  // Include cues that overlap with the clip time range
  // Keep ORIGINAL times - the Remotion composition handles offset via clipStartTime
  const filteredCaptions: CaptionCue[] = cues
    .filter(cue => cue.endTime > startTime && cue.startTime < endTime)
    .map(cue => ({
      id: cue.id,
      startTime: cue.startTime,
      endTime: cue.endTime,
      text: cue.text,
    }));

  return {
    startTime,
    endTime,
    trackId: track.id,
    languageCode: track.language_code ?? undefined,
    rationale,
    audioUrl,
    playbackId,
    playbackPolicy: policy,
    captions: filteredCaptions,
  };
}

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
