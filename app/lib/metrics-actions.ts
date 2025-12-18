"use server";

import { recordMetric as recordMetricInternal } from "./metrics";
import type { FeatureName } from "./metrics";

/**
 * Server action to record a feature metric from the client.
 */
export async function recordMetric(
  feature: FeatureName,
  metadata?: Record<string, any>,
) {
  return await recordMetricInternal(feature, metadata);
}
