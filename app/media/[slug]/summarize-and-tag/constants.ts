// ─────────────────────────────────────────────────────────────────────────────
// Shared constants for Layer 1 Summary + Tags
// This file is NOT a server action, so it can be imported by both
// server and client components.
// ─────────────────────────────────────────────────────────────────────────────

import type { SummaryStepId } from "@/workflows/get-summary-and-tags";

import type { SummaryTone } from "./actions";

export const TONE_OPTIONS: { value: SummaryTone; label: string }[] = [
  { value: "neutral", label: "NEUTRAL" },
  { value: "professional", label: "PROFESSIONAL" },
  { value: "playful", label: "PLAYFUL" },
];

export const POLL_INTERVAL = 1500;

export const SUMMARY_STEPS: readonly { id: SummaryStepId; label: string }[] = [
  { id: "prepare", label: "Preparing inputs" },
  { id: "generate", label: "Generating summary + tags" },
  { id: "finalize", label: "Finalizing output" },
] as const;
