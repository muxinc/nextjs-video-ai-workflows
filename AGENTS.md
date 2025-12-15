# AGENTS.md

Guidance for AI coding assistants working on this project.

---

## What this project is

A **reference architecture** demonstrating how to integrate `@mux/ai` with **Vercel Workflows** to ship video intelligence that holds up at scale.

The app ("Demuxed Library") uses real Mux assets to teach three integration layers:

| Layer | Pattern    | Example                                                       |
| ----- | ---------- | ------------------------------------------------------------- |
| **1** | Primitives | `getSummaryAndTags()` — call primitives directly              |
| **2** | Workflows  | `translateCaptions`, `translateAudio` — run workflows durably |
| **3** | Connectors | Clip creation — compose with external tools like Remotion     |

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

# OpenAI (required for embeddings)
OPENAI_API_KEY=

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

# Additional AI providers
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
import { NextResponse } from "next/server";
import { start } from "workflow/api";

// app/api/workflows/translate-captions/route.ts
import { translateCaptionsWorkflow } from "@/workflows/translate-captions";

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

### Layer 2: Running workflows durably

Wrap one `@mux/ai` function in a workflow for retries, progress tracking, and resumable execution:

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

### Resumability: what users should experience

This demo intentionally showcases **durable workflows + resumable UI**:

- Workflows run asynchronously via `start()` and continue even if the user refreshes or navigates away.
- The UI persists in-flight runs in browser `localStorage` (see `app/lib/workflow-state.ts`) and rehydrates/polls on page load so users can leave and come back and still see progress.

### Layer 3: Composing with connectors

Orchestrate multiple primitives, workflows, and external tools:

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

Remotion is used **only in Layer 3** (connectors) to demonstrate composing `@mux/ai` with external tools.

### Two phases

| Phase       | Where                    | Cost    | Purpose            |
| ----------- | ------------------------ | ------- | ------------------ |
| **Preview** | Client (Remotion Player) | Free    | Iterate on styling |
| **Render**  | Server (Workflow step)   | Compute | Produce MP4        |

**Preview is unlimited and free.** Users can tweak timing, captions, audio, branding without triggering any backend work. Rendering only happens when they click "Render clip".

### Configuration

Remotion files live in the `remotion/` directory:

| File                   | Purpose                                   |
| ---------------------- | ----------------------------------------- |
| `index.ts`             | Entry point registering compositions      |
| `root.tsx`             | Root component wrapping all compositions  |
| `composition.tsx`      | Video composition definitions             |
| `config.mjs`           | Remotion configuration (frame rate, etc.) |
| `webpack-override.mjs` | Custom webpack config for bundling        |
| `deploy.mjs`           | Lambda deployment script                  |

### NPM scripts

```bash
# Development — opens Remotion Studio for live preview
npm run remotion:studio

# Local render — test rendering videos on your machine
# Pass the composition name as an argument
npm run remotion:render:local default-composition

# Optionally specify an output path
npm run remotion:render:local default-composition out/foo.mp4

# Production deploy — bundle and deploy to AWS Lambda
npm run remotion:deploy
```

**Important:** `remotion:deploy` is for **production use only**. It bundles your Remotion site and deploys it to AWS Lambda for serverless video rendering. Use `remotion:studio` and `remotion:render:local` during development.

---

## Design principles

From `context/design-explained.md`:

- **Minimal, high-contrast, brutalist**: thick black borders, sharp corners, hard shadows
- **Layer indicators**: badge each section with "PRIMITIVES", "WORKFLOWS", or "CONNECTORS"
- **Status callouts**: inline progress, not global toasts
  - Layer 2: single-step status (Queued → Running → Ready)
  - Layer 3: multi-step pipeline (✓ Translating → ● Rendering → ○ Uploading)
- **Responsive**: stack vertically on mobile, two-column on desktop

---

## Key routes

```
/                           # Landing — pitch the three layers
/media                      # Index — browse talks
/media/[slug]               # Detail — all three layers on one asset
/media/[slug]/clips/new     # Clip creation — Layer 3 showcase
/media/[slug]/clips/[id]    # Clip detail — rendered output
```

---

## Data model (Postgres + Mux)

This app uses **Postgres (via Drizzle + pgvector)** as a persisted storage layer for catalog metadata and vector embeddings, while Mux remains the source of truth for video assets and tracks.

### 1. Mux assets (source of truth)

Translated caption and audio tracks are attached directly to Mux assets using the `uploadToMux: true` option. The asset's `tracks` array reflects all available language variants.

### 2. Postgres (metadata + embeddings)

Asset metadata is persisted in Postgres (table: `videos`), and transcript chunks with embeddings are stored in `video_chunks` for semantic search.

### 3. Browser localStorage (workflow progress)

Client-side state tracks in-flight workflows:

```typescript
// Key: `workflow:${assetId}:${workflowType}:${targetLang}`
interface WorkflowProgress {
  workflowRunId: string;
  status: "queued" | "running" | "completed" | "failed";
  startedAt: string; // ISO timestamp
  completedAt?: string;
  error?: string;
}
```

This means:

- Mux is the single source of truth for all media and track state
  - Postgres stores asset metadata + embeddings for fast search and discovery
- Workflow progress survives page refreshes but is browser-local
- Multiple browser tabs/devices won't share workflow state (acceptable for a demo)

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
