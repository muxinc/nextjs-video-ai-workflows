# Design explained

This document describes the intended look-and-feel of the “Demuxed Library” app.

The visual reference is a **minimal, high-contrast, slightly brutalist** UI: lots of whitespace, thick black rules, sharp corners, and simple blocks that feel fast and honest.

---

## Overall vibe

- **Editorial + utilitarian**: it should feel like a small, opinionated media library—not a dashboard.
- **Calm canvas, loud controls**: the background stays soft and neutral; interactive elements are bold and clearly outlined.
- **Deliberate restraint**: few colors, minimal decoration, and only one “primary” action per surface.
- **Show the value fast**: every page should make it obvious what `@mux/ai` adds (summary, captions, dubbing, clip creation) without visual clutter.

---

## Layout principles

- **Center the experience**: content lives in a centered column with generous top whitespace.
- **Big hero controls**: primary CTAs and “run workflow” actions are oversized and easy to spot.
- **Clear sections**: use spacing + rules (thin or thick) to separate sections rather than cards-within-cards.
- **Progressive disclosure**: show the “happy path” first; tuck raw inputs/outputs behind small “Details” affordances so the app never feels overwhelming.
- **Responsive by default**:
  - On small screens, stack sections vertically (player → actions → outputs).
  - On larger screens, use a two-column layout where it helps comprehension (e.g. detail page: player + actions on left, outputs on right).

Suggested structure:
- Header: logotype/title + small subtitle
- Primary action row (browse / try workflows)
- Secondary actions (optional chips, but keep minimal)
- Results / content
- Footer band with “Built with”

---

## Typography

- **All-caps display for branding**: wide tracking for the top-level brand wordmark; smaller all-caps subtitle.
- **Simple sans-serif for UI text**: clean, readable, neutral.
- **Hierarchy by size and weight**:
  - Large page titles (sparse, confident)
  - Medium section headings (all-caps optional)
  - Regular body copy and labels

Guidance:
- Avoid overly rounded, “friendly” type.
- Prefer crisp text, neutral tone.

---

## Color system

- **Background**: warm light neutral (paper-like beige/gray).
- **Ink**: near-black for text and borders.
- **Surface**: white panels for inputs and chips.
- **Accent**: a single saturated highlight (e.g. thin green rule) used sparingly for separators or status.

Rules:
- Don’t introduce multiple accent colors.
- Use color to communicate state, but keep it subtle (most of the UI is monochrome).

---

## Shape, borders, and shadows

- **Sharp corners**: no rounding (or extremely minimal rounding only where required).
- **Thick borders**: primary controls use heavy black strokes.
- **Hard shadows**: offset drop shadows that feel “printed” (e.g. a crisp 1–2 step shadow), not soft material shadows.

This is a key part of the aesthetic: it should feel like layered paper/blocks.

---

## Core components

### Primary CTA button (hero)

- Large button with **thick black border** (or solid black fill with white text).
- Single short label (e.g. “Browse talks”, “Generate summary”, “Add Spanish captions”).
- Optional one-line helper text below the button, not inside it.

Interactions:
- Hover: slightly increase contrast (or deepen shadow).
- Focus: unmistakable focus ring (outer outline or accent rule) without changing the core shape.

### Workflow action row

- A small set (2–4) of clearly-labeled, single-purpose buttons.
- Prefer verbs + target: “Generate summary”, “Add captions”, “Dub audio”, “Create clip”.
- When an action is unavailable (missing track, not ready), show a short reason and the next step (“No captions found → generate captions first” / “Asset processing → try again soon”).

### Suggestion chips

- White chips with thick black borders.
- Light hard shadow.
- Text is short and direct.

Interactions:
- Hover: invert (black background / white text) **or** add a heavier shadow.
- Active/selected: filled (black) with reversed text.

### Status / progress callouts (async work)

- A bordered, white panel that reads like a “system message”.
- Left-aligned spinner + short status string.
- Keep copy functional and specific (e.g. “Extracting clips (10 remaining)…”).

Rules:
- No full-screen loaders unless absolutely necessary.
- Prefer inline progress in-context with the action that started it.
- Always show the “what will happen next” line when possible (e.g. “When ready, captions will appear in the player selector.”).

### Disclosure panel (“How it was made”)

- A collapsible bordered panel with a short summary line and optional detail content.
- Used to keep the default UI clean while still showing credibility and inputs:
  - storyboard preview (or a representative frame)
  - transcript preview snippet (from VTT / transcript)
  - small labels: “Inputs used”, “Generated output”

### Footer band (“Built with”)

- Dark band across the bottom with subdued text.
- A thin accent rule at the top edge.
- Simple “Built with” line + logos.

---

## Page-level guidance (mapping to this app)

The goal across pages: **show off the workflows** with a sleek UI. We are intentionally *not* search-first; the primary interaction is “pick a talk → run workflows → see changes applied”.

### Landing (`/`)

- **Layout**:
  - Centered wordmark + one-sentence value statement.
  - One hero CTA: **“Browse talks”**.
  - Optional small “What you can do” strip with 3 bullets (Summary, Captions, Dubbing/Clips).
- **Content**:
  - Avoid long marketing blocks; keep it to 1–2 short paragraphs max.
- **Responsiveness**:
  - Single column always; CTA stays above the fold.

### Talks index (`/media`)

- **Primary goal**: pick a talk quickly; preview what AI adds without extra clicks.
- **Layout**:
  - Page title + short instruction (“Pick a talk to see summary, captions, dubbing, and clip creation.”).
  - Grid of talk cards (2-up mobile, 3–4-up desktop).
- **Talk card**:
  - Thumbnail (or poster), title, speaker/year (small).
  - Optional: 3–5 AI tags (if already generated) else a subtle “Generate summary” badge on detail page only (avoid too many CTAs on the index).
  - One obvious action: click card → detail page.
- **Don’t add**:
  - Search bars, filters, or heavy metadata tables (keep it sleek).

### Media detail (`/media/[slug]`)

- **Primary goal**: show “applied vs generated” value on a real asset.
- **Layout (mobile)**:
  - Player
  - Workflow actions
  - Outputs (Summary, Tags, Tracks)
  - “How it was made” disclosure (collapsed by default)
- **Layout (desktop)**:
  - Two columns:
    - Left: player + workflow actions
    - Right: generated outputs + applied tracks
- **Workflow actions (keep to a small set)**:
  - Generate summary
  - Add captions (choose language(s))
  - Dub audio (choose language(s))
  - Create clip
- **Outputs**:
  - **Generated summary**: title + description block, tag chips below.
  - **Applied tracks**: a simple list showing available caption/audio tracks; the player’s selectors reflect these.
  - **Transcript preview**: show a short snippet (from VTT/transcript) with a “View full transcript” affordance (collapsible/scrollable panel).
  - **Storyboard disclosure**: collapsed panel that shows a storyboard preview and labels it as an input used under the hood (with transcript when available).
- **State handling**:
  - For each action, show one status callout directly beneath the button while running; avoid global toasts.

### Clip creation (`/media/[slug]/clips/new`)

- **Primary goal**: create one shareable artifact without feeling like video-editing software.
- **Layout**:
  - A “workbench” with two clear panels:
    - **Inputs** panel (time range, language options, preset)
    - **Preview / output** panel (preview first; output appears when ready)
- **Inputs panel (minimal)**:
  - Start/end (or start + duration)
  - Captions: original vs translated language
  - Audio: original vs dubbed language
  - Preset: 9:16 / 1:1 / 16:9 (as 3 chips)
  - One primary CTA: “Render clip”
- **Preview/output panel**:
  - Always show an interactive preview when possible.
  - When rendering is started, replace the render CTA with a status callout and keep the preview visible (don’t blank the screen).
  - When ready, show: poster + “Download MP4” and “Open clip” actions.
- **Workflow visibility**:
  - Keep raw logs hidden; provide a “Details” disclosure that shows what steps ran (captions, dubbing, render).

---

## Motion + interaction

- Motion is **functional only**:
  - subtle hover feedback
  - instant focus feedback
  - small spinners for async work
- Avoid bouncy transitions, blurred shadows, or heavy spring animations.

---

## Accessibility

- Focus states must be highly visible (not just color changes).
- Ensure contrast for text on neutral background.
- Don’t rely on color alone for status; pair with labels (e.g. “Queued”, “Running”, “Ready”).
