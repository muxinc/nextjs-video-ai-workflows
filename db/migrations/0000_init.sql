-- Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE "video_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"start_time" real,
	"end_time" real,
	"embedding" vector(1536),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mux_asset_id" text NOT NULL,
	"mux_playback_id" text,
	"title" text,
	"summary" text,
	"meta" jsonb,
	"aspect_ratio" text,
	"duration" real,
	"tags" text[],
	"transcript_vtt" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "videos_mux_asset_id_unique" UNIQUE("mux_asset_id")
);
--> statement-breakpoint
ALTER TABLE "video_chunks" ADD CONSTRAINT "video_chunks_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "video_chunks_video_id_idx" ON "video_chunks" USING btree ("video_id");--> statement-breakpoint
CREATE INDEX "video_chunks_embedding_idx" ON "video_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "videos_mux_asset_id_idx" ON "videos" USING btree ("mux_asset_id");
