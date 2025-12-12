# Design explained

This document describes the intended look-and-feel of the "Demuxed Library" app.

The visual reference is a **minimal, high-contrast, slightly brutalist** UI: lots of whitespace, thick black rules, sharp corners, and simple blocks that feel fast and honest.

---

## The teaching goal

This app teaches developers how to integrate `@mux/ai` with Vercel Workflows. The UI must make the **three integration levels** obvious:

| Level | Pattern              | Visual treatment                     |
| ----- | -------------------- | ------------------------------------ |
| **1** | Sync call            | Instant result, simple output block  |
| **2** | Basic async workflow | Status callout + result when ready   |
| **3** | Custom workflow      | Multi-step progress + final artifact |

Every page should visually distinguish which level the user is interacting with.

---

## Overall vibe

- **Editorial + utilitarian**: it should feel like a small, opinionated media library—not a dashboard.
- **Calm canvas, loud controls**: the background stays soft and neutral; interactive elements are bold and clearly outlined.
- **Deliberate restraint**: few colors, minimal decoration, and only one "primary" action per surface.
- **Show the levels clearly**: every page should make it obvious which integration pattern is being demonstrated (sync, basic async, or custom workflow).

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

### Level indicator

A small badge or label that identifies which integration level a section represents. This is crucial for the teaching goal.

- **Level 1**: "SYNC CALL" — understated, possibly a small pill badge
- **Level 2**: "ASYNC WORKFLOW" — same style, different label
- **Level 3**: "CUSTOM WORKFLOW" — same style, different label

Placement:

- At the top of each section on the detail page
- At the top of the clip creation page
- Optional: in card footers on the index page (if the card shows Level 1 output)

Visual treatment:

- Small all-caps text
- Subtle border or background tint
- Consistent across the app so users learn the pattern

### Primary CTA button (hero)

- Large button with **thick black border** (or solid black fill with white text).
- Single short label (e.g. "Browse talks", "Generate summary", "Add Spanish captions").
- Optional one-line helper text below the button, not inside it.

Interactions:

- Hover: slightly increase contrast (or deepen shadow).
- Focus: unmistakable focus ring (outer outline or accent rule) without changing the core shape.

### Workflow action row (Level 2)

- A small set (2–4) of clearly-labeled, single-purpose buttons.
- Prefer verbs + target: "Add Spanish captions", "Dub to French".
- Each button is a trigger for a **single-primitive** Vercel Workflow.
- When an action is unavailable (missing track, not ready), show a short reason and the next step ("No captions found → generate captions first" / "Asset processing → try again soon").

### Suggestion chips

- White chips with thick black borders.
- Light hard shadow.
- Text is short and direct.

Interactions:

- Hover: invert (black background / white text) **or** add a heavier shadow.
- Active/selected: filled (black) with reversed text.

### Status / progress callouts (async work)

Different treatment for Level 2 vs Level 3:

**Level 2 (single-step status)**:

- A bordered, white panel that reads like a "system message".
- Left-aligned spinner + short status string.
- Simple states: Queued → Running → Ready / Failed
- Keep copy functional: "Translating captions to Spanish…"

**Level 3 (multi-step status)**:

- A bordered panel showing the **pipeline** of steps.
- Each step has its own status indicator (pending, running, complete, failed).
- Current step is highlighted; completed steps show checkmarks.
- Example: "✓ Translating captions → ✓ Dubbing audio → ● Rendering video → ○ Uploading"

Rules:

- No full-screen loaders unless absolutely necessary.
- Prefer inline progress in-context with the action that started it.
- Always show the "what will happen next" line when possible (e.g. "When ready, captions will appear in the player selector.").
- For Level 3, make the multi-step nature visible—this is a key teaching moment.

### Disclosure panel (“How it was made”)

- A collapsible bordered panel with a short summary line and optional detail content.
- Used to keep the default UI clean while still showing credibility and inputs:
  - storyboard preview (or a representative frame)
  - transcript preview snippet (from VTT / transcript)
  - small labels: “Inputs used”, “Generated output”

### Footer band ("Built with")

- Dark band across the bottom with subdued text.
- A thin accent rule at the top edge.
- "Built with" line showing the key technologies:
  - **@mux/ai** — video intelligence primitives
  - **Vercel Workflows** — async orchestration
  - **Remotion** — video rendering (Level 3 only)
  - **Mux Video** — underlying asset hosting + playback

---

## Page-level guidance (mapping to this app)

The goal across pages: **teach the three integration levels** with a sleek UI. The primary interaction is "pick a talk → see Level 1 results → trigger Level 2 workflows → build Level 3 pipelines."

### Landing (`/`)

- **Layout**:
  - Centered wordmark + one-sentence value statement about `@mux/ai` + Vercel Workflows.
  - One hero CTA: **"Browse talks"**.
  - **Three-level preview strip**: show what each level does (sync call, basic workflow, custom workflow).
- **Content**:
  - Avoid long marketing blocks; keep it to 1–2 short paragraphs max.
  - Make it clear this is a **reference architecture**, not just a demo.
- **Responsiveness**:
  - Single column always; CTA stays above the fold.

### Talks index (`/media`)

- **Primary goal**: pick a talk quickly; preview what Level 1 (sync summarization) adds.
- **Layout**:
  - Page title + short instruction ("Pick a talk to explore sync calls, async workflows, and custom pipelines.").
  - Grid of talk cards (2-up mobile, 3–4-up desktop).
- **Talk card**:
  - Thumbnail (or poster), title, speaker/year (small).
  - **AI summary title + tags** (if already generated via Level 1) — else fallback to original title.
  - One obvious action: click card → detail page.
- **Don't add**:
  - Search bars, filters, or heavy metadata tables (keep it sleek).

### Media detail (`/media/[slug]`)

- **Primary goal**: show all three integration levels on a single asset, clearly labeled.
- **Layout (mobile)**:
  - Player
  - Level 1 section (Sync)
  - Level 2 section (Basic workflows)
  - Level 3 section (Custom workflow CTA)
  - "How it was made" disclosure (collapsed by default)
- **Layout (desktop)**:
  - Two columns:
    - Left: player + workflow actions by level
    - Right: outputs organized by level
- **Level 1 section**: "Sync call"
  - **Generate summary** button (or show result if already generated)
  - Output: title + description block, tag chips
  - Small label: "Direct function call → instant result"
- **Level 2 section**: "Basic async workflows"
  - **Add Spanish captions** / **Add French captions** buttons
  - **Dub to Spanish** / **Dub to French** buttons
  - Status callouts inline: Queued → Running → Ready
  - Small label: "Single primitive in Vercel Workflow → status + result"
- **Level 3 section**: "Custom workflow"
  - **Create social clip** CTA → navigates to clip creation page
  - Preview of what the custom workflow produces
  - Small label: "Multi-step orchestration with Remotion → complex pipeline"
- **Applied tracks** (in player):
  - Caption selector: Original + translated captions (Level 2 outputs)
  - Audio selector: Original + dubbed tracks (Level 2 outputs)
- **State handling**:
  - For each Level 2 action, show one status callout directly beneath the button while running.
  - Avoid global toasts; keep status contextual to the action.

### Clip creation (`/media/[slug]/clips/new`)

- **Primary goal**: demonstrate the Level 3 custom workflow—orchestrating multiple primitives + Remotion.
- **Layout**:
  - A "workbench" with two clear panels:
    - **Inputs** panel (time range, language options, preset)
    - **Preview / output** panel (preview first; output appears when ready)
- **Level label**: clearly show this is "Level 3: Custom Workflow" at the top.
- **Inputs panel (minimal)**:
  - Start/end (or start + duration)
  - Captions: original vs translated language
  - Audio: original vs dubbed language
  - Preset: 9:16 / 1:1 / 16:9 (as 3 chips)
  - One primary CTA: "Render clip"
- **Preview/output panel**:
  - Always show an interactive Remotion preview.
  - When rendering is started, show **multi-step status**:
    - "Translating captions..." → "Dubbing audio..." → "Rendering video..." → "Uploading..."
  - When ready, show: poster + "Download MP4" and "Open clip" actions.
- **Workflow visibility**:
  - Show which step is currently running (this is a key teaching moment).
  - Optional: "Details" disclosure that shows all steps + their status.

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
