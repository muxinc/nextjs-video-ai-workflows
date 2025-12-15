# Implementation explained

This document captures the Next.js implementation outline that supports the "Demuxed Library" demo described in `context/application-explained.md`.

---

## The three integration layers (implementation view)

The demo is structured around three integration patterns. Each has distinct implementation characteristics:

| Layer | Pattern    | Implementation                                   | Vercel Workflow? |
| ----- | ---------- | ------------------------------------------------ | ---------------- |
| **1** | Primitives | Call primitives directly in route handler/action | No               |
| **2** | Workflows  | Run `@mux/ai` workflows durably via Vercel       | Yes (simple)     |
| **3** | Connectors | Compose with external tools in orchestration     | Yes (complex)    |

This section explains how each layer is implemented.

---

## Layer 1: Primitives (`getSummaryAndTags`)

The simplest pattern: call primitives directly from server-side code.

### Implementation

```typescript
// In a server action or route handler
import { getSummaryAndTags } from "@mux/ai/workflows";

const result = await getSummaryAndTags(assetId, {
  // options
});

// Persist result to Media record
await db.media.update({ where: { muxAssetId: assetId }, data: { summary: result } });
```

### Characteristics

- **Blocking**: the request waits for the result
- **No workflow infrastructure**: just a function call
- **Persistence is optional but recommended**: cache the result so subsequent page loads are instant
- **Error handling is inline**: catch and handle errors in the same request

### When to use this pattern

- Results needed immediately for the UI
- Operation completes in reasonable time (< 10s)
- No complex retry/resume requirements

---

## Layer 2: Workflows (`translateCaptions`, `translateAudio`)

Run `@mux/ai` workflows durably via Vercel Workflows for retries, progress tracking, and resumable execution.

### Implementation

Per the [Vercel Workflow docs](https://useworkflow.dev/docs/getting-started/next), `"use workflow"` goes inside the function body, and steps are separate functions with `"use step"` inside.

```typescript
// workflows/translate-captions.ts
import { translateCaptions } from "@mux/ai/workflows";

export async function translateCaptionsWorkflow(assetId: string, targetLang: string) {
  "use workflow";

  const result = await doTranslation(assetId, targetLang);
  await persistTrackId(assetId, targetLang, result.trackId);

  return result;
}

async function doTranslation(assetId: string, targetLang: string) {
  "use step";
  return await translateCaptions(assetId, "en", targetLang, {
    uploadToMux: true,
  });
}

async function persistTrackId(assetId: string, targetLang: string, trackId: string) {
  "use step";
  await db.media.update({
    where: { muxAssetId: assetId },
    data: { [`captionTrack_${targetLang}`]: trackId },
  });
}
```

### Starting the workflow from a route handler

Per the [Vercel Workflow docs](https://useworkflow.dev/docs/getting-started/next#create-your-route-handler), workflows are triggered via `start()` from `workflow/api` in a route handler:

```typescript
import { NextResponse } from "next/server";
import { start } from "workflow/api";

// app/api/workflows/translate-captions/route.ts
import { translateCaptionsWorkflow } from "@/workflows/translate-captions";

export async function POST(request: Request) {
  const { assetId, targetLang } = await request.json();

  // Executes asynchronously — returns immediately
  await start(translateCaptionsWorkflow, [assetId, targetLang]);

  return NextResponse.json({ message: "Workflow started" });
}
```

### Characteristics

- **Non-blocking**: `start()` returns immediately — the workflow runs in the background
- **Resumable**: if the process crashes, Vercel Workflow resumes from last completed step
- **Observable**: status tracking surfaces progress in the UI
- **Durable**: the workflow wraps one `@mux/ai` function with reliability guarantees

### When to use this pattern

- Operation takes significant time (> 10s)
- Need retry/resume semantics
- Want observable progress UI while work happens

---

## Layer 3: Connectors (clip creation with Remotion)

Compose primitives, workflows, and external tools in a single orchestrated pipeline.

### Implementation

Per the [Vercel Workflow docs](https://useworkflow.dev/docs/getting-started/next):

- `"use workflow"` goes inside the workflow function body (first line)
- `"use step"` goes inside separate step functions (first line of each)

```typescript
// workflows/create-clip.ts
import { Buffer } from "node:buffer";

import { renderClip, uploadToStorage } from "@/lib/remotion";

import { translateAudio, translateCaptions } from "@mux/ai/workflows";

// The main workflow function orchestrates the steps
export async function createClipWorkflow(input: ClipInput) {
  "use workflow";

  const { assetId, startTime, endTime, targetLangs, preset } = input;

  // Orchestrate the steps
  const captionResults = await translateAllCaptions(assetId, targetLangs);
  const audioResults = await dubAllAudio(assetId, targetLangs);
  const { videoBuffer, posterBuffer } = await renderClipStep(assetId, startTime, endTime, preset, captionResults, audioResults);
  const { videoUrl, posterUrl } = await uploadArtifacts(videoBuffer, posterBuffer);
  await finalizeClip(input.clipId, videoUrl, posterUrl);

  return { videoUrl, posterUrl };
}

// Step 1: Translate captions for each target language
async function translateAllCaptions(assetId: string, targetLangs: string[]) {
  "use step";
  return await Promise.all(
    targetLangs.map(lang => translateCaptions(assetId, "en", lang, { uploadToMux: true }))
  );
}

// Step 2: Dub audio for each target language
async function dubAllAudio(assetId: string, targetLangs: string[]) {
  "use step";
  return await Promise.all(
    targetLangs.map(lang => translateAudio(assetId, lang, { uploadToMux: true }))
  );
}

// Step 3: Render the clip with Remotion
async function renderClipStep(
  assetId: string,
  startTime: number,
  endTime: number,
  preset: string,
  captionTracks: CaptionResult[],
  audioTracks: AudioResult[]
) {
  "use step";
  return await renderClip({ assetId, startTime, endTime, preset, captionTracks, audioTracks });
}

// Step 4: Upload artifacts to storage
async function uploadArtifacts(videoBuffer: Buffer, posterBuffer: Buffer) {
  "use step";
  return await uploadToStorage(videoBuffer, posterBuffer);
}

// Step 5: Finalize the clip record
async function finalizeClip(clipId: string, videoUrl: string, posterUrl: string) {
  "use step";
  await db.clip.update({
    where: { id: clipId },
    data: { status: "ready", renderedUrl: videoUrl, posterUrl },
  });
}
```

### Characteristics

- **Multi-step orchestration**: each `"use step"` is a checkpoint
- **Dependency management**: later steps depend on earlier step outputs
- **External tool integration**: Remotion is not part of `@mux/ai`—we're composing it
- **Parallel where possible**: translate multiple languages concurrently
- **Observable pipeline**: UI shows which step is currently running

### Why Remotion lives here (not in Layer 1 or 2)

Remotion is an external tool, not an `@mux/ai` primitive. Placing it in the connectors layer:

- Shows how to **extend** beyond what the SDK provides
- Demonstrates the **orchestration power** of Vercel Workflows
- Keeps Layer 1 and 2 focused on pure `@mux/ai` usage

---

## Primitives from `@mux/ai/workflows`

Per `context/application-explained.md`, this demo uses three primitives exported by `@mux/ai/workflows`:

### `getSummaryAndTags` (Layer 1)

- **Purpose**: extract a title, description, and up to 10 keywords from storyboard + transcript.
- **Integration layer**: 1 (primitives)
- **How**: direct call in a server action or route handler, persist result to `Media`.

### `translateCaptions` (Layer 2 and 3)

- **Purpose**: translate a ready Mux text track (`.vtt`) from `sourceLang` to one or more `targetLangs`.
- **Integration layer**: 2 (workflows) or 3 (as a step in connectors)
- **How**: wrapped in `"use step"` within a Vercel Workflow; uploads translated VTT to Mux as a new text track.

### `translateAudio` (Layer 2 and 3)

- **Purpose**: dub the default audio track into a target language.
- **Integration layer**: 2 (workflows) or 3 (as a step in connectors)
- **How**: wrapped in `"use step"` within a Vercel Workflow; uploads dubbed audio to Mux as a new audio track.

---

## Mux Video API integration (`@mux/mux-node`)

In addition to `@mux/ai` workflows, this app will use the Mux Video API directly via `@mux/mux-node` to **retrieve**:

- the underlying **assets** (for list + detail views)
- **storyboards** (JSON metadata + VTT)
- **transcripts / text tracks** (VTT captions and/or plain-text transcripts)

All of these calls are **server-only** and will run from route handlers / server components (never from the client) because they require Mux credentials.

Reference: the `@mux/mux-node` method surface in [`api.md`](https://github.com/muxinc/mux-node-sdk/blob/master/api.md) (notably `client.video.assets.*` and `client.video.playback.*`).

### Env vars

We’ll configure these on the server runtime (local `.env.local`, Vercel project env vars, etc.):

- `MUX_TOKEN_ID`
- `MUX_TOKEN_SECRET`

Important constraints:

- Do **not** expose these as `NEXT_PUBLIC_*`.
- Only access them from server code (route handlers, server actions, server components).

### Client initialization (single shared module)

The Mux client is initialized in `app/lib/mux.ts`. This module:

- Creates a singleton `Mux` client from `@mux/mux-node` using credentials from the validated `env` module
- Exports typed helpers: `listAssets`, `getAsset`, `getPlaybackIdForAsset`, `getReadyAudioTracks`, `findAudioTrack`
- Defines types: `MuxAsset`, `AssetTrack`, `PlaybackPolicy`, `PlaybackAsset`

This keeps credential access centralized and avoids re-implementing error handling in every route. Always import from `@/lib/mux` rather than creating new `Mux` instances.

### Assets: list + retrieve (index + detail)

For the media index/detail pages we’ll fetch asset metadata using:

- `client.video.assets.list({ ...params })` for browse/search-style pages
- `client.video.assets.retrieve(assetId)` for a detail page

From the returned `Asset`, we’ll persist (or derive on demand) identifiers we need for playback + downstream retrieval:

- **`muxAssetId`**: the primary lookup key for our own app records
- **`muxPlaybackId`**: generally the first `playback_id` on the asset (or whichever policy we choose)
- **tracks list**: to locate text tracks we can fetch as VTT / transcript

### Storyboards: JSON metadata + VTT

Storyboards are accessed through the Playback API using a **playback ID**:

- `client.video.playback.storyboardMeta(playbackId, { ...params })` → returns storyboard JSON (as a string)
- `client.video.playback.storyboardVtt(playbackId, { ...params })` → returns storyboard VTT (as a string)

How we’ll use them:

- **UI**: optionally show a “storyboard preview” as a transparency / “how it was made” surface so users can see that storyboard frames were used under the hood.
- **Summarization (`getSummaryAndTags`)**: we only pass the **`assetId`**. The workflow handles fetching/using storyboard (and transcript when available) internally; our job is to make storyboard + transcript retrievable so we can both debug inputs and present them in the UI.

Implementation note: because these are deterministic per playback ID, we’ll treat them as cacheable artifacts (persist the returned strings or store a derived URL/reference in our `Media` record) to avoid re-fetching on every page load.

### Transcripts / captions: VTT and plain-text transcript

Text tracks are also accessed through the Playback API. The general flow:

1. Retrieve the asset (`client.video.assets.retrieve(assetId)`) and locate the text track we want (e.g. a `subtitles` track, or the “ready” track we consider canonical).
2. Use the playback endpoints to fetch the content:
   - `client.video.playback.track(playbackId, trackId, { ...params })` → returns the **VTT** text
   - `client.video.playback.transcript(playbackId, trackId, { ...params })` → returns a **plain-text** transcript

How we’ll use them:

- **Summarization grounding**: provide transcript text (or a derived excerpt) alongside storyboard context.
- **Caption rendering**: feed VTT into the clip renderer (Remotion) and into the player caption selector.
- **Translation workflows**: `translateCaptions` starts from a source VTT; we’ll use the “ready” English track as the default source.

### Where these calls live in Next.js

We’ll keep Mux reads behind a small set of server-only entrypoints:

- **Route handlers** (e.g. `GET /api/media`, `GET /api/media/[id]`) that return sanitized JSON to the UI
- **Server actions** for privileged operations triggered by UI buttons (optional)
- **Workflow steps** for background orchestration that needs additional Mux reads (e.g. fetch transcript before calling an AI model)

The guiding rule: the UI should never talk directly to Mux with secret credentials; it should call our own routes/actions which use the `@mux/mux-node` client internally.

## Remotion: the external tool in Layer 3

Remotion is **not** part of `@mux/ai`—it's an external video rendering tool that we integrate into the Layer 3 connectors. This is intentional: it demonstrates how to compose `@mux/ai` primitives with other tools.

### Why Remotion is in Layer 3 (connectors)

The demo's teaching structure requires this placement:

- **Layer 1**: Pure `@mux/ai`, call primitives directly, no external tools
- **Layer 2**: Pure `@mux/ai`, run workflows durably, no external tools
- **Layer 3**: `@mux/ai` primitives + external tools (Remotion), composed together

If we used Remotion in Layer 2, it would blur the distinction between "running a workflow durably" and "composing with external tools."

### Two modes: preview + render

This app uses Remotion in two modes:

1. **Preview**: an instant, interactive preview in the browser using `@remotion/player` (runs client-side, no workflow needed)
2. **Render**: a server-side render to MP4 (+ poster) as a step in the Layer 3 workflow

The approach is modeled after the Remotion "Next.js App Dir template": [`remotion-dev/template-next-app-dir`](https://github.com/remotion-dev/template-next-app-dir).

**Key insight: rendering is optional.** The preview phase is "free"—users can iterate on timing, styling, language, and layout as many times as they want without triggering any backend work or creating assets prematurely. Only when the user clicks "Render clip" does the Layer 3 workflow start.

### Composition model

We define one (or a small set of) Remotion compositions representing our clip formats. Each composition is driven entirely by **typed input props** so it can be previewed and rendered deterministically:

- **Timing**: `startTime`, `endTime` (or `duration`)
- **Media**: `playbackId` (or signed URL), plus optional audio override URL for dubbing
- **Captions**: VTT URL (original or translated) + rendering mode (single/dual language)
- **Branding**: palette tokens, type scale, layout preset (9:16 / 1:1 / 16:9)
- **Metadata**: talk title, speaker, etc. for lower thirds / title cards

### Preview (in-app, client-side)

The "Create clip" page renders a Remotion Player that is powered by the same props we will later pass to the server render:

- The page assembles the full props object from user inputs + persisted workflow outputs (track IDs, VTT URLs, dubbed audio URLs).
- The Player updates live as props change, so users can iterate quickly (captions on/off, layout preset, language variant, etc.).

Important: preview is **non-blocking** and does not require any render infrastructure—it's just React running the composition in the browser. This is not part of the Layer 3 workflow; it's a pure client-side feature.

#### Why preview-first matters

| Concern            | Preview phase           | Render phase            |
| ------------------ | ----------------------- | ----------------------- |
| **Cost**           | Zero (client-side only) | Compute + storage       |
| **Speed**          | Instant updates         | Minutes for full render |
| **Iteration**      | Unlimited changes       | Committed output        |
| **Assets created** | None                    | MP4 + poster stored     |

This two-phase approach lets users experiment freely before committing to the more expensive render operation. They can:

- Adjust clip start/end times
- Toggle captions on/off
- Switch between original and translated captions
- Switch between original and dubbed audio
- Change format preset (9:16, 1:1, 16:9)
- Tweak branding/styling options

All without triggering any backend work or creating assets they might not want.

### Rendering (Layer 3 workflow step)

Rendering is a **step** in the Layer 3 connectors workflow. Per the [Vercel Workflow docs](https://useworkflow.dev/docs/getting-started/next), steps are separate functions:

```typescript
// Called from createClipWorkflow:
const { videoBuffer, posterBuffer } = await renderClipStep(
  assetId,
  startTime,
  endTime,
  preset,
  captionResults,
  audioResults
);

// The step function:
async function renderClipStep(
  assetId: string,
  startTime: number,
  endTime: number,
  preset: string,
  captionTracks: CaptionResult[], // from earlier translateCaptions step
  audioTracks: AudioResult[] // from earlier translateAudio step
) {
  "use step";
  return await renderClip({ assetId, startTime, endTime, preset, captionTracks, audioTracks });
}
```

The render step:

1. Receives inputs from earlier `@mux/ai` steps (translated caption URLs, dubbed audio URLs)
2. Triggers a Remotion render to MP4
3. Returns the buffers for the next upload step

This placement in the workflow means:

- If the render fails, only the render step is retried
- Earlier translation work is preserved
- The UI can show "Rendering..." status specifically

### Dev vs prod rendering strategy

Following the template's split, we can support:

- **Local renders in development** (fast iteration): run renders on the same machine/process as the dev server.
- **Render at scale in production** (optional): use Remotion Lambda when we need reliable throughput.

The workflow structure stays the same either way; only the render backend changes.

### Where it fits in routes + data model

- `POST /api/clips/create`
  - Creates `Clip` record as `queued`
  - Starts the Layer 3 orchestration workflow
  - Immediately returns `clipId` and initial status
- `GET /api/media/[id]/clips`
  - Returns clips with `status`, `renderedUrl`, `posterUrl` for UI progress + playback

On the `Clip` model, we persist:

- `status` (`queued` → `translating` → `dubbing` → `rendering` → `ready` / `failed`)
- `renderedUrl`, `posterUrl`
- The exact composition props used for rendering (as JSON) for auditability and re-renders

## Suggested Next.js implementation outline

### Routes (App Router)

- `/(marketing)`
  - `/` landing
- `/media`
  - `/media/[slug]` detail
- `/media/[slug]/clips`
  - `/media/[slug]/clips/new`
  - `/media/[slug]/clips/[clipId]`

### Server actions / API routes

- `POST /api/workflows/translate-captions`
  - body: `{ assetId, sourceLang, targetLang }`
  - starts caption translation workflow
  - returns: `{ workflowRunId }`
- `POST /api/workflows/translate-audio`
  - body: `{ assetId, targetLang }`
  - starts audio dubbing workflow
  - returns: `{ workflowRunId }`
- `GET /api/workflows/[runId]/status`
  - returns current workflow status for polling
- `POST /api/clips/create`
  - body: `{ assetId, startTime, endTime, sourceLang, targetLangs, preset }`
  - starts multi-step clip creation workflow
  - returns: `{ workflowRunId }`

### Data model (zero-database approach)

This app intentionally avoids a database layer. All persistence happens in two places:

1. **Mux assets** — The source of truth for media and tracks
   - Translated caption tracks are attached directly to the Mux asset
   - Dubbed audio tracks are attached directly to the Mux asset
   - The asset's `tracks` array reflects all available language variants

2. **Browser localStorage** — Client-side state for workflow progress
   - Tracks in-flight workflow runs (workflow ID, status, started timestamp)
   - Persists across page refreshes so users can see progress
   - Cleared when workflows complete or fail

This approach means:

- No database setup or migrations
- Mux is the single source of truth for all media state
- Workflow progress is ephemeral but survives page refreshes
- Multiple browser tabs/devices won't share workflow state (acceptable for a demo)

#### localStorage schema

```typescript
// Key: `workflow:${assetId}:${workflowType}:${targetLang}`
// Example: `workflow:abc123:translateCaptions:es`
interface WorkflowProgress {
  workflowRunId: string;
  status: "queued" | "running" | "completed" | "failed";
  startedAt: string; // ISO timestamp
  completedAt?: string;
  error?: string;
}
```

#### Why this works

- **Layer 1 (Primitives)**: No persistence needed — results render immediately
- **Layer 2 (Workflows)**: localStorage tracks progress; Mux asset stores the result (new track)
- **Layer 3 (Connectors)**: localStorage tracks multi-step progress; final artifacts stored in S3/Mux

---

## Suggested build sequence (TODO checklist)

This ordering builds the app layer-by-layer so the teaching progression is always visible:

1. Foundation (browse + detail)
2. Layer 1 implementation (primitives)
3. Layer 2 implementation (workflows)
4. Layer 3 implementation (connectors with Remotion)

### 0) Project & env foundation

- [x] **Confirm env vars are wired for server-only use**
  - [x] `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET` available in local + deploy runtime
  - [x] Any workflow provider creds needed by `translateCaptions` / `translateAudio` (e.g. S3 creds, ElevenLabs) are present server-side only
- [x] **Create a single Mux client module**
  - [x] Add `app/lib/mux.ts` wrapper that exports the minimal read helpers we need (assets list/retrieve, playback ID extraction, audio track helpers)
  - [x] Add text track helpers (`getReadyTextTracks`, `findTextTrack`, `getTranscript`, `getTrackVtt`)
- [x] **Connect to Postgres for persisted data**
  - [x] Configure `DATABASE_URL` (Postgres + pgvector)
  - [x] Run Drizzle migrations to create `videos` and `video_chunks`
  - [x] Store asset metadata + embeddings to enable fast search and reduce repeated Mux API calls

### 1) Client-side workflow state (localStorage)

- [x] **Create localStorage helpers** (`app/lib/workflow-state.ts`)
  - [x] `getWorkflowProgress(assetId, workflowType, targetLang)` — read current status
  - [x] `setWorkflowProgress(assetId, workflowType, targetLang, status)` — update status
  - [x] `clearWorkflowProgress(assetId, workflowType, targetLang)` — remove on completion
  - [x] `getAllInFlightWorkflows(assetId)` — list all running workflows for an asset
- [x] **Define status types consistently**
  - [x] `WorkflowStatus`: `"queued" | "running" | "completed" | "failed"`

**Resumable UX goal:** when a workflow is started, the client persists the run ID + status in `localStorage`, and relevant UI surfaces rehydrate/poll on load. This lets users refresh or navigate away and back and still see an in-flight workflow continue asynchronously.

### 2) Read-only app surfaces (browse + detail)

- [x] **UI: `/media` index**
  - [x] Grid/list of talks fetched directly from Mux API
  - [x] Pagination with 6 items per page
- [x] **UI: `/media/[slug]` detail**
  - [x] Player using the asset's playback ID
  - [x] Transcript panel with VTT cues side-by-side with player
  - [x] Placeholder sections for Layer 1, 2, and 3 (even if empty initially)

### 3) Layer 1: Primitives (`getSummaryAndTags`)

- [x] **Implement "Generate summary" path**
  - [x] Server action calls `getSummaryAndTags(assetId, options)` synchronously
  - [x] Results rendered directly in the response (no persistence needed)
- [x] **Detail page displays summary + tags**
  - [x] Generated title/description block
  - [x] Tag chips
- [x] **Optional: show inputs used**
  - [x] Display storyboard preview and transcript excerpt in a "How it was made" disclosure

### 4) Layer 2: Workflows (Vercel Workflow infra)

- [x] **Wire Vercel Workflow in Next.js**
  - [x] Ensure workflow entrypoints exist under `workflows/*` using `"use workflow"`
  - [x] Ensure side-effect steps live in `"use step"` functions
- [x] **`POST /api/workflows/translate-captions`** and **`POST /api/workflows/translate-audio`**
  - [x] Starts a workflow run (returns workflow run ID)
  - [x] Client stores run ID + status in localStorage
- [x] **UI status callouts**
  - [x] For each action button: show `Queued / Running / Ready / Failed` inline
  - [x] Poll workflow status and update localStorage
  - [x] Clear "Layer 2: Workflows" label in UI

### 5) Layer 2: Caption translation + audio dubbing

- [x] **Caption translation flow**
  - [x] Identify the canonical source text track for an asset (the "ready" English captions)
  - [x] `translateCaptionsWorkflow` runs `translateCaptions` durably via Vercel Workflow
  - [x] Workflow attaches translated track directly to the Mux asset (`uploadToMux: true`)
  - [x] Refresh asset data to see new track in player selector
- [x] **Audio dubbing flow**
  - [x] `translateAudioWorkflow` runs `translateAudio` durably via Vercel Workflow
  - [x] Workflow attaches dubbed audio track directly to the Mux asset
  - [x] Refresh asset data to see new track in player selector

### 6) Layer 3: Social clips rendering (audiogram style with burnt-in captions)

- [x] **Create Remotion compositions for social clips**
  - [x] Define 3 aspect ratio variants: Portrait (9:16), Square (1:1), Landscape (16:9)
  - [x] Input props schema: `playbackId`, `startTime`, `endTime`, `captions[]`, optional `title`
  - [x] **Audio-only extraction**: uses Mux audio URL (`stream.mux.com/{playbackId}/audio.m4a`)
  - [x] **Burnt-in captions**: animated caption display synced to transcript cues
  - [x] **Audiogram design**: audio visualizer bars + caption text on styled background
  - [x] Register compositions in `remotion/root.tsx` with dynamic duration calculation
- [x] **Implement "[RENDER VIDEOS]" button in workflows panel**
  - [x] Button triggers parallel rendering of all 3 aspect ratios simultaneously
  - [x] Clip timing and captions automatically extracted from transcript cues (~15 seconds)
  - [x] Clear "Layer 3: Connectors" label in UI (LVL 3 badge)
- [x] **Multi-clip render workflow**
  - [x] `startSocialClipsRenderAction` starts 3 parallel `renderVideoWorkflow` instances
  - [x] `pollSocialClipsRenderAction` polls status for all clips simultaneously
  - [x] Each clip uses existing `renderVideoWorkflow` with different composition ID
  - [x] Captions passed as input props, filtered to clip time range
- [x] **UI: clip progress and download**
  - [x] Shows compact progress cards for each aspect ratio (Portrait/Square/Landscape)
  - [x] Mini step indicators: Preparing → Rendering → Finalizing
  - [x] Download buttons appear when each clip completes (shows file size)
  - [x] Aggregate status badge reflects overall progress
  - [x] Error handling and reset functionality

### 7) Layer 3: Connectors (future: full orchestration with translations)

- [x] **Extend clip creation with translation steps** (future enhancement)
  - [x] `POST /api/clips/create` starts `createClipWorkflow` which orchestrates:
    - Step 1: `translateCaptions` for each target language (if needed)
    - Step 2: `translateAudio` for each target language (if needed)
    - Step 3: Remotion render for each aspect ratio
    - Step 4: Upload to S3 storage
  - [x] Returns workflow run ID; client tracks progress in localStorage
- [x] **Preview UI** (future enhancement)
  - [x] `/media/[slug]/clips/new` page with Remotion Player preview
  - [x] Inputs: start/end, preset, caption lang, audio lang, styling options
  - [x] Preview updates live as user changes inputs — unlimited iteration before committing
  - [x] "Render clip" CTA only triggers workflow when satisfied with preview
