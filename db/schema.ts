import {
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

// ─────────────────────────────────────────────────────────────────────────────
// Videos Table
// ─────────────────────────────────────────────────────────────────────────────

export const videos = pgTable("videos", {
  id: uuid("id").primaryKey().defaultRandom(),
  muxAssetId: text("mux_asset_id").notNull().unique(),
  muxPlaybackId: text("mux_playback_id"),
  title: text("title"),
  description: text("description"),
  meta: jsonb("meta"), // Full Mux asset metadata
  aspectRatio: text("aspect_ratio"),
  duration: real("duration"),
  chapters: jsonb("chapters"),
  topics: text("topics").array(),
  transcriptEnText: text("transcript_en_text"),
  transcriptEnVtt: text("transcript_en_vtt"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  index("videos_mux_asset_id_idx").on(table.muxAssetId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// Video Chunks Table (with embeddings)
// ─────────────────────────────────────────────────────────────────────────────

export const videoChunks = pgTable("video_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  videoId: uuid("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  chunkText: text("chunk_text"),
  startTime: real("start_time"),
  endTime: real("end_time"),
  embedding: vector("embedding", { dimensions: 1536 }), // OpenAI text-embedding-3-small
  visualDescription: text("visual_description"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  index("video_chunks_video_id_idx").on(table.videoId),
  index("video_chunks_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
]);

// ─────────────────────────────────────────────────────────────────────────────
// Type exports
// ─────────────────────────────────────────────────────────────────────────────

export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;
export type VideoChunk = typeof videoChunks.$inferSelect;
export type NewVideoChunk = typeof videoChunks.$inferInsert;
