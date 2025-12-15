// ─────────────────────────────────────────────────────────────────────────────
// Shared utility functions for the media directory
// ─────────────────────────────────────────────────────────────────────────────

import type { Video } from "@/db/schema";

/**
 * Returns a display title for a video, falling back to a truncated ID if no title exists.
 */
export function getVideoTitle(video: Video): string {
  return video.title ?? `Talk ${video.id.slice(0, 8)}`;
}

/**
 * Formats seconds into a human-readable timestamp (m:ss or h:mm:ss).
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
