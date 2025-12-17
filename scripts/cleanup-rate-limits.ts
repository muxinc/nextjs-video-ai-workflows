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

const DEFAULT_OLDER_THAN_HOURS = 168; // 7 days

// Parse command line args
const args = process.argv.slice(2);
const hoursArg = args[0] ? Number(args[0]) : DEFAULT_OLDER_THAN_HOURS;

if (Number.isNaN(hoursArg) || hoursArg <= 0) {
  console.error("Usage: npx tsx scripts/cleanup-rate-limits.ts [hours]");
  console.error("  hours: Number of hours old records must be to delete (default: 168)");
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

async function cleanupRateLimits(olderThanHours: number): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

  const result = await db
    .delete(schema.rateLimits)
    .where(sql`${schema.rateLimits.windowStart} < ${cutoff}`);

  return result.rowCount ?? 0;
}

async function main() {
  console.log(`Rate Limit Cleanup`);
  console.log(`─────────────────────────────────────────────────────────`);
  console.log(`Deleting records older than ${hoursArg} hours...`);
  console.log();

  try {
    const deletedCount = await cleanupRateLimits(hoursArg);

    console.log(`✓ Deleted ${deletedCount} old rate limit record${deletedCount === 1 ? "" : "s"}.`);
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
