-- Feature metrics table for tracking feature adoption
CREATE TABLE "feature_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature" text NOT NULL,
	"identifier" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "feature_metrics_feature_idx" ON "feature_metrics" USING btree ("feature");
--> statement-breakpoint
CREATE INDEX "feature_metrics_created_at_idx" ON "feature_metrics" USING btree ("created_at");

