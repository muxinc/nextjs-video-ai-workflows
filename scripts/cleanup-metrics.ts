/* eslint-disable no-console, node/no-process-env */
import dotenv from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../db/schema";

// Load environment variables first
dotenv.config({ path: ".env.local" });

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_OLDER_THAN_DAYS = 90; // 90 days

// Parse command line args
const args = process.argv.slice(2);
const daysArg = args[0] ? Number(args[0]) : DEFAULT_OLDER_THAN_DAYS;

if (Number.isNaN(daysArg) || daysArg <= 0) {
  console.error("Usage: npx tsx scripts/cleanup-metrics.ts [days]");
  console.error("  days: Number of days old records must be to delete (default: 90)");
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Database setup
// ─────────────────────────────────────────────────────────────────────────────

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });

// ─────────────────────────────────────────────────────────────────────────────
// Main cleanup function
// ─────────────────────────────────────────────────────────────────────────────

async function cleanupMetrics(olderThanDays: number): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);

  const result = await db
    .delete(schema.featureMetrics)
    .where(sql`${schema.featureMetrics.createdAt} < ${cutoff}`);

  return result.rowCount ?? 0;
}

async function main() {
  console.log(`Feature Metrics Cleanup`);
  console.log(`─────────────────────────────────────────────────────────`);
  console.log(`Deleting records older than ${daysArg} days...`);
  console.log();

  try {
    const deletedCount = await cleanupMetrics(daysArg);

    console.log(`✓ Deleted ${deletedCount} old metric record${deletedCount === 1 ? "" : "s"}.`);
    console.log();

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error("✗ Cleanup failed:", error);
    await pool.end();
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────────

main();
