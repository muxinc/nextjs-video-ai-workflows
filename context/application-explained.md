# @mux/ai + Vercel Workflows: Video AI infrastructure that scales

## Goal

This app demonstrates how to combine **`@mux/ai`** with **Vercel Workflows** to ship video intelligence that holds up at scale.

Using content hosted in your **Mux account**, we show a clear progression of integration patterns—from calling primitives directly to composing multi-step pipelines with external tools—so developers can see exactly how to architect their own video-AI features.

The core idea: **understand the building blocks, then compose them into reliable, observable pipelines**.

---

## What this demo teaches

This isn't just a feature showcase—it's a **reference architecture** for video intelligence. The app explicitly demonstrates three integration layers:

| Layer             | Pattern                                              | Example                                           | When to use                              |
| ----------------- | ---------------------------------------------------- | ------------------------------------------------- | ---------------------------------------- |
| **1. Primitives** | Call primitives directly                             | `getSummaryAndTags()`                             | Instant results, simple request/response |
| **2. Workflows**  | Run `@mux/ai` workflows durably via Vercel Workflows | `translateCaptions`, `translateAudio`             | Long-running ops, needs retry/resume     |
| **3. Connectors** | Compose primitives + workflows with external tools   | Clip creation (translate + dub + Remotion render) | Complex pipelines, multiple dependencies |

By walking through these layers, developers learn not just _what_ `@mux/ai` can do, but _how_ to integrate it properly into real applications.

---

## What is `@mux/ai`?

`@mux/ai` is an SDK for building **video intelligence on top of Mux Video**.

In "Demuxed Library", every talk is a real Mux **asset** (with a **playback ID**) and this app uses `@mux/ai` workflows over Mux primitives—like **storyboards/thumbnails** and **transcripts/text tracks (VTT captions)**—to do two important things:

- **Generate insights** from the media (structured summary metadata like `title`, `description`, `tags`).
- **Apply outputs back onto the underlying Mux asset** (attach **translated caption tracks** and **dubbed audio tracks**) so the player can immediately switch languages like a real product.

In short: this demo shows `@mux/ai` as the bridge between Mux media and AI providers, turning raw talks into experiences that are **searchable, localizable, and more accessible**.

---

## The three integration layers (IA-first)

This demo's information architecture is structured around these three layers. Each layer has dedicated UI surfaces that make the pattern obvious.

### Layer 1: Primitives (`getSummaryAndTags`)

The simplest integration: call a primitive directly, get a result.

- **What it does**: Extracts `title`, `description`, and `tags` from storyboard frames + transcript
- **When it runs**: Inline in a server action or route handler—user sees results immediately
- **UI surface**: The "Generate summary" action on the detail page; results appear instantly

This is the "hello world" of `@mux/ai`—no workflow infrastructure needed, just a function call.

### Layer 2: Workflows (`translateCaptions`, `translateAudio`)

When operations take longer or need retry/resume semantics, run `@mux/ai` workflows durably via Vercel Workflows.

- **What it does**: Translates captions or dubs audio into a target language
- **When it runs**: Triggered by user action, executes in background, UI polls for status (and can be refreshed/reloaded)
- **UI surface**: "Add Spanish captions" / "Dub to French" buttons with inline status callouts

This teaches the pattern: **one workflow → durable execution → status UI**.

**Resumable UX:** start a workflow, then refresh the page (or navigate away and back) and you should still see it running asynchronously. In-flight status is rehydrated from browser `localStorage`.

### Layer 3: Connectors (Accessible social clips)

The payoff: compose multiple `@mux/ai` primitives and workflows with external tools (Remotion) in a single orchestrated pipeline.

- **What it does**: Creates a shareable social clip with translated captions, dubbed audio, and branded visuals
- **When it runs**: Multi-step workflow: ensure captions → translate → dub → render → upload
- **UI surface**: The `/media/[slug]/clips/new` page with preview + "Render clip" action

This is where Vercel Workflows shine—managing dependencies, retries, and state across a complex pipeline.

---

## Primitives from `@mux/ai/workflows`

This demo uses three workflow primitives exported by `@mux/ai/workflows`:

- **`getSummaryAndTags(assetId, options)`** — Summarization
  - Inputs: storyboard frames/thumbnails + (optionally) transcript/text track
  - Outputs: `title`, `description`, `tags`, `storyboardUrl`, optional token usage
- **`translateCaptions(assetId, from, to, options)`** — Caption translation
  - Inputs: existing text track VTT
  - Outputs: translated VTT, optional upload to S3 + attach as new Mux text track
- **`translateAudio(assetId, toLanguageCode, options)`** — Audio dubbing
  - Inputs: audio-only static rendition (`audio.m4a`) of the asset
  - Outputs: dubbed audio file uploaded + attached to the asset as a new Mux audio track

> Note: other primitives exist in the SDK, but this demo's IA is intentionally focused on these three to illustrate the sync → async → custom progression.

---

## The demo product: "Demuxed Library"

### Experience overview

- **Landing page**: pitch the "three layers" of integration + "try it" CTA.
- **Talks index**: grid/list of Demuxed talks (title, speakers, year, thumbnail).
- **Talk detail page**: video player + workflow actions organized by integration layer.
- **Create social clip page** (per talk): the connectors showcase.

The app navigation funnels users through the layers: **browse → call primitives → run workflows → compose with connectors**.

---

## IA: key screens and what they teach

Each talk is backed by a Mux `assetId` (and one `playbackId`). The screens are designed to make the integration patterns obvious.

### 1) Talks index (`/media`)

**Primary goal**: help users pick a talk fast and preview what Layer 1 (primitives) adds.

Recommended card layout:

- talk title/speaker/year thumbnail
- **AI summary title** (or fallback to original title) — output of `getSummaryAndTags`
- **3–5 tags** from summarization
- CTA: **View talk**

### 2) Talk detail (`/media/[slug]`)

**Primary goal**: show all three integration layers on a single asset.

The page is organized into clear sections that map to the layers:

#### Section A: Video player + applied tracks

Use a Mux player and expose track selectors:

- **Caption selector**: Original (en) + translated captions added by Layer 2 workflows
- **Audio selector**: Original audio + dubbed tracks added by Layer 2 workflows

This demonstrates _applied_ changes to the underlying Mux asset.

#### Section B: Layer 1 — Primitives

Show the output of `getSummaryAndTags`:

- Generated title, description
- Tag chips
- "How it was produced" disclosure: storyboard preview + transcript excerpt

Label this clearly: **"Primitives → instant result"**

#### Section C: Layer 2 — Workflows

Action buttons for durable workflow execution:

- "Add Spanish captions" → runs `translateCaptions` via Vercel Workflow
- "Add French captions"
- "Dub to Spanish" → runs `translateAudio` via Vercel Workflow
- "Dub to French"

Each button shows inline status: Queued → Running → Ready

Label this clearly: **"Workflows → durable execution + result"**

#### Section D: Layer 3 — Connectors

CTA: **"Create social clip"** → navigates to the clip creation page

This previews what the composed pipeline produces and links to the full experience.

### 3) Create social clip (`/media/[slug]/clips/new`)

**Primary goal**: demonstrate **Layer 3 (connectors)**—orchestrating multiple primitives, workflows, and external tools.

This is the "recipe builder" for the composed pipeline:

- clip start/end (or start + duration)
- target languages (captions + dubbing)
- format preset (1:1, 9:16, 16:9)
- style preset (captions on/off, speaker layout, waveform/audiogram style, brand colors)

#### Preview-first: iterate before rendering

The page uses a **client-side Remotion Player** to show an instant, interactive preview. This is "free" in the sense that:

- No server-side rendering is triggered
- No assets are created prematurely
- Users can tweak timing, styling, language, and layout as many times as they want
- The preview updates live as inputs change

Only when the user is satisfied do they click **"Render clip"**, which triggers the full Layer 3 orchestration workflow.

The page shows:

- **Live Remotion preview** (updates as inputs change) — always visible, no cost
- **"Render clip" CTA** that triggers the full orchestration workflow — only when ready
- **Status panel** showing each step: translating captions → dubbing audio → rendering video → uploading

Output: a playable preview + a downloadable share asset.

---

## Layer 3 deep dive: Composing with connectors

The connectors layer is where `@mux/ai` + Vercel Workflows really shine. It's a **multi-step pipeline** that combines:

- Multiple `@mux/ai` primitives (`translateCaptions`, `translateAudio`)
- External tools (Remotion for video rendering)
- State management across dependent steps
- Retry/resume semantics for reliability

### Preview vs render: two distinct phases

Layer 3 has two phases with very different characteristics:

| Phase       | Where it runs                 | Cost              | Purpose                            |
| ----------- | ----------------------------- | ----------------- | ---------------------------------- |
| **Preview** | Client-side (Remotion Player) | Free              | Iterate on timing, style, language |
| **Render**  | Server-side (Vercel Workflow) | Compute + storage | Produce final MP4 artifact         |

The preview phase is instant and unlimited—users can change the clip boundaries, toggle captions, switch languages, adjust branding, and see the result immediately without triggering any backend work. Only when they're satisfied do they commit to the render phase, which runs the full orchestration workflow.

### What it produces

Turn one long-form talk into **short social clips that are accessible to a wider audience**:

- captions in multiple languages
- dubbed audio in multiple languages
- an on-brand, shareable visual (audiogram / visual podcast clip)

### Pipeline architecture

**Inputs** (from the clip creation UI):

- `assetId`
- clip boundaries (start/end)
- source caption language (e.g. `en`)
- target languages (e.g. `es`, `fr`)
- format preset (9:16, 1:1, 16:9)

**Orchestration steps** (managed by Vercel Workflow):

1. **Validate prerequisites** — ensure the asset has a ready English caption track
2. **Translate captions** — call `translateCaptions` for each target language (parallel where possible)
3. **Dub audio** — call `translateAudio` for each target language (parallel where possible)
4. **Render with Remotion** — produce the visual clip with:
   - Video segment from the Mux asset
   - On-video captions (original or translated)
   - Optional dubbed audio track
   - Branding (waveform, speaker name, title card)
5. **Upload artifacts** — store rendered MP4 + poster to object storage
6. **Finalize** — update the `Clip` record with URLs, mark status `ready`

Each step is a `"use step"` function in the Vercel Workflow, so failures are isolated and retryable.

### Why Remotion is in the connectors layer (not earlier)

Remotion is **not** part of `@mux/ai`—it's an external tool we're integrating. This is intentional:

- Layer 1 and 2 show what `@mux/ai` provides out of the box
- Layer 3 shows how to **compose** `@mux/ai` primitives with other tools
- The connectors layer demonstrates the full power of `@mux/ai` combined with Vercel Workflows for orchestration

This makes the demo's teaching clear: "Here's what the SDK gives you; here's how you build on top of it."

### IA implications

This workflow needs dedicated surface area:

- a **clip creation wizard** (`/media/[slug]/clips/new`)
- a **clip library** (per talk) showing generated clips + language variants
- status UI (queued → translating → dubbing → rendering → ready) to make the pipeline visible

---

## How to frame outputs in the UI

The page explicitly labels outputs by what they represent:

- **Generated insights** (Layer 1 — Primitives): summaries, tags, clip suggestions — instant, synchronous
- **Applied changes** (Layer 2 — Workflows): new caption tracks, new audio tracks — durable, observable
- **Composed artifacts** (Layer 3 — Connectors): rendered social clips with translations + branding — orchestrated, multi-step

This framing communicates the key insight: `@mux/ai` isn't just AI responses—it's **AI connected to video assets**, and Vercel Workflows lets you build reliable, observable pipelines on top.

---

## Persistence approach (Postgres + Mux)

While Mux remains the source of truth for video assets and tracks, this demo uses **Postgres (with pgvector)** as a persisted layer for asset metadata and embeddings.

### What gets persisted where

| Data                            | Where                | Why                                                                             |
| ------------------------------- | -------------------- | ------------------------------------------------------------------------------- |
| **Asset metadata + embeddings** | Postgres             | Enables fast list/detail views + semantic search without re-fetching everything |
| **Translated caption tracks**   | Mux asset            | `translateCaptions` with `uploadToMux: true` attaches the track directly        |
| **Dubbed audio tracks**         | Mux asset            | `translateAudio` with `uploadToMux: true` attaches the track directly           |
| **Rendered clips**              | S3 storage           | Layer 3 workflow uploads MP4 + poster to configured S3 bucket                   |
| **Workflow progress**           | Browser localStorage | Client tracks in-flight workflows for UI status display                         |

### Why this works

- **Mux is the source of truth**: The asset's `tracks` array already contains all the information needed to populate caption/audio selectors in the player.
- **Postgres offloads Mux API**: Asset metadata can be persisted to reduce repeated Mux API calls and improve response times.
- **No sync issues**: Since tracks are attached to the asset, there's no risk of our database getting out of sync with Mux.
- **localStorage is sufficient for progress**: Workflow status only needs to survive page refreshes within a single browser session. Cross-device sync isn't needed for a demo.

### Tradeoffs

- Workflow progress is browser-local (won't sync across devices/tabs)
- No server-side audit log of workflow runs
- Cached metadata may become stale; implement TTL or webhook-based invalidation for production

---

## Implementation notes

The Next.js routes/actions/data-model outline for this app lives in `context/implementation-explained.md`.

---

## Demo content strategy (staging Mux)

Seed the staging account with a small curated set:

- 6–12 Demuxed talks spanning:
  - clean speaker-on-stage content
  - talks with slides (good for storyboard + summary)
  - all with ready English caption tracks (required for translation workflows)

For each integration layer:

- **Layer 1 (Primitives)**: No pre-seeding needed — `getSummaryAndTags` runs synchronously on demand
- **Layer 2 (Workflows)**: Pre-generate 1–2 translated caption tracks and 1 dubbed audio track on select talks (so the player track selectors show language options on first load)
- **Layer 3 (Connectors)**: Optionally pre-render 1–2 clips so the composed workflow result is visible immediately

---

## What makes this a strong showcase

- It's **real assets** in a real player, not just logs or JSON responses.
- It teaches a **clear progression**: primitives → workflows → connectors.
- It demonstrates the **full integration pattern**:
  - `@mux/ai` for video intelligence primitives
  - Vercel Workflows for reliable, observable execution
  - Remotion for video rendering (showing how to extend beyond the SDK)
- The UI ties workflows directly to user-facing product value:
  - better discovery (summarization)
  - better accessibility (captions, dubbing)
  - more shareable distribution (social clips)
