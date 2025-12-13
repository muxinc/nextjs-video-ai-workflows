import { openai } from "@ai-sdk/openai";
import { embed } from "ai";

import { getPlaybackIdForAsset } from "@/app/lib/mux";

import { createClient } from "./server";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Raw result from the match_video_chunks RPC function */
interface RawVideoChunkResult {
  chunk_id: string;
  chunk_text: string;
  mux_asset_id: string;
  parent_video_topics: string[];
  similarity_score: number;
  video_id: string;
  visual_description: string;
}

/** Enriched result with additional metadata from videos table and Mux */
export interface VideoChunkResult extends RawVideoChunkResult {
  playback_id: string | null;
  title: string | null;
  description: string | null;
  start_time: number | null;
  end_time: number | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Search Function
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Performs semantic search on video chunks using vector similarity.
 * Generates an embedding for the query and calls the match_video_chunks RPC.
 */
export async function searchVideoChunks(
  query: string,
  limit: number = 10,
): Promise<VideoChunkResult[]> {
  if (!query.trim()) {
    return [];
  }

  // Generate embedding for the search query using the same model as sync script
  const { embedding } = await embed({
    model: openai.textEmbeddingModel("text-embedding-3-small"),
    value: query,
  });

  // Create Supabase client
  const supabase = await createClient();

  // Perform vector similarity search on video chunks
  const { data: chunks, error } = await supabase.rpc("match_video_chunks", {
    query_embedding: JSON.stringify(embedding),
    similarity_threshold: -1, // No threshold - get all results
    match_count: limit,
  });

  if (error) {
    console.error("Error searching video chunks:", error);
    throw error;
  }

  if (!chunks || chunks.length === 0) {
    return [];
  }

  // Get unique video_ids for fetching metadata
  const uniqueVideoIds = [...new Set(chunks.map((c: RawVideoChunkResult) => c.video_id))];
  const uniqueChunkIds = [...new Set(chunks.map((c: RawVideoChunkResult) => c.chunk_id))];
  const uniqueAssetIds = [...new Set(chunks.map((c: RawVideoChunkResult) => c.mux_asset_id))];

  // Fetch video metadata (title, description)
  const { data: videos, error: videosError } = await supabase
    .from("videos")
    .select("id, title, description")
    .in("id", uniqueVideoIds);

  if (videosError) {
    console.error("Error fetching videos:", videosError);
  }

  // Fetch chunk details (start_time, end_time)
  const { data: chunkDetails, error: chunksError } = await supabase
    .from("video_chunks")
    .select("id, start_time, end_time")
    .in("id", uniqueChunkIds);

  if (chunksError) {
    console.error("Error fetching chunk details:", chunksError);
  }

  // Fetch playback IDs from Mux (in parallel)
  const playbackResults = await Promise.all(
    uniqueAssetIds.map(async (assetId) => {
      try {
        const result = await getPlaybackIdForAsset(assetId);
        return { assetId, playbackId: result.playbackId };
      } catch {
        return { assetId, playbackId: null };
      }
    }),
  );

  // Create lookup maps
  const videoMap = new Map(videos?.map(v => [v.id, v]) || []);
  const chunkMap = new Map(chunkDetails?.map(c => [c.id, c]) || []);
  const playbackMap = new Map(playbackResults.map(r => [r.assetId, r.playbackId]));

  // Enrich the chunks with additional data
  const enrichedChunks: VideoChunkResult[] = chunks.map((chunk: RawVideoChunkResult) => {
    const video = videoMap.get(chunk.video_id);
    const chunkDetail = chunkMap.get(chunk.chunk_id);
    const playbackId = playbackMap.get(chunk.mux_asset_id);

    return {
      ...chunk,
      playback_id: playbackId ?? null,
      title: video?.title ?? null,
      description: video?.description ?? null,
      start_time: chunkDetail?.start_time ?? null,
      end_time: chunkDetail?.end_time ?? null,
    };
  });

  return enrichedChunks;
}
