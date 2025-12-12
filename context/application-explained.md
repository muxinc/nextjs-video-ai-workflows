# Try vercel workflows with @mux/ai

## Goal

This app demonstrates the real-world value of a small set of the `@mux/ai` SDK workflows in a single, concrete Next.js application, using a **staging Mux account** populated with demo content (e.g. **Demuxed talks**). It makes it obvious how these workflows improve:

- discovery & preview (summarization)
- accessibility & reach (caption translation, audio dubbing)
- distribution (turn a long talk into short, accessible social clips)

The core idea: **pick a talk → see the underlying Mux asset → apply workflows → publish more accessible derivatives**.

---

## What is `@mux/ai` (in this demo)?

`@mux/ai` is an SDK for building **video intelligence on top of Mux Video**.

In “Demuxed Library”, every talk is a real Mux **asset** (with a **playback ID**) and this app uses `@mux/ai` workflows over Mux primitives—like **storyboards/thumbnails** and **transcripts/text tracks (VTT captions)**—to do two important things:

- **Generate insights** from the media (structured summary metadata like `title`, `description`, `tags`).
- **Apply outputs back onto the underlying Mux asset** (attach **translated caption tracks** and **dubbed audio tracks**) so the player can immediately switch languages like a real product.

In short: this demo shows `@mux/ai` as the bridge between Mux media and AI providers, turning raw talks into experiences that are **searchable, localizable, and more accessible**.

---

## Workflows to highlight (as implemented in `app/workflows/`)

This demo explicitly showcases what the SDK can do today:

- **Summarization** (`getSummaryAndTags(assetId, options)`)
  - Inputs: storyboard frames/thumbnails + (optionally) transcript/text track
  - Outputs: `title`, `description`, `tags`, `storyboardUrl`, optional token usage
- **Caption translation** (`translateCaptions(assetId, from, to, options)`)
  - Inputs: existing text track VTT
  - Outputs: translated VTT, optional upload to S3 + attach as new Mux text track
- **Audio translation / dubbing** (`translateAudio(assetId, toLanguageCode, options)`)
  - Inputs: audio-only static rendition (`audio.m4a`) of the asset
  - Outputs: dubbed audio file uploaded + attached to the asset as a new Mux audio track

> Note: other workflows exist in this SDK, but this demo’s IA is intentionally designed around the three above.

---

## The demo product: “Demuxed Library” (IA-first)

### Experience overview

- **Landing page**: a simple pitch + “try it” CTA.
- **Talks index**: grid/list of Demuxed talks (title, speakers, year, thumbnail).
- **Talk detail page**: video player + “Accessibility & localization” controls + “Generated metadata”.
- **Create social clip page** (per talk): configure a short clip and render an accessible social asset.

The detail page is where value becomes visceral: show the video, then show what the SDK can _derive_ (summary) and _apply_ (tracks on the asset).

---

## IA: key screens and what they teach the user

Each talk is backed by a Mux `assetId` (and one `playbackId`). The app navigation funnels users from “browse” → “understand value” → “produce a shareable output”.

### 1) Talks index (`/talks`)

Primary goal: help users pick a talk fast and preview what the SDK adds.

Recommended card layout:

- talk title/speaker/year thumbnail
- **AI summary title** (or fallback to original title)
- **3–5 tags** from summarization
- CTA: **View talk** and **Create social clip**

### 2) Talk detail (`/talks/[slug]`)

Primary goal: show “applied workflows” on the underlying asset.

#### Video player + “Applied tracks” controls (caption + audio)

Use a Mux player in the UI and expose:

- **Caption selector**
  - Original captions (e.g. `en`)
  - Translated captions (e.g. `es`, `fr`) created by `translateCaptions`
- **Audio track selector**
  - Original audio
  - Dubbed audio track(s) created by `translateAudio`

This demonstrates _applied_ changes to the underlying asset (not just a JSON response).

#### “Metadata generated” (Summarization)

Show:

- Generated title, description
- Tag chips
- “How it was produced” disclosure: storyboard preview image + (optionally) transcript excerpt

Optional delight:

- A toggle for tone presets (normal/professional/sassy) to show prompt control.

#### “Localization quick actions”

Keep this section action-oriented so the IA encourages users to _apply_ the workflows:

- “Add Spanish captions” (runs `translateCaptions`)
- “Add French captions”
- “Dub to Spanish” (runs `translateAudio`)
- “Dub to French”

Persist the resulting track IDs and rehydrate them into the player controls.

### 3) Create social clip (`/talks/[slug]/clips/new`)

Primary goal: demonstrate a **custom workflow** built from the highlighted primitives.

This screen feels like a “recipe builder” with sensible defaults:

- clip start/end (or start + duration)
- target languages (captions + dubbing)
- format preset (1:1, 9:16, 16:9)
- style preset (captions on/off, speaker layout, waveform/audiogram style, brand colors)

Output: a playable preview + a downloadable share asset.

---

## The custom workflow to showcase: Accessible generative social clips

### Value prop

Turn one long-form talk into **short social clips that are accessible to a wider audience**:

- captions in multiple languages
- dubbed audio in multiple languages
- an on-brand, shareable visual (audiogram / visual podcast clip)

### Pipeline (opinionated)

Inputs:

- `assetId`
- clip boundaries (start/end)
- source caption language (e.g. `en`)
- target languages (e.g. `es`, `fr`)

Steps:

1. **Summarize the talk** to suggest 3–5 clip ideas (titles + “why it matters”) using `getSummaryAndTags` as context for UI suggestions.
2. **Ensure captions exist** (use the existing ready text track as the source VTT for translations).
3. **Translate captions** for selected targets using `translateCaptions`.
4. **Dub audio** for selected targets using `translateAudio`.
5. **Render** a share asset with Remotion:
   - Visual audiogram (waveform + speaker name + talk title)
   - On-video captions rendered from VTT (choose original or translated)
   - Optional “dual-language” mode (top: original, bottom: translated)
6. **Publish / export**:
   - store rendered mp4 (and poster) in an object store
   - optionally ingest back into Mux as a new asset for hosting

### IA implications

This workflow wants a dedicated surface area because it’s a multi-step, multi-output process:

- a **clip creation wizard** (single flow)
- a **clip library** (per talk) showing generated clips + language variants
- status UI (queued → rendering → ready) to make the system feel real

---

## “Applied vs generated”: how to frame value (for this narrower scope)

The page explicitly labels outputs:

- **Generated insights**: summaries, tags, clip suggestions
- **Applied changes**: new caption tracks, new audio tracks, and rendered share assets

That framing communicates why this SDK matters: it’s not just AI responses—it’s **AI connected to video assets**.

---

## Implementation notes

The Next.js routes/actions/data-model outline for this app lives in `context/implementation-explained.md`.

---

## Demo content strategy (staging Mux)

Seed the staging account with a small curated set:

- 6–12 Demuxed talks spanning:
  - clean speaker-on-stage content
  - talks with slides (good for storyboard + summary)

For localization:

- Ensure at least one talk has a good baseline caption track (English)
- Pre-generate 1–2 translated caption tracks and 1 dubbed audio track for the “wow” factor
- Pre-render 2–3 clips (9:16) so the “Clips” section looks alive on first load

---

## What makes this a strong showcase

- It’s **real assets** in a real player, not just logs.
- It demonstrates both:
  - **analysis** (summary/tags/clip suggestions) and
  - **asset augmentation** (tracks added back to Mux) plus
  - **derivative creation** (rendered social assets).
- The UI ties workflows directly to user-facing product value:
  - better discovery, better accessibility, more shareable distribution.
