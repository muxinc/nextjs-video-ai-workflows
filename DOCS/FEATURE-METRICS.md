# Feature Adoption Metrics

This document explains the lightweight feature adoption tracking system used to understand how users interact with the demo.

---

## Overview

Feature adoption metrics provide visibility into which features are being used and how often. This is a "lite" implementation that stores events in PostgreSQL — suitable for a demo but not a replacement for a production analytics service.

Metric recording is automatically **bypassed in development** (`NODE_ENV=development`) to avoid polluting production analytics with local testing data.

---

## Tracked Features

| Feature Name                 | Description                                   | Location                        |
| ---------------------------- | --------------------------------------------- | ------------------------------- |
| `semantic-search-nav`        | Semantic search via the top navigation bar    | `/search` page                  |
| `semantic-search-transcript` | Semantic search within the transcript panel   | Media detail page transcript    |
| `summarize-and-tag`          | Clicks on "Summarize & Tag" button            | Media detail page               |
| `translate-captions`         | Clicks on caption translation                 | Media detail localization panel |
| `translate-audio`            | Clicks on audio translation (dubbing)         | Media detail localization panel |
| `generate-preview`           | Clicks on "Generate Preview" for social clips | Media detail social clips panel |
| `download-social-clip`       | Downloads of rendered social clip videos      | Media detail social clips panel |

---

## Data Model

Metrics are stored in the `feature_metrics` table:

| Column       | Type      | Description                               |
| ------------ | --------- | ----------------------------------------- |
| `id`         | UUID      | Primary key                               |
| `feature`    | text      | Feature name (see table above)            |
| `identifier` | text      | Client IP address (optional)              |
| `metadata`   | jsonb     | Additional context (e.g., query, assetId) |
| `created_at` | timestamp | When the event occurred                   |

---

## How It Works

### Server-Side Recording

```typescript
import { recordMetric } from "@/app/lib/metrics";

// In a server action or API route
await recordMetric("summarize-and-tag", { assetId, tone });
```

### Client-Side Recording

For client components, use the server action wrapper:

```typescript
import { recordMetric } from "@/app/lib/metrics-actions";

// In a client component
void recordMetric("generate-preview", { assetId });
```

### Metadata

The `metadata` field stores contextual information as JSON:

- **Search queries**: `{ query: "how to deploy" }`
- **Asset context**: `{ assetId: "abc123" }`
- **Translation context**: `{ assetId: "abc123", targetLang: "es" }`
- **Download context**: `{ assetId: "abc123", aspectRatio: "portrait" }`

---

## Querying Metrics

### Feature Usage Count

```sql
SELECT feature, COUNT(*) as count
FROM feature_metrics
GROUP BY feature
ORDER BY count DESC;
```

### Daily Feature Usage

```sql
SELECT
  DATE(created_at) as date,
  feature,
  COUNT(*) as count
FROM feature_metrics
GROUP BY DATE(created_at), feature
ORDER BY date DESC, count DESC;
```

### Search Query Analysis

```sql
SELECT
  metadata->>'query' as query,
  COUNT(*) as count
FROM feature_metrics
WHERE feature = 'semantic-search-nav'
  AND metadata->>'query' IS NOT NULL
GROUP BY metadata->>'query'
ORDER BY count DESC
LIMIT 20;
```

---

## Maintenance

Old metrics are retained for analysis. For long-running deployments, consider periodic cleanup.

### Manual Cleanup

```bash
# Delete records older than 90 days (default)
npx tsx scripts/cleanup-metrics.ts

# Delete records older than 30 days
npx tsx scripts/cleanup-metrics.ts 30
```

---

## Privacy Considerations

- **IP addresses** are stored but can be set to `null` if privacy is a concern
- **No cookies** or persistent client identifiers are used
- **Metadata** should not include PII — only operational context

For stricter privacy requirements, modify `app/lib/metrics.ts` to omit the identifier:

```typescript
await db.insert(featureMetrics).values({
  feature,
  identifier: null, // Don't store IP
  metadata,
});
```

---

## Extending the System

### Adding a New Feature

1. Add the feature name to the `FeatureName` type in `app/lib/metrics.ts`
2. Call `recordMetric()` at the appropriate location
3. Update this documentation

### Production Recommendations

For production use, consider:

- **Dedicated analytics**: Mixpanel, Amplitude, PostHog
- **Event streaming**: Send events to a message queue for async processing
- **Aggregation**: Pre-compute daily/weekly summaries to reduce query load
- **Sampling**: For high-traffic features, sample instead of recording every event
