"use server";

import { searchChunksWithinVideo } from "@/db/search";
import type { ChunkWithinVideoResult } from "@/db/search";

// ─────────────────────────────────────────────────────────────────────────────
// Server Actions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Server action to search transcript chunks within a specific video.
 * Returns matching chunks for transcript navigation.
 */
export async function searchTranscript(
  query: string,
  muxAssetId: string,
): Promise<ChunkWithinVideoResult[]> {
  return searchChunksWithinVideo(query, muxAssetId);
}
