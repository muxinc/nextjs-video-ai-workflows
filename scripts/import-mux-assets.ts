/* eslint-disable no-console, node/no-process-env */
import Mux from "@mux/mux-node";
import dotenv from "dotenv";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../db/schema";

// Load environment variables first
dotenv.config({ path: ".env.local" });

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_LANGUAGE = "en";

// Parse command line args
const args = process.argv.slice(2);
const languageIndex = args.indexOf("--language");
const languageCode = languageIndex !== -1 ? args[languageIndex + 1] : DEFAULT_LANGUAGE;

console.log(`Using language code: ${languageCode}`);

// ─────────────────────────────────────────────────────────────────────────────
// Database setup
// ─────────────────────────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

// ─────────────────────────────────────────────────────────────────────────────
// Mux client
// ─────────────────────────────────────────────────────────────────────────────

const mux = new Mux({
  tokenId: process.env.MUX_TOKEN_ID,
  tokenSecret: process.env.MUX_TOKEN_SECRET,
});

// ─────────────────────────────────────────────────────────────────────────────
// Main import function
// ─────────────────────────────────────────────────────────────────────────────

async function importMuxAssets() {
  // Dynamic import for ESM-only package
  const { generateVideoEmbeddings } = await import("@mux/ai/workflows");
  console.log("Fetching Mux assets...");

  // Fetch all assets from Mux (paginated)
  const allAssets: Mux.Video.Asset[] = [];
  let page: Awaited<ReturnType<typeof mux.video.assets.list>> | undefined;

  do {
    page = await mux.video.assets.list({
      limit: 100,
    });
    allAssets.push(...page.data);
    console.log(`Fetched ${allAssets.length} assets so far...`);
  } while (page.data.length === 100);

  console.log(`\nTotal assets found: ${allAssets.length}`);

  // Filter to only ready assets with playback IDs
  const readyAssets = allAssets.filter(
    asset => asset.status === "ready" && asset.playback_ids && asset.playback_ids.length > 0,
  );

  console.log(`Ready assets with playback IDs: ${readyAssets.length}\n`);

  // Process each asset
  for (const asset of readyAssets) {
    console.log(`\n─────────────────────────────────────────────────────────`);
    console.log(`Processing: ${asset.meta?.title || asset.id}`);
    console.log(`Asset ID: ${asset.id}`);

    try {
      // Get the first public playback ID, or any playback ID
      const playbackId = asset.playback_ids?.find(p => p.policy === "public")?.id ||
        asset.playback_ids?.[0]?.id;

      // Fetch transcript VTT if available
      let transcriptVtt: string | null = null;
      const transcriptTrack = asset.tracks?.find(
        t => t.type === "text" && t.text_type === "subtitles" && t.status === "ready" && t.language_code === languageCode,
      );

      if (transcriptTrack && playbackId) {
        try {
          const vttUrl = `https://stream.mux.com/${playbackId}/text/${transcriptTrack.id}.vtt`;
          const vttResponse = await fetch(vttUrl);
          if (vttResponse.ok) {
            transcriptVtt = await vttResponse.text();
            console.log(`✓ Fetched transcript VTT (${transcriptVtt.length} chars)`);
          }
        } catch (e) {
          console.log(`  Could not fetch transcript: ${e}`);
        }
      }

      // Insert or update video record
      const [video] = await db
        .insert(schema.videos)
        .values({
          muxAssetId: asset.id,
          muxPlaybackId: playbackId,
          title: (asset.meta as { title?: string })?.title || null,
          meta: asset as unknown as Record<string, unknown>,
          aspectRatio: asset.aspect_ratio || null,
          duration: asset.duration || null,
          transcriptVtt,
        })
        .onConflictDoUpdate({
          target: schema.videos.muxAssetId,
          set: {
            muxPlaybackId: playbackId,
            title: (asset.meta as { title?: string })?.title || null,
            meta: asset as unknown as Record<string, unknown>,
            aspectRatio: asset.aspect_ratio || null,
            duration: asset.duration || null,
            transcriptVtt,
            updatedAt: new Date(),
          },
        })
        .returning();

      console.log(`✓ Video record saved (ID: ${video.id})`);

      // Generate embeddings using @mux/ai
      console.log(`Generating embeddings for asset ${asset.id}...`);

      const result = await generateVideoEmbeddings(asset.id, {
        provider: "openai",
        languageCode,
        chunkingStrategy: {
          type: "vtt",
          maxTokens: 500,
          overlapCues: 2,
        },
      });

      console.log(`✓ Generated ${result.chunks.length} chunks`);

      // Log chunk info
      if (result.chunks.length > 0) {
        const firstChunk = result.chunks[0] as { metadata: { startTime?: number; endTime?: number } };
        console.log(`  Chunks: ${result.chunks.length}, Time range: ${firstChunk.metadata.startTime ?? 0}s - ${firstChunk.metadata.endTime ?? "?"}s`);
      }

      // Delete existing chunks for this video (in case of re-import)
      await db
        .delete(schema.videoChunks)
        .where(eq(schema.videoChunks.videoId, video.id));

      // Insert all chunks with embeddings and metadata
      if (result.chunks.length > 0) {
        for (let i = 0; i < result.chunks.length; i++) {
          const chunk = result.chunks[i] as {
            chunkId: string;
            embedding: number[];
            metadata: { startTime?: number; endTime?: number; tokenCount: number };
          };

          // Convert embedding array to pgvector format: '[0.1,0.2,...]'
          const embeddingStr = `[${chunk.embedding.join(",")}]`;

          // Use raw SQL with raw embedding string for proper pgvector format
          await pool.query(
            `INSERT INTO video_chunks (video_id, chunk_index, start_time, end_time, embedding)
             VALUES ($1, $2, $3, $4, $5::vector)`,
            [
              video.id,
              i,
              chunk.metadata.startTime ?? null,
              chunk.metadata.endTime ?? null,
              embeddingStr,
            ],
          );
        }
        console.log(`✓ Saved ${result.chunks.length} chunks with embeddings`);
      }
    } catch (error) {
      console.error(`✗ Error processing asset ${asset.id}:`, error);
    }
  }

  console.log(`\n─────────────────────────────────────────────────────────`);
  console.log(`Import complete!`);

  await pool.end();
}

// ─────────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────────

importMuxAssets().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
