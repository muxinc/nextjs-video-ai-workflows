import { enableTailwind } from "@remotion/tailwind-v4";

/**
 *  @param {import('webpack').Configuration} currentConfig
 */
export function webpackOverride(currentConfig) {
  return enableTailwind(currentConfig);
}
