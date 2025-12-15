import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Aspect Ratio Configurations
// ─────────────────────────────────────────────────────────────────────────────

export type AspectRatio = "portrait" | "square" | "landscape";

export const ASPECT_RATIO_CONFIG: Record<AspectRatio, {
  id: string;
  label: string;
  width: number;
  height: number;
}> = {
  portrait: {
    id: "social-clip-portrait",
    label: "9:16 Portrait",
    width: 1080,
    height: 1920,
  },
  square: {
    id: "social-clip-square",
    label: "1:1 Square",
    width: 1080,
    height: 1080,
  },
  landscape: {
    id: "social-clip-landscape",
    label: "16:9 Landscape",
    width: 1920,
    height: 1080,
  },
};

export const SOCIAL_CLIP_COMPOSITION_IDS = {
  portrait: ASPECT_RATIO_CONFIG.portrait.id,
  square: ASPECT_RATIO_CONFIG.square.id,
  landscape: ASPECT_RATIO_CONFIG.landscape.id,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Transcript Cue Schema
// ─────────────────────────────────────────────────────────────────────────────

export const CaptionCueSchema = z.object({
  id: z.string(),
  startTime: z.number(),
  endTime: z.number(),
  text: z.string(),
});

export type CaptionCue = z.infer<typeof CaptionCueSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Input Props Schema
// ─────────────────────────────────────────────────────────────────────────────

export const SOCIAL_CLIP_SCHEMA = z.object({
  /**
   * Full audio URL for the source video (may include signed token for private playback)
   * Generated server-side to support both public and signed playback IDs
   */
  audioUrl: z.string(),
  /**
   * Start time in seconds (clip start relative to original video)
   */
  startTime: z.number(),
  /**
   * End time in seconds (clip end relative to original video)
   */
  endTime: z.number(),
  /**
   * Optional title overlay
   */
  title: z.string().optional(),
  /**
   * Transcript cues for burnt-in captions (filtered to clip time range)
   */
  captions: z.array(CaptionCueSchema),
});

export type SocialClipProps = z.infer<typeof SOCIAL_CLIP_SCHEMA>;

/**
 * Default props for Remotion Studio preview
 */
export const DEFAULT_SOCIAL_CLIP_PROPS: SocialClipProps = {
  audioUrl: "", // Empty string for preview (triggers fallback visualizer)
  startTime: 0,
  endTime: 10,
  title: "Sample Clip",
  captions: [
    { id: "1", startTime: 0, endTime: 3, text: "This is a sample caption" },
    { id: "2", startTime: 3, endTime: 6, text: "Displaying burnt-in captions" },
    { id: "3", startTime: 6, endTime: 10, text: "With audio-only playback" },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Video Configuration
// ─────────────────────────────────────────────────────────────────────────────

export const SOCIAL_CLIP_FPS = 30;

/**
 * Get duration in frames from start/end times
 */
export function getDurationInFrames(startTime: number, endTime: number): number {
  const durationSeconds = endTime - startTime;
  return Math.ceil(durationSeconds * SOCIAL_CLIP_FPS);
}
