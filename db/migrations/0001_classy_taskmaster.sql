ALTER TABLE "video_chunks" ALTER COLUMN "chunk_text" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "video_chunks" ALTER COLUMN "start_time" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "video_chunks" ALTER COLUMN "end_time" DROP NOT NULL;