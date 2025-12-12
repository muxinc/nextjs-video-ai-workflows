# Implementation explained

This document captures the Next.js implementation outline that supports the “Demuxed Library” demo described in `context/application-explained.md`.

---

## Workflow execution model (sync vs async)

This app uses `@mux/ai/workflows` in two different ways, depending on whether the user needs an immediate response.

### 1) One direct, synchronous invocation: `getSummaryAndTags`

`getSummaryAndTags` is called **synchronously** from server-side Next.js code (route handler or server action) to support “instant” UI surfaces:

- Showing an AI-derived title/description/tags on the media index and detail pages
- Providing lightweight “clip idea” suggestions without making the user wait on a background job

The key behavior: **request in → summary JSON out**. We still persist the output (so subsequent page loads are fast), but the invocation itself happens inline so the user can see results immediately.

### 2) Everything else from `@mux/ai/workflows`: async via Vercel Workflow (“use workflow” / “use step”)

All other `@mux/ai/workflows` usage (e.g. caption translation, audio dubbing, clip creation orchestration) runs **asynchronously** and is managed as resumable background work using Vercel Workflow:

- Workflow entrypoints live under `workflows/*` and use the `"use workflow"` directive
- Side-effecting units (Mux API calls, S3 uploads, attaching tracks, renders) are isolated into `"use step"` functions so they can be queued/retried safely
- UI triggers a workflow and immediately returns; the UI shows a status callout (“Queued / Running / Ready”) while results are persisted and rehydrated

Implementation notes for this setup follow the Next.js guide from Vercel Workflow: [Next.js getting started](https://useworkflow.dev/docs/getting-started/next).

Practical expectations:

- The `/api/workflows/run` and `/api/clips/create` endpoints **start** workflows rather than performing the full work inline.
- The app persists workflow runs (`WorkflowRun`) and surfaces them in the UI as progress + final outputs (track IDs, URLs, metadata).

## Workflows relied on from `@mux/ai`

Per `context/application-explained.md`, this demo is intentionally designed around three workflow primitives exported by `@mux/ai/workflows` (see `ai/src/workflows/index.ts`). We import them into Next.js server code and wire them into either synchronous route handlers or Vercel Workflow entrypoints.

### `getSummaryAndTags` (summarization)

- **Purpose**: extract a title, description, and up to 10 keywords from storyboard + transcript.
- **When**: on first view / ingestion to enrich `Media` and give the UI instant metadata + clip idea context.
- **How**: synchronous call in a server action or route handler, then persist the result to `Media` (and optionally a `WorkflowRun` record for auditing).

### `translateCaptions` (caption translation)

- **Purpose**: translate a ready Mux text track (`.vtt`) from `sourceLang` to one or more `targetLangs`.
- **When**: on talk detail “Add {lang} captions” actions and within `POST /api/clips/create`.
- **How**: async workflow step; by default uploads the translated VTT back to Mux as a new text track (requires S3 creds) and returns track ID + VTT. Persist IDs into `Clip.captionTrackIdsByLang` and rehydrate into the player’s caption selector.

### `translateAudio` (audio dubbing)

- **Purpose**: dub the default audio track into a target language.
- **When**: on talk detail “Dub to {lang}” actions and optionally within `POST /api/clips/create`.
- **How**: async workflow step; uses ElevenLabs and, when `uploadToMux` is true, uploads the resulting audio to Mux as an audio track (requires S3 creds). Persist IDs into `Clip.audioTrackIdsByLang` and rehydrate into the player’s audio selector.

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

We’ll create a small wrapper module (e.g. `app/lib/mux.ts`) that initializes the SDK once:

- Build a `Mux` client from `@mux/mux-node` with `tokenId = process.env.MUX_TOKEN_ID` and `tokenSecret = process.env.MUX_TOKEN_SECRET`.
- Export helpers for the handful of read paths we need (assets, storyboard, transcript).

This keeps credential access centralized and avoids re-implementing error handling in every route.

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

## Remotion preview + render pipeline (audiogram / visual clips)

This app uses Remotion in two modes:

1. **Preview**: an instant, interactive preview in the browser using `@remotion/player`.
2. **Render**: a server-side render to MP4 (+ poster) that produces a shareable artifact.

The approach is modeled after the Remotion “Next.js App Dir template”: [`remotion-dev/template-next-app-dir`](https://github.com/remotion-dev/template-next-app-dir).

### Composition model

We define one (or a small set of) Remotion compositions representing our clip formats. Each composition is driven entirely by **typed input props** so it can be previewed and rendered deterministically:

- **Timing**: `startTime`, `endTime` (or `duration`)
- **Media**: `playbackId` (or signed URL), plus optional audio override URL for dubbing
- **Captions**: VTT URL (original or translated) + rendering mode (single/dual language)
- **Branding**: palette tokens, type scale, layout preset (9:16 / 1:1 / 16:9)
- **Metadata**: talk title, speaker, etc. for lower thirds / title cards

### Preview (in-app)

The “Create clip” page renders a Remotion Player that is powered by the same props we will later pass to the server render:

- The page assembles the full props object from user inputs + persisted workflow outputs (track IDs, VTT URLs, dubbed audio URLs).
- The Player updates live as props change, so users can iterate quickly (captions on/off, layout preset, language variant, etc.).

Important: preview is **non-blocking** and does not require any render infrastructure—it’s just React running the composition in the browser.

### Rendering (server-side)

Rendering is treated as **async work** (and fits naturally into the Vercel Workflow approach described above):

- A “Render clip” action starts a workflow that:
  1. Ensures prerequisites exist (captions/dub assets as needed)
  2. Triggers a Remotion render to MP4
  3. Uploads the resulting MP4 (+ poster) to storage
  4. Persists URLs onto the `Clip` record and marks status `ready`

This keeps the UI responsive and allows retries on transient render failures.

### Dev vs prod rendering strategy

Following the template’s split, we can support:

- **Local renders in development** (fast iteration): run renders on the same machine/process as the dev server.
- **Render at scale in production** (optional): use Remotion Lambda (as provided by the template) when we need reliable throughput and predictable runtime constraints.

The UI and data model stay the same either way; only the render backend changes.

### Where it fits in our routes + data model

- `POST /api/clips/create`
  - Starts the orchestration workflow (translate captions + dub audio + render)
  - Immediately returns a `clipId` (and initial status)
- `GET /api/media/[id]/clips`
  - Returns clips with `status`, `renderedUrl`, `posterUrl` so the UI can show progress and final assets

On the `Clip` model, we persist:

- `status` (`queued` → `rendering` → `ready` / `failed`)
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

This is an implementation-first ordering that makes the app usable early (browse + detail), then layers in “generated insights” (sync summarization), then “applied changes” (async tracks), then the clip pipeline (Remotion + orchestration).

### 0) Project & env foundation

- [ ] **Confirm env vars are wired for server-only use**
  - [x] `MUX_TOKEN_ID`, `MUX_TOKEN_SECRET` available in local + deploy runtime
  - [x] Any workflow provider creds needed by `translateCaptions` / `translateAudio` (e.g. S3 creds, ElevenLabs) are present server-side only
- [ ] **Create a single Mux client module**
  - [ ] Add `app/lib/mux.ts` wrapper that exports the minimal read helpers we need (assets list/retrieve, storyboard meta/vtt, track vtt/transcript)

### 1) Data persistence (minimal, but real)

- [ ] **Pick persistence mechanism (and implement it)**
  - [ ] `Media`, `WorkflowRun`, `Clip` tables/collections with fields described above
  - [ ] Simple “upsert” helpers: `upsertMediaFromMuxAsset`, `saveWorkflowRun`, `createClip`, `updateClipStatus`
- [ ] **Define status enums consistently**
  - [ ] `WorkflowRun.status`: `queued | running | completed | failed`
  - [ ] `Clip.status`: `queued | rendering | ready | failed`

### 2) Read-only app surfaces (browse + detail)

- [ ] **`GET /api/media`**
  - [ ] Returns a list of `Media` (hydrated from persisted records, with a refresh path from Mux as needed)
- [ ] **`GET /api/media/[id]`**
  - [ ] Returns one `Media` + any persisted `WorkflowRun` outputs needed for the page
- [ ] **UI: `/media` index**
  - [ ] Grid/list of talks populated from `GET /api/media`
- [ ] **UI: `/media/[slug]` detail**
  - [ ] Player using the `muxPlaybackId`
  - [ ] “Applied tracks” section (even if empty initially) + “How it was made” disclosure placeholder

### 3) Sync insight: summarization (`getSummaryAndTags`)

- [ ] **Implement “Generate summary” path**
  - [ ] Server handler (route or server action) calls `getSummaryAndTags(assetId, options)` synchronously
  - [ ] Persist result onto `Media` (and optionally a `WorkflowRun` record for auditability)
- [ ] **Detail page rehydrates summary + tags**
  - [ ] Generated title/description block
  - [ ] Tag chips (used on index once available)
- [ ] **Optional: cache storyboard/transcript artifacts**
  - [ ] Persist storyboard JSON/VTT and transcript excerpt (or pointers) for the “How it was made” disclosure

### 4) Async workflow infra (Vercel Workflow) + status UX

- [ ] **Wire Vercel Workflow in Next.js**
  - [ ] Ensure workflow entrypoints exist under `workflows/*` using `"use workflow"`
  - [ ] Ensure side-effect steps live in `"use step"` functions (Mux calls, uploads, track attaches)
- [ ] **`POST /api/workflows/run`**
  - [ ] Starts a workflow run (returns run id + initial status)
  - [ ] Persists `WorkflowRun` as `queued` and updates as it progresses
- [ ] **UI status callouts**
  - [ ] For each action button: show `Queued / Running / Ready / Failed` inline (no global toasts)

### 5) Applied changes: captions + dubbing (tracks attached back to Mux)

- [ ] **Caption translation flow**
  - [ ] Identify the canonical source text track for an asset (the “ready” English captions)
  - [ ] Async run `translateCaptions` for selected target languages
  - [ ] Persist returned track IDs into `Media` (or `Clip` when invoked from clip creation)
  - [ ] Rehydrate into the player caption selector
- [ ] **Audio dubbing flow**
  - [ ] Async run `translateAudio` for selected target languages
  - [ ] Persist returned audio track IDs
  - [ ] Rehydrate into the player audio selector

### 6) Clip creation: preview-first (Remotion Player)

- [ ] **Create `/media/[slug]/clips/new` UI**
  - [ ] Inputs: start/end, preset (9:16/1:1/16:9), caption lang, audio lang
  - [ ] Always-on Remotion preview using typed composition props
- [ ] **Define composition props contract**
  - [ ] `playbackId`, timing, caption source (VTT/track), optional dubbed audio override, branding preset
  - [ ] Persist the exact props JSON on the `Clip` record (for re-render/audit)

### 7) Clip pipeline: orchestration workflow + render artifacts

- [ ] **`POST /api/clips/create`**
  - [ ] Creates `Clip` record as `queued` and starts orchestration workflow
  - [ ] Workflow ensures prerequisites (captions/dub) exist, then renders MP4, uploads MP4+poster, marks `ready`
- [ ] **`GET /api/media/[id]/clips`**
  - [ ] Returns clip list with status + artifact URLs for UI progress + playback
- [ ] **UI: clip detail**
  - [ ] Shows status while running; shows poster + download link when ready

### 8) Polish & showcase readiness

- [ ] **Index page uses AI-enriched metadata**
  - [ ] Use generated title/tags when present; graceful fallback otherwise
- [ ] **“Applied vs generated” framing is explicit in UI copy**
  - [ ] Generated: summary/tags
  - [ ] Applied: tracks + rendered clips
- [ ] **Seed content strategy**
  - [ ] Ensure staging account has 6–12 talks and at least one good baseline caption track
  - [ ] Pre-generate a couple translated captions/dubs/clips for instant “wow”
