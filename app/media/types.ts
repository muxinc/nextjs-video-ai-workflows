// ─────────────────────────────────────────────────────────────────────────────
// Shared types for the media directory
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Represents a single cue/segment from a transcript (parsed from VTT).
 * Used for transcript display, search, and playback synchronization.
 */
export interface TranscriptCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

/**
 * Workflow status shared between Layer 1 and Layer 2 workflows.
 * Maps to the underlying Vercel Workflow statuses.
 */
export type WorkflowStatus = "idle" | "starting" | "running" | "completed" | "failed";
