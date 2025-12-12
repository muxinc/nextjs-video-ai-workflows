# AGENTS.md

Guidance for AI coding assistants working on this project.

---

## What this project is

A **reference architecture** demonstrating how to integrate `@mux/ai` with **Vercel Workflows** to build video intelligence pipelines in Next.js.

The app ("Demuxed Library") uses real Mux assets to teach three integration levels:

| Level | Pattern              | Example                                                                     |
| ----- | -------------------- | --------------------------------------------------------------------------- |
| **1** | Sync call            | `getSummaryAndTags()` — direct function invocation                          |
| **2** | Basic async workflow | `translateCaptions`, `translateAudio` — single primitive in Vercel Workflow |
| **3** | Custom workflow      | Clip creation — multi-step orchestration with Remotion                      |

**Read the full context:**

- `context/application-explained.md` — what the app does and why
- `context/design-explained.md` — visual design and UX patterns
- `context/implementation-explained.md` — routes, data model, and code patterns

---

## Code style (ESLint)

This project uses `@antfu/eslint-config` with custom rules dictated within `eslint.config.mjs`. Key points:

### Formatting

- **Indent**: 2 spaces
- **Semicolons**: always
- **Quotes**: double quotes (`"`)
- **Brace style**: cuddled (`} else {` on same line)
- **Operators**: at end of line, not beginning

### Import ordering

Imports are sorted by the `perfectionist/sort-imports` rule:

```typescript
// 1. Side-effect styles
import "./styles.css";

// 2. Built-in modules
import { Buffer } from "node:buffer";

// 5. Parent/sibling/index
import { env } from "@/lib/env";
// 3. External packages
import { z } from "zod";

// 4. Internal (@mux/ai is treated as internal)
import { getSummaryAndTags } from "@mux/ai/workflows";
```

**Blank lines between groups are required.**

### File naming

- **kebab-case** for all files (e.g., `translate-captions.ts`, not `translateCaptions.ts`)
- Exception: `README.md` and other all-caps markdown files

### Console usage

- `console.log` triggers a warning — prefer structured logging or remove before committing

---

## Environment variables

All env vars are validated at startup via `app/lib/env.ts` using Zod.

### Required variables

```bash
# Mux credentials
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=

# ElevenLabs (for translateAudio)
ELEVENLABS_API_KEY=

# S3-compatible storage (for translation workflows)
S3_ENDPOINT=
S3_REGION=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
```

### Optional variables

```bash
# Mux signing keys (for signed playback URLs)
MUX_SIGNING_KEY=
MUX_PRIVATE_KEY=

# AI providers (at least one is needed)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=
```

### Accessing env vars

**Never use `process.env` directly.** Import from the validated env module:

```typescript
import { env } from "@/lib/env";

// ✅ Correct
const tokenId = env.MUX_TOKEN_ID;

// ❌ Wrong — bypasses validation, triggers ESLint error
// eslint-disable-next-line node/no-process-env
const tokenId = process.env.MUX_TOKEN_ID;
```

The ESLint rule `node/no-process-env` enforces this.

---

## Mux client (`app/lib/mux.ts`)

The shared Mux client and helpers live in `app/lib/mux.ts`. This module:

- Initializes a singleton `Mux` client from `@mux/mux-node`
- Exports typed helpers for asset retrieval, playback ID extraction, and track lookups
- Centralizes all credential access (uses validated `env` module)

**Always import from this module** rather than creating new `Mux` instances:

```typescript
import { getAsset, getPlaybackIdForAsset, listAssets } from "@/lib/mux";

// ✅ Correct — uses shared client
const asset = await getAsset(assetId);

// ❌ Wrong — creates duplicate client, bypasses centralized setup
const mux = new Mux({ tokenId: env.MUX_TOKEN_ID, tokenSecret: env.MUX_TOKEN_SECRET });
```

---

## Vercel Workflow patterns

### Directive placement

Per [Vercel Workflow docs](https://useworkflow.dev/docs/getting-started/next):

- `"use workflow"` goes **inside** the workflow function (first line)
- `"use step"` goes **inside** each step function (first line)

```typescript
// ✅ Correct
export async function myWorkflow(input: Input) {
  "use workflow";
  // orchestration logic
}

async function myStep(data: Data) {
  "use step";
  // business logic
}
```

### Starting workflows from route handlers

Per [Vercel Workflow docs](https://useworkflow.dev/docs/getting-started/next#create-your-route-handler), workflows are triggered via `start()` from `workflow/api` in a route handler:

```typescript
// app/api/workflows/translate-captions/route.ts
import { translateCaptionsWorkflow } from "@/workflows/translate-captions";
import { NextResponse } from "next/server";
import { start } from "workflow/api";

export async function POST(request: Request) {
  const { assetId, targetLang } = await request.json();

  // Executes asynchronously and doesn't block your app
  await start(translateCaptionsWorkflow, [assetId, targetLang]);

  return NextResponse.json({ message: "Workflow started" });
}
```

Key points:

- `start()` returns immediately — the workflow runs in the background
- Pass workflow arguments as an array (second argument to `start`)
- Workflows can be triggered from route handlers, server actions, or any server-side code

### Level 2: Single-primitive workflows

Wrap one `@mux/ai` function in a workflow:

```typescript
export async function translateCaptionsWorkflow(assetId: string, targetLang: string) {
  "use workflow";
  const result = await doTranslation(assetId, targetLang);
  await persistTrackId(assetId, targetLang, result.trackId);
  return result;
}

async function doTranslation(assetId: string, targetLang: string) {
  "use step";
  return await translateCaptions(assetId, "en", targetLang, { uploadToMux: true });
}
```

### Level 3: Multi-step custom workflows

Orchestrate multiple primitives + external tools:

```typescript
export async function createClipWorkflow(input: ClipInput) {
  "use workflow";
  const captions = await translateAllCaptions(input.assetId, input.targetLangs);
  const audio = await dubAllAudio(input.assetId, input.targetLangs);
  const { videoBuffer, posterBuffer } = await renderClipStep(input, captions, audio);
  const { videoUrl, posterUrl } = await uploadArtifacts(videoBuffer, posterBuffer);
  await finalizeClip(input.clipId, videoUrl, posterUrl);
  return { videoUrl, posterUrl };
}
```

---

## Remotion usage

Remotion is used **only in Level 3** (custom workflow) to demonstrate composing `@mux/ai` with external tools.

### Two phases

| Phase       | Where                    | Cost    | Purpose            |
| ----------- | ------------------------ | ------- | ------------------ |
| **Preview** | Client (Remotion Player) | Free    | Iterate on styling |
| **Render**  | Server (Workflow step)   | Compute | Produce MP4        |

**Preview is unlimited and free.** Users can tweak timing, captions, audio, branding without triggering any backend work. Rendering only happens when they click "Render clip".

---

## Design principles

From `context/design-explained.md`:

- **Minimal, high-contrast, brutalist**: thick black borders, sharp corners, hard shadows
- **Level indicators**: badge each section with "SYNC CALL", "ASYNC WORKFLOW", or "CUSTOM WORKFLOW"
- **Status callouts**: inline progress, not global toasts
  - Level 2: single-step status (Queued → Running → Ready)
  - Level 3: multi-step pipeline (✓ Translating → ● Rendering → ○ Uploading)
- **Responsive**: stack vertically on mobile, two-column on desktop

---

## Key routes

```
/                           # Landing — pitch the three levels
/media                      # Index — browse talks
/media/[slug]               # Detail — all three levels on one asset
/media/[slug]/clips/new     # Clip creation — Level 3 showcase
/media/[slug]/clips/[id]    # Clip detail — rendered output
```

---

## Data model

```typescript
// Media — a Mux asset with optional AI-generated metadata
interface Media {
  id: string;
  slug: string;
  title: string;
  muxAssetId: string;
  muxPlaybackId: string;
  summary?: { title: string; description: string; tags: string[] };
}

// WorkflowRun — tracks async workflow execution
interface WorkflowRun {
  id: string;
  mediaId: string;
  workflow: "translateCaptions" | "translateAudio" | "createClip";
  status: "queued" | "running" | "completed" | "failed";
  resultJson?: object;
}

// Clip — a rendered social clip
interface Clip {
  id: string;
  mediaId: string;
  startTime: number;
  endTime: number;
  status: "queued" | "translating" | "dubbing" | "rendering" | "ready" | "failed";
  renderedUrl?: string;
  posterUrl?: string;
}
```

---

## Common tasks

### Adding a new workflow

1. Create `workflows/my-workflow.ts` (kebab-case)
2. Define workflow function with `"use workflow"` inside
3. Define step functions with `"use step"` inside each
4. Add route handler to trigger it via `start()` from `workflow/api`
5. Persist `WorkflowRun` record for status tracking

### Adding a new env var

1. Add to `EnvSchema` in `app/lib/env.ts`
2. Use `requiredString()` or `optionalString()` helper
3. Access via `env.MY_VAR`, never `process.env.MY_VAR`

### Running locally

```bash
npm run dev
```

Workflows execute locally in dev mode. Use `npx workflow web` to inspect runs.
