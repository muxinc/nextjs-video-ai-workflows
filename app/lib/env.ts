/* eslint-disable node/no-process-env */
import { z } from "zod";

function optionalString(description: string, message?: string) {
  return z.preprocess(
    value => typeof value === "string" && value.trim().length === 0 ? undefined : value,
    z.string().trim().min(1, message).optional(),
  ).describe(description);
}

function requiredString(description: string, message?: string) {
  return z.preprocess(
    value => typeof value === "string" ? value.trim().length > 0 ? value.trim() : undefined : value,
    z.string().trim().min(1, message),
  ).describe(description);
}

const EnvSchema = z.object({
  NODE_ENV: z.string().default("development").describe("Runtime environment."),

  // Mux credentials (required for @mux/ai)
  MUX_TOKEN_ID: requiredString("Mux access token ID.", "Required to access Mux APIs"),
  MUX_TOKEN_SECRET: requiredString("Mux access token secret.", "Required to access Mux APIs"),

  // Mux signing keys (optional, for signed playback URLs)
  MUX_SIGNING_KEY: optionalString("Mux signing key ID for signed playback URLs."),
  MUX_PRIVATE_KEY: optionalString("Mux signing private key for signed playback URLs."),

  // AI provider keys (optional, depends on which provider you use)
  OPENAI_API_KEY: optionalString("OpenAI API key for OpenAI-backed workflows."),
  ANTHROPIC_API_KEY: optionalString("Anthropic API key for Claude-backed workflows."),
  GOOGLE_GENERATIVE_AI_API_KEY: optionalString("Google Generative AI API key for Gemini-backed workflows."),
});

export type Env = z.infer<typeof EnvSchema>;

function parseEnv(): Env {
  const parsedEnv = EnvSchema.safeParse(process.env);

  if (!parsedEnv.success) {
    // In development, show detailed errors
    // In production, fail fast but don't leak sensitive info
    const isDev = process.env.NODE_ENV === "development";

    if (isDev) {
      console.error("❌ Invalid environment variables:");
      console.error(JSON.stringify(parsedEnv.error.flatten().fieldErrors, null, 2));
    } else {
      console.error("❌ Invalid environment configuration. Check your environment variables.");
    }

    throw new Error("Environment validation failed");
  }

  return parsedEnv.data;
}

// Parse on module load (server-side only)
const env: Env = parseEnv();

export { env };
export default env;
