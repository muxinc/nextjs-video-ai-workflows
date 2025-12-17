-- Rate limits table for protecting demo expenses
CREATE TABLE "rate_limits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"endpoint" text NOT NULL,
	"window_start" timestamp NOT NULL,
	"request_count" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "rate_limits_lookup_idx" ON "rate_limits" USING btree ("identifier", "endpoint", "window_start");

