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
  summary: text("summary"),
  meta: jsonb("meta"), // Full Mux asset metadata
  aspectRatio: text("aspect_ratio"),
  duration: real("duration"),
  tags: text("tags").array(),
  transcriptVtt: text("transcript_vtt"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, table => [
  index("videos_mux_asset_id_idx").on(table.muxAssetId),
]);

// ─────────────────────────────────────────────────────────────────────────────
// Video Chunks Table (with embeddings)
// ─────────────────────────────────────────────────────────────────────────────

export const videoChunks = pgTable("video_chunks", {
  id: uuid("id").primaryKey().defaultRandom(),
  videoId: uuid("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
  chunkIndex: integer("chunk_index").notNull(),
  startTime: real("start_time"),
  endTime: real("end_time"),
  embedding: vector("embedding", { dimensions: 1536 }), // OpenAI text-embedding-3-small
  createdAt: timestamp("created_at").defaultNow(),
}, table => [
  index("video_chunks_video_id_idx").on(table.videoId),
  index("video_chunks_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
]);

// ─────────────────────────────────────────────────────────────────────────────
// Rate Limits Table
// ─────────────────────────────────────────────────────────────────────────────

export const rateLimits = pgTable("rate_limits", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: text("identifier").notNull(), // IP address or fingerprint
  endpoint: text("endpoint").notNull(), // e.g., "translate-audio", "render"
  windowStart: timestamp("window_start").notNull(), // Start of rate limit window
  requestCount: integer("request_count").notNull().default(1),
}, table => [
  index("rate_limits_lookup_idx").on(table.identifier, table.endpoint, table.windowStart),
]);

// ─────────────────────────────────────────────────────────────────────────────
// Feature Metrics Table
// ─────────────────────────────────────────────────────────────────────────────

export const featureMetrics = pgTable("feature_metrics", {
  id: uuid("id").primaryKey().defaultRandom(),
  feature: text("feature").notNull(), // e.g., "semantic-search-nav"
  identifier: text("identifier"), // Optional IP address or fingerprint
  metadata: jsonb("metadata"), // Optional extra info (e.g., search query, assetId)
  createdAt: timestamp("created_at").defaultNow(),
}, table => [
  index("feature_metrics_feature_idx").on(table.feature),
  index("feature_metrics_created_at_idx").on(table.createdAt),
]);

// ─────────────────────────────────────────────────────────────────────────────
// Type exports
// ─────────────────────────────────────────────────────────────────────────────

export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;
export type VideoChunk = typeof videoChunks.$inferSelect;
export type NewVideoChunk = typeof videoChunks.$inferInsert;
export type RateLimit = typeof rateLimits.$inferSelect;
export type NewRateLimit = typeof rateLimits.$inferInsert;
export type FeatureMetric = typeof featureMetrics.$inferSelect;
export type NewFeatureMetric = typeof featureMetrics.$inferInsert;
