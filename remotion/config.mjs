/**
 * Use autocomplete to get a list of available regions.
 * @type {import('@remotion/lambda').AwsRegion}
 */
export const REGION = "us-east-1";

// The name of the Remotion site
// Using a consistent name ensures deploys update the existing site rather than creating a new one
export const SITE_NAME = "nextjs-video-ai-workflows";

// Lambda memory in MB (min: 512, max: 10240)
// Higher RAM = faster renders but higher cost
export const RAM = 3009;

// Ephemeral storage in MB (min: 512, max: 10240)
// Increase if rendering long or high-resolution videos
export const DISK = 10240;

// Lambda timeout in seconds (max: 900)
// Increase for longer videos that take more time to render
export const TIMEOUT = 240;
