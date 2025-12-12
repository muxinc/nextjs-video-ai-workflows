# Implementation explained

This document captures the Next.js implementation outline that supports the "Demuxed Library" demo described in `context/application-explained.md`.

---

## The three integration levels (implementation view)

The demo is structured around three integration patterns. Each has distinct implementation characteristics:

| Level | Pattern              | Implementation                                  | Vercel Workflow? |
| ----- | -------------------- | ----------------------------------------------- | ---------------- |
| **1** | Sync call            | Direct function call in route handler/action    | No               |
| **2** | Basic async workflow | Single `@mux/ai` primitive in a Vercel Workflow | Yes (simple)     |
| **3** | Custom workflow      | Multi-step orchestration with external tools    | Yes (complex)    |

This section explains how each level is implemented.

---

## Level 1: Synchronous call (`getSummaryAndTags`)

The simplest pattern: call the function directly from server-side code.

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

## Level 2: Basic async workflow (`translateCaptions`, `translateAudio`)

Wrap a single `@mux/ai` primitive in a Vercel Workflow for reliability.

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
// app/api/workflows/translate-captions/route.ts
import { translateCaptionsWorkflow } from "@/workflows/translate-captions";
import { NextResponse } from "next/server";
import { start } from "workflow/api";

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
- **Status tracking**: persist `WorkflowRun` records to surface progress in the UI
- **Single primitive**: the workflow wraps one `@mux/ai` function

### When to use this pattern

- Operation takes significant time (> 10s)
- Need retry/resume semantics
- Want to show progress UI while work happens

---

## Level 3: Custom workflow (clip creation with Remotion)

Orchestrate multiple primitives and external tools in a single workflow.

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
- **Complex status**: UI shows which step is currently running

### Why Remotion lives here (not in Level 1 or 2)

Remotion is an external tool, not an `@mux/ai` primitive. Placing it in the custom workflow:

- Shows how to **extend** beyond what the SDK provides
- Demonstrates the **orchestration power** of Vercel Workflows
- Keeps Level 1 and 2 focused on pure `@mux/ai` usage

---

## Primitives from `@mux/ai/workflows`

Per `context/application-explained.md`, this demo uses three primitives exported by `@mux/ai/workflows`:

### `getSummaryAndTags` (Level 1)

- **Purpose**: extract a title, description, and up to 10 keywords from storyboard + transcript.
- **Integration level**: 1 (sync call)
- **How**: direct call in a server action or route handler, persist result to `Media`.

### `translateCaptions` (Level 2 and 3)

- **Purpose**: translate a ready Mux text track (`.vtt`) from `sourceLang` to one or more `targetLangs`.
- **Integration level**: 2 (basic workflow) or 3 (as a step in custom workflow)
- **How**: wrapped in `"use step"` within a Vercel Workflow; uploads translated VTT to Mux as a new text track.

### `translateAudio` (Level 2 and 3)

- **Purpose**: dub the default audio track into a target language.
- **Integration level**: 2 (basic workflow) or 3 (as a step in custom workflow)
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

## Remotion: the external tool in Level 3

Remotion is **not** part of `@mux/ai`—it's an external video rendering tool that we integrate into the Level 3 custom workflow. This is intentional: it demonstrates how to compose `@mux/ai` primitives with other tools.

### Why Remotion is in Level 3 (custom workflow)

The demo's teaching structure requires this placement:

- **Level 1**: Pure `@mux/ai`, sync call, no external tools
- **Level 2**: Pure `@mux/ai`, wrapped in Vercel Workflow, no external tools
- **Level 3**: `@mux/ai` primitives + external tools (Remotion), orchestrated together

If we used Remotion in Level 2, it would blur the distinction between "basic workflow wrapping a single primitive" and "custom workflow composing multiple tools."

### Two modes: preview + render

This app uses Remotion in two modes:

1. **Preview**: an instant, interactive preview in the browser using `@remotion/player` (runs client-side, no workflow needed)
2. **Render**: a server-side render to MP4 (+ poster) as a step in the Level 3 workflow

The approach is modeled after the Remotion "Next.js App Dir template": [`remotion-dev/template-next-app-dir`](https://github.com/remotion-dev/template-next-app-dir).

**Key insight: rendering is optional.** The preview phase is "free"—users can iterate on timing, styling, language, and layout as many times as they want without triggering any backend work or creating assets prematurely. Only when the user clicks "Render clip" does the Level 3 workflow start.

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

Important: preview is **non-blocking** and does not require any render infrastructure—it's just React running the composition in the browser. This is not part of the workflow; it's a pure client-side feature.

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

### Rendering (Level 3 workflow step)

Rendering is a **step** in the Level 3 custom workflow. Per the [Vercel Workflow docs](https://useworkflow.dev/docs/getting-started/next), steps are separate functions:

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
  - Starts the Level 3 orchestration workflow
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

- `POST /api/workflows/run`
  - body: `{ assetId, workflow, params }`
  - runs selected workflow(s)
  - persists result
- `GET /api/media`
- `GET /api/media/[id]`
- `POST /api/clips/create`
  - body: `{ assetId, startTime, endTime, sourceLang, targetLangs, preset }`
  - orchestrates: translateCaptions + translateAudio + Remotion render
- `GET /api/media/[id]/clips`

### Data model (minimal)

- `Media`:
  - `id`, `slug`, `title`, `muxAssetId`, `muxPlaybackId`, `type`, `sourceMeta`
- `WorkflowRun`:
  - `mediaId`, `workflow`, `status`, `startedAt`, `completedAt`, `resultJson`, `providerMeta`
- `Clip`:
  - `mediaId`, `startTime`, `endTime`, `status`, `renderedUrl`, `posterUrl`
  - `captionTrackIdsByLang`, `audioTrackIdsByLang` (so the UI can switch variants)

---

## Suggested build sequence (TODO checklist)

This ordering builds the app level-by-level so the teaching progression is always visible:

1. Foundation (browse + detail)
2. Level 1 implementation (sync summarization)
3. Level 2 implementation (basic async workflows)
4. Level 3 implementation (custom workflow with Remotion)

### 0) Project & env foundation

- [x] **Confirm env vars are wired for server-only use**
  - [x] `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET` available in local + deploy runtime
  - [x] Any workflow provider creds needed by `translateCaptions` / `translateAudio` (e.g. S3 creds, ElevenLabs) are present server-side only
- [x] **Create a single Mux client module**
  - [x] Add `app/lib/mux.ts` wrapper that exports the minimal read helpers we need (assets list/retrieve, playback ID extraction, audio track helpers)
  - [ ] Add storyboard meta/vtt and track vtt/transcript helpers (when needed for Level 1+)

### 1) Data persistence (minimal, but real)

- [ ] **Pick persistence mechanism (and implement it)**
  - [ ] `Media`, `WorkflowRun`, `Clip` tables/collections with fields described above
  - [ ] Simple "upsert" helpers: `upsertMediaFromMuxAsset`, `saveWorkflowRun`, `createClip`, `updateClipStatus`
- [ ] **Define status enums consistently**
  - [ ] `WorkflowRun.status`: `queued | running | completed | failed`
  - [ ] `Clip.status`: `queued | translating | dubbing | rendering | ready | failed`

### 2) Read-only app surfaces (browse + detail)

- [ ] **`GET /api/media`**
  - [ ] Returns a list of `Media` (hydrated from persisted records, with a refresh path from Mux as needed)
- [ ] **`GET /api/media/[id]`**
  - [ ] Returns one `Media` + any persisted `WorkflowRun` outputs needed for the page
- [ ] **UI: `/media` index**
  - [ ] Grid/list of talks populated from `GET /api/media`
- [ ] **UI: `/media/[slug]` detail**
  - [ ] Player using the `muxPlaybackId`
  - [ ] Placeholder sections for Level 1, 2, and 3 (even if empty initially)

### 3) Level 1: Sync summarization (`getSummaryAndTags`)

- [ ] **Implement "Generate summary" path**
  - [ ] Server action calls `getSummaryAndTags(assetId, options)` synchronously
  - [ ] Persist result onto `Media` (and optionally a `WorkflowRun` record for auditability)
- [ ] **Detail page rehydrates summary + tags**
  - [ ] Generated title/description block
  - [ ] Tag chips (used on index once available)
  - [ ] Clear "Level 1: Sync call" label in UI
- [ ] **Optional: cache storyboard/transcript artifacts**
  - [ ] Persist storyboard JSON/VTT and transcript excerpt for the "How it was made" disclosure

### 4) Level 2: Basic async workflows (Vercel Workflow infra)

- [ ] **Wire Vercel Workflow in Next.js**
  - [ ] Ensure workflow entrypoints exist under `workflows/*` using `"use workflow"`
  - [ ] Ensure side-effect steps live in `"use step"` functions
- [ ] **`POST /api/workflows/run`**
  - [ ] Starts a workflow run (returns run id + initial status)
  - [ ] Persists `WorkflowRun` as `queued` and updates as it progresses
- [ ] **UI status callouts**
  - [ ] For each action button: show `Queued / Running / Ready / Failed` inline
  - [ ] Clear "Level 2: Async workflow" label in UI

### 5) Level 2: Caption translation + audio dubbing

- [ ] **Caption translation flow**
  - [ ] Identify the canonical source text track for an asset (the "ready" English captions)
  - [ ] `translateCaptionsWorkflow` wraps `translateCaptions` in a Vercel Workflow
  - [ ] Persist returned track IDs into `Media`
  - [ ] Rehydrate into the player caption selector
- [ ] **Audio dubbing flow**
  - [ ] `translateAudioWorkflow` wraps `translateAudio` in a Vercel Workflow
  - [ ] Persist returned audio track IDs
  - [ ] Rehydrate into the player audio selector

### 6) Level 3: Clip creation UI (Remotion preview — "free" iteration)

- [ ] **Create `/media/[slug]/clips/new` UI**
  - [ ] Inputs: start/end, preset (9:16/1:1/16:9), caption lang, audio lang, styling options
  - [ ] Always-on Remotion Player preview (client-side, no render cost)
  - [ ] Preview updates live as user changes inputs — unlimited iteration before committing
  - [ ] Clear "Level 3: Custom workflow" label in UI
  - [ ] "Render clip" CTA only triggers workflow when user is satisfied with preview
- [ ] **Define composition props contract**
  - [ ] `playbackId`, timing, caption source (VTT/track), optional dubbed audio override, branding preset
  - [ ] Same props power both preview (client) and render (server)
  - [ ] Persist the exact props JSON on the `Clip` record (for re-render/audit)

### 7) Level 3: Custom workflow (full orchestration)

- [ ] **`POST /api/clips/create`**
  - [ ] Creates `Clip` record as `queued`
  - [ ] Starts `createClipWorkflow` which orchestrates:
    - Step 1: `translateCaptions` for each target language
    - Step 2: `translateAudio` for each target language
    - Step 3: Remotion render
    - Step 4: Upload to storage
    - Step 5: Finalize `Clip` record
- [ ] **`GET /api/media/[id]/clips`**
  - [ ] Returns clip list with per-step status + artifact URLs
- [ ] **UI: clip status**
  - [ ] Shows which step is running: "Translating captions..." → "Dubbing audio..." → "Rendering..." → "Ready"
  - [ ] Shows poster + download link when ready

### 8) Polish & showcase readiness

- [ ] **Index page uses AI-enriched metadata**
  - [ ] Use generated title/tags when present; graceful fallback otherwise
- [ ] **Three-level framing is explicit in UI**
  - [ ] Level 1: Sync call (summary/tags)
  - [ ] Level 2: Basic workflow (captions, dubbing)
  - [ ] Level 3: Custom workflow (rendered clips)
- [ ] **Seed content strategy**
  - [ ] Ensure staging account has 6–12 talks and at least one good baseline caption track
  - [ ] Pre-run Level 1 on all talks for instant index
  - [ ] Pre-run Level 2 on select talks (1–2 translated captions, 1 dubbed audio)
  - [ ] Pre-run Level 3 on 2–3 clips for instant "wow"
