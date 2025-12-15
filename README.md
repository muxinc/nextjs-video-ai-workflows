# @mux/ai + Vercel Workflows Starter

A Next.js starter template demonstrating how to build **durable video AI pipelines** with [`@mux/ai`](https://github.com/muxinc/ai) and the [Vercel Workflow DevKit](https://github.com/vercel/workflow).

## Three Integration Layers

| Layer             | Pattern                          | Example                                                            |
| ----------------- | -------------------------------- | ------------------------------------------------------------------ |
| **1. Primitives** | Call functions directly          | `getSummaryAndTags()` — instant results                            |
| **2. Workflows**  | Run durably via Vercel Workflows | `translateCaptions`, `translateAudio` — retries, progress tracking |
| **3. Connectors** | Compose with external tools      | Clip creation with Remotion — multi-step pipelines                 |

## Resumable workflows (try it)

This project showcases **resumable, durable workflows out of the box**:

- Start a workflow (captions, dubbing, or summary).
- Refresh the page, or navigate away and back.
- You should see the workflow **still running asynchronously**, with status rehydrated from browser `localStorage`.

## Quick Start

```bash
npm install
npm run dev
```

Inspect workflow runs locally:

```bash
npx workflow web
```

## Remotion support

Remotion is used within this example app for composing `@mux/ai` with video rendering.

### Local Development

```bash
# Open the Remotion Studio for live preview and iteration
npm run remotion:studio

# Render a video locally (for testing)
# Pass the composition name as an argument
npm run remotion:render:local MyComposition

# Optionally specify an output path
npm run remotion:render:local MyComposition out/foo.mp4
```

### Production Deployment

```bash
# Deploy Remotion site to AWS Lambda for serverless rendering
npm run remotion:deploy
```

> **Note:** `remotion:deploy` bundles and deploys your Remotion site to AWS Lambda for production video rendering. This is **not for development** — use `remotion:studio` and `remotion:render:local` for local dev and testing.

### Automated Deployment

Remotion is automatically deployed to AWS Lambda when changes to `remotion/` are merged into `main`. See [DOCS/AUTOMATED-REMOTION-DEPLOYMENTS.md](./DOCS/AUTOMATED-REMOTION-DEPLOYMENTS.md) for details.

## Environment Variables

See `AGENTS.md` for the full list. At minimum you'll need:

```bash
# Mux credentials
MUX_TOKEN_ID=
MUX_TOKEN_SECRET=

# OpenAI (required for embeddings)
OPENAI_API_KEY=

# Supabase (asset metadata + search)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### Supabase Types

Generate TypeScript types from your Supabase schema:

```bash
npx supabase login

npx supabase gen types typescript \
  --project-id YOUR_PROJECT_ID \
  --schema public \
  > app/lib/supabase/types.ts
```

## Media Detail Page Structure

The media detail page (`/media/[slug]`) is organized into co-located feature folders:

```
app/media/[slug]/
├── media-content.tsx
├── page.tsx
├── localization/
│   ├── actions.ts      (start/poll caption & audio translation workflows)
│   ├── constants.ts
│   └── ui.tsx
├── player/
│   ├── context.ts
│   ├── provider.tsx
│   ├── ui.tsx
│   └── use-player.ts
├── summarize-and-tag/
│   ├── actions.ts      (start/poll summary generation workflow)
│   └── ui.tsx
├── transcript/
│   ├── actions.ts      (semantic search within video transcript)
│   ├── helpers.ts
│   └── ui.tsx
└── workflows-panel/
    ├── helpers.ts
    └── ui.tsx          (includes StatusBadge, StepProgress, etc.)
```

## Learn More

- [`context/application-explained.md`](./context/application-explained.md) — what the app does and why
- [`context/design-explained.md`](./context/design-explained.md) — visual design and UX patterns
- [`context/implementation-explained.md`](./context/implementation-explained.md) — routes, data model, and code patterns
- [`AGENTS.md`](./AGENTS.md) — guidance for AI coding assistants

## See Also

- [`muxinc/supasearch`](https://github.com/muxinc/supasearch) — semantic search for your Mux video catalog with Supabase vector embeddings

- [Supabase Semantic Search](https://supabase.com/docs/guides/ai/semantic-search) — guide to implementing vector search with pgvector
