import { sql } from "drizzle-orm";

import { db, featureMetrics } from "@/db";

import { env } from "./env";
import { getClientIp } from "./rate-limit";

export type FeatureName =
  | "semantic-search-nav" |
  "semantic-search-transcript" |
  "summarize-and-tag" |
  "translate-captions" |
  "translate-audio" |
  "generate-preview" |
  "download-social-clip";

/**
 * Records a feature adoption metric event.
 *
 * This is a "lite" implementation that just inserts a row into the database.
 * In a production app, you might use a dedicated analytics service or
 * a more robust event tracking system.
 *
 * Note: Metric recording is bypassed in development mode to avoid
 * polluting production analytics with local testing.
 */
export async function recordMetric(
  feature: FeatureName,
  metadata?: Record<string, any>,
) {
  // Bypass metrics in development
  if (env.NODE_ENV === "development") {
    return;
  }

  try {
    const identifier = await getClientIp().catch(() => "unknown");

    await db.insert(featureMetrics).values({
      feature,
      identifier,
      metadata,
    });
  } catch (error) {
    // We don't want to block the user if metric recording fails

    console.warn(`Failed to record metric for ${feature}:`, error);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup (optional, for maintenance)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cleans up old metric records.
 * Call this periodically (e.g., via cron) to keep the table small.
 */
export async function cleanupOldMetrics(olderThanDays: number = 90): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  const result = await db
    .delete(featureMetrics)
    .where(sql`${featureMetrics.createdAt} < ${cutoff}`);

  return result.rowCount ?? 0;
}
