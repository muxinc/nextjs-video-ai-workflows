# Rate Limiting

This document explains the IP-based rate limiting system that protects the demo from excessive API costs.

---

## Overview

Since this demo has no authentication, we use **client IP addresses** stored in PostgreSQL to throttle expensive operations. Each endpoint has configurable limits per time window.

Rate limiting is automatically **bypassed in development** (`NODE_ENV=development`) to avoid blocking local iteration.

---

## Rate Limits

| Endpoint             | Limit | Window | Cost Level |
| -------------------- | ----- | ------ | ---------- |
| `translate-audio`    | 3     | 24h    | High       |
| `translate-captions` | 10    | 24h    | Moderate   |
| `render`             | 6     | 24h    | Moderate   |
| `summary`            | 10    | 24h    | Moderate   |
| `search`             | 50    | 1h     | Low        |

Limits are configured in `app/lib/rate-limit.ts`:

```typescript
export const RATE_LIMITS = {
  "translate-audio": { maxRequests: 3, windowHours: 24 },
  "translate-captions": { maxRequests: 10, windowHours: 24 },
  "render": { maxRequests: 6, windowHours: 24 },
  "summary": { maxRequests: 10, windowHours: 24 },
  "search": { maxRequests: 50, windowHours: 1 },
};
```

---

## How It Works

### IP Extraction

Client IPs are extracted from request headers in order of preference:

1. `x-forwarded-for` (first IP)
2. `x-real-ip`
3. `cf-connecting-ip` (Cloudflare)
4. `x-vercel-forwarded-for` (Vercel)
5. Falls back to `"unknown"`

### Storage

Rate limit records are stored in the `rate_limits` table:

| Column          | Type      | Description                  |
| --------------- | --------- | ---------------------------- |
| `id`            | UUID      | Primary key                  |
| `identifier`    | text      | Client IP address            |
| `endpoint`      | text      | Rate-limited endpoint name   |
| `window_start`  | timestamp | Start of the current window  |
| `request_count` | integer   | Requests made in this window |

### Window Calculation

Windows are aligned to fixed boundaries (e.g., all 24h windows start at midnight UTC). This ensures consistent rate limiting across requests.

---

## Integration Examples

### In Server Actions

```typescript
import { checkRateLimit, getClientIp } from "@/app/lib/rate-limit";

export async function myAction() {
  const clientIp = await getClientIp();
  const result = await checkRateLimit(clientIp, "summary");

  if (!result.allowed) {
    return { error: `Rate limit exceeded. Try again later.` };
  }

  // Proceed with the action...
}
```

### In Route Handlers

```typescript
import { checkRateLimit, getClientIpFromRequest } from "@/app/lib/rate-limit";

export async function POST(request: Request) {
  const clientIp = getClientIpFromRequest(request);
  const result = await checkRateLimit(clientIp, "render");

  if (!result.allowed) {
    return Response.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  // Proceed with the request...
}
```

---

## Response Headers

When rate limiting is active, responses include standard headers:

| Header                  | Description                          |
| ----------------------- | ------------------------------------ |
| `X-RateLimit-Limit`     | Maximum requests allowed per window  |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset`     | ISO timestamp when the window resets |

---

## Maintenance

Old rate limit records are automatically cleaned up via a weekly GitHub Action.

### Automatic Cleanup

- **Workflow:** `.github/workflows/cleanup-rate-limits.yml`
- **Schedule:** Every Sunday at 3:00 AM UTC
- **Retention:** Deletes records older than 168 hours (7 days)

### Manual Cleanup

Run the cleanup script directly:

```bash
# Delete records older than 7 days (default)
npx tsx scripts/cleanup-rate-limits.ts

# Delete records older than 48 hours
npx tsx scripts/cleanup-rate-limits.ts 48
```

Or trigger from GitHub Actions → "Cleanup Rate Limits" → Run workflow.

---

## Required Secrets

For the cleanup GitHub Action, add this secret to your repository:

| Secret Name    | Description                                |
| -------------- | ------------------------------------------ |
| `DATABASE_URL` | PostgreSQL connection string with pgvector |

---

## Troubleshooting

### Rate limit not working in development

This is expected. Rate limiting is bypassed when `NODE_ENV=development` to avoid blocking local iteration.

### Getting `::1` as identifier locally

This is correct. `::1` is the IPv6 loopback address (equivalent to `127.0.0.1`). Modern systems often prefer IPv6 when connecting to localhost.

### Rate limit records accumulating

Ensure the cleanup GitHub Action is running. Check Actions → "Cleanup Rate Limits" for run history. You may also need to verify `DATABASE_URL` is set in repository secrets.
