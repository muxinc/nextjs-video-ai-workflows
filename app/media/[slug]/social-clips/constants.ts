// ─────────────────────────────────────────────────────────────────────────────
// Shared constants for Layer 3 Social Clips
// This file is NOT a server action, so it can be imported by both
// server and client components.
// ─────────────────────────────────────────────────────────────────────────────

import type { AspectRatio } from "@/remotion/social-clip/constants";

import type { RenderStepId } from "./actions";

export const POLL_INTERVAL = 1500;

export const RENDER_STEPS: readonly { id: RenderStepId; label: string }[] = [
  { id: "prepare", label: "Preparing" },
  { id: "render", label: "Rendering (with Remotion)" },
  { id: "finalize", label: "Finalizing" },
] as const;

export const ASPECT_RATIO_LABELS: Record<AspectRatio, string> = {
  portrait: "9:16",
  square: "1:1",
  landscape: "16:9",
};
