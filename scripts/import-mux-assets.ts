import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

import { generateVideoEmbeddings } from "@mux/ai/workflows";
import Mux from "@mux/mux-node";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../db/schema";

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
  console.log("Fetching Mux assets...");

  // Fetch all assets from Mux (paginated)
  const allAssets: Mux.Video.Asset[] = [];
  let page: Mux.Video.AssetsListResponse | undefined;

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
    asset => asset.status === "ready" && asset.playback_ids && asset.playback_ids.length > 0
  );

  console.log(`Ready assets with playback IDs: ${readyAssets.length}\n`);

  // Process each asset
  for (const asset of readyAssets) {
    console.log(`\n─────────────────────────────────────────────────────────`);
    console.log(`Processing: ${asset.meta?.title || asset.id}`);
    console.log(`Asset ID: ${asset.id}`);

    try {
      // Get the first public playback ID, or any playback ID
      const playbackId = asset.playback_ids?.find(p => p.policy === "public")?.id
        || asset.playback_ids?.[0]?.id;

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
        })
        .onConflictDoUpdate({
          target: schema.videos.muxAssetId,
          set: {
            muxPlaybackId: playbackId,
            title: (asset.meta as { title?: string })?.title || null,
            meta: asset as unknown as Record<string, unknown>,
            aspectRatio: asset.aspect_ratio || null,
            duration: asset.duration || null,
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
          type: "token",
          maxTokens: 500,
          overlap: 100,
        },
      });

      console.log(`✓ Generated ${result.chunks.length} chunks`);

      // Delete existing chunks for this video (in case of re-import)
      await db
        .delete(schema.videoChunks)
        .where(eq(schema.videoChunks.videoId, video.id));

      // Insert all chunks
      if (result.chunks.length > 0) {
        await db.insert(schema.videoChunks).values(
          result.chunks.map((chunk, index) => ({
            videoId: video.id,
            chunkIndex: index,
            chunkText: chunk.text,
            startTime: chunk.metadata.startTime,
            endTime: chunk.metadata.endTime,
            embedding: chunk.embedding,
            visualDescription: chunk.metadata.visualDescription || null,
          }))
        );
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
