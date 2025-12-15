// ─────────────────────────────────────────────────────────────────────────────
// Shared constants for Layer 2 Localization
// This file is NOT a server action, so it can be imported by both
// server and client components.
// ─────────────────────────────────────────────────────────────────────────────

import type { WorkflowStatus } from "../../types";

export interface TargetLanguage {
  code: string;
  name: string;
  flag: string;
}

export const TARGET_LANGUAGES: TargetLanguage[] = [
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "pt", name: "Portuguese", flag: "🇧🇷" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
];

export type TranslationStatus = WorkflowStatus;

// Step definitions for caption translation progress tracking
export const CAPTION_STEPS = [
  { id: "prepare", label: "Preparing translation" },
  { id: "translate", label: "Translating captions" },
  { id: "upload", label: "Uploading to Mux" },
] as const;

export type CaptionStepId = typeof CAPTION_STEPS[number]["id"];

// Step definitions for audio translation progress tracking
export const AUDIO_STEPS = [
  { id: "prepare", label: "Preparing audio" },
  { id: "generate", label: "Generating dubbed audio (with ElevenLabs)" },
  { id: "upload", label: "Uploading to Mux" },
] as const;

export type AudioStepId = typeof AUDIO_STEPS[number]["id"];
