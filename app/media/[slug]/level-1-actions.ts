"use server";

import { start } from "workflow/api";

import { env } from "@/app/lib/env";
import { getSummaryAndTagsWorkflow } from "@/workflows/get-summary-and-tags";
import type { getSummaryAndTags } from "@mux/ai/workflows";

export type SummaryTone = "normal" | "professional" | "sassy";

export type Level1SummaryState =
  { status: "idle" } |
  { status: "running" } |
  { status: "success"; result: Awaited<ReturnType<typeof getSummaryAndTags>> } |
  { status: "error"; error: string };

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

export async function generateSummaryAndTagsAction(
  _prevState: Level1SummaryState,
  formData: FormData,
): Promise<Level1SummaryState> {
  const assetId = String(formData.get("assetId") || "");
  const toneInput = formData.get("tone");
  const tone: SummaryTone =
    (toneInput === "professional" || toneInput === "sassy") ?
      toneInput :
      "normal";

  if (!assetId) {
    return { status: "error", error: "Missing assetId." };
  }

  const providerConfig = getProviderConfig();
  if (!providerConfig) {
    return {
      status: "error",
      error:
        "No AI provider API key found. Set one of OPENAI_API_KEY, ANTHROPIC_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY.",
    };
  }

  try {
    const run = await start(getSummaryAndTagsWorkflow, [assetId, {
      muxTokenId: env.MUX_TOKEN_ID,
      muxTokenSecret: env.MUX_TOKEN_SECRET,
      tone,
      includeTranscript: true,
      cleanTranscript: true,
      ...providerConfig,
    }]);

    const result = await run.returnValue;

    return { status: "success", result };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate summary.";
    return { status: "error", error: message };
  }
}
