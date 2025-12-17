import { and, eq, sql } from "drizzle-orm";
import { headers } from "next/headers";

import { db, rateLimits } from "@/db";

import { env } from "./env";

// ─────────────────────────────────────────────────────────────────────────────
// Rate Limit Configuration
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Rate limit configurations per endpoint.
 * Adjust these values based on your cost tolerance.
 */
export const RATE_LIMITS = {
  // Render operations (high cost - ElevenLabs API)
  "translate-audio": { maxRequests: 3, windowHours: 24 },

  // Translation captions and Rendering (moderate cost)
  "translate-captions": { maxRequests: 10, windowHours: 24 },
  "render": { maxRequests: 6, windowHours: 24 },

  // AI summary generation (moderate cost)
  "summary": { maxRequests: 10, windowHours: 24 },

  // Semantic search (low cost per query, but can add up)
  "search": { maxRequests: 50, windowHours: 1 },
} as const;

export type RateLimitEndpoint = keyof typeof RATE_LIMITS;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

export interface RateLimitError {
  error: string;
  remaining: number;
  resetAt: string;
  retryAfterSeconds: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// IP Extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extracts the client IP address from request headers.
 * Handles various proxy configurations (Vercel, Cloudflare, etc.)
 */
export async function getClientIp(): Promise<string> {
  const headersList = await headers();

  // Try common headers in order of preference
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    headersList.get("cf-connecting-ip") || // Cloudflare
    headersList.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  return ip;
}

/**
 * Extracts client IP from a Request object (for API routes).
 */
export function getClientIpFromRequest(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Rate Limiting Logic
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Gets the start of the current rate limit window.
 */
function getWindowStart(windowHours: number): Date {
  const now = new Date();
  const windowMs = windowHours * 60 * 60 * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  return windowStart;
}

/**
 * Checks rate limit and increments counter if allowed.
 * Returns whether the request should be allowed.
 *
 * Note: Rate limiting is bypassed in development mode to avoid
 * blocking local iteration.
 */
export async function checkRateLimit(
  identifier: string,
  endpoint: RateLimitEndpoint,
): Promise<RateLimitResult> {
  // Bypass rate limiting in development
  if (env.NODE_ENV === "development") {
    return {
      allowed: true,
      remaining: 999,
      resetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      limit: 999,
    };
  }

  const config = RATE_LIMITS[endpoint];
  const windowStart = getWindowStart(config.windowHours);
  const windowEnd = new Date(windowStart.getTime() + config.windowHours * 60 * 60 * 1000);

  // Try to find existing rate limit record for this window
  const existing = await db
    .select()
    .from(rateLimits)
    .where(
      and(
        eq(rateLimits.identifier, identifier),
        eq(rateLimits.endpoint, endpoint),
        eq(rateLimits.windowStart, windowStart),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    const record = existing[0];
    const currentCount = record.requestCount;

    if (currentCount >= config.maxRequests) {
      // Rate limit exceeded
      return {
        allowed: false,
        remaining: 0,
        resetAt: windowEnd,
        limit: config.maxRequests,
      };
    }

    // Increment counter
    await db
      .update(rateLimits)
      .set({ requestCount: sql`${rateLimits.requestCount} + 1` })
      .where(eq(rateLimits.id, record.id));

    return {
      allowed: true,
      remaining: config.maxRequests - currentCount - 1,
      resetAt: windowEnd,
      limit: config.maxRequests,
    };
  }

  // No existing record, create one
  await db.insert(rateLimits).values({
    identifier,
    endpoint,
    windowStart,
    requestCount: 1,
  });

  return {
    allowed: true,
    remaining: config.maxRequests - 1,
    resetAt: windowEnd,
    limit: config.maxRequests,
  };
}

/**
 * Gets current rate limit status without incrementing.
 */
export async function getRateLimitStatus(
  identifier: string,
  endpoint: RateLimitEndpoint,
): Promise<RateLimitResult> {
  const config = RATE_LIMITS[endpoint];
  const windowStart = getWindowStart(config.windowHours);
  const windowEnd = new Date(windowStart.getTime() + config.windowHours * 60 * 60 * 1000);

  const existing = await db
    .select()
    .from(rateLimits)
    .where(
      and(
        eq(rateLimits.identifier, identifier),
        eq(rateLimits.endpoint, endpoint),
        eq(rateLimits.windowStart, windowStart),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    const record = existing[0];
    return {
      allowed: record.requestCount < config.maxRequests,
      remaining: Math.max(0, config.maxRequests - record.requestCount),
      resetAt: windowEnd,
      limit: config.maxRequests,
    };
  }

  return {
    allowed: true,
    remaining: config.maxRequests,
    resetAt: windowEnd,
    limit: config.maxRequests,
  };
}

/**
 * Formats a duration in seconds to a human-readable string.
 * Examples: "5 minutes", "about 2 hours", "tomorrow morning"
 */
export function formatTimeUntilReset(seconds: number): string {
  if (seconds < 60) {
    return "less than a minute";
  }

  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  // Less than an hour: show minutes
  if (hours === 0) {
    if (minutes === 1) {
      return "1 minute";
    }
    if (minutes < 5) {
      return "a few minutes";
    }
    if (minutes <= 15) {
      return `about ${Math.round(minutes / 5) * 5} minutes`;
    }
    if (minutes <= 45) {
      return `about ${Math.round(minutes / 15) * 15} minutes`;
    }
    return "about an hour";
  }

  // 1-2 hours
  if (hours === 1) {
    if (remainingMinutes < 15) {
      return "about an hour";
    }
    if (remainingMinutes < 45) {
      return "about 1.5 hours";
    }
    return "about 2 hours";
  }

  // 2-12 hours: round to nearest half hour
  if (hours < 12) {
    if (remainingMinutes < 15) {
      return `about ${hours} hours`;
    }
    if (remainingMinutes < 45) {
      return `about ${hours}.5 hours`;
    }
    return `about ${hours + 1} hours`;
  }

  // 12+ hours: use relative time of day
  const resetDate = new Date(Date.now() + seconds * 1000);
  const now = new Date();
  const isToday = resetDate.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = resetDate.toDateString() === tomorrow.toDateString();

  if (isToday) {
    return "later today";
  }
  if (isTomorrow) {
    const hour = resetDate.getHours();
    if (hour < 12) {
      return "tomorrow morning";
    }
    if (hour < 17) {
      return "tomorrow afternoon";
    }
    return "tomorrow evening";
  }

  // More than a day away
  return `in about ${Math.ceil(hours / 24)} days`;
}

/**
 * Creates a rate limit error response object.
 */
export function createRateLimitError(result: RateLimitResult): RateLimitError {
  const retryAfterSeconds = Math.ceil((result.resetAt.getTime() - Date.now()) / 1000);

  return {
    error: `Rate limit exceeded. Try again ${formatTimeUntilReset(retryAfterSeconds)}.`,
    remaining: result.remaining,
    resetAt: result.resetAt.toISOString(),
    retryAfterSeconds: Math.max(0, retryAfterSeconds),
  };
}

/**
 * Adds rate limit headers to a Response.
 */
export function addRateLimitHeaders(
  headers: Headers,
  result: RateLimitResult,
): void {
  headers.set("X-RateLimit-Limit", result.limit.toString());
  headers.set("X-RateLimit-Remaining", result.remaining.toString());
  headers.set("X-RateLimit-Reset", result.resetAt.toISOString());
}

// ─────────────────────────────────────────────────────────────────────────────
// Cleanup (optional, for maintenance)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cleans up old rate limit records.
 * Call this periodically (e.g., via cron) to keep the table small.
 */
export async function cleanupOldRateLimits(olderThanHours: number = 48): Promise<number> {
  const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);

  const result = await db
    .delete(rateLimits)
    .where(sql`${rateLimits.windowStart} < ${cutoff}`);

  return result.rowCount ?? 0;
}
