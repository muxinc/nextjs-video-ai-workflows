# @mux/ai + Vercel Workflows Starter

A Next.js starter template demonstrating how to build **durable video AI pipelines** with [`@mux/ai`](https://github.com/muxinc/ai) and the [Vercel Workflow DevKit](https://github.com/vercel/workflow).

## 🚀 Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmuxinc%2Fmux-ai-vercel-workflows&env=MUX_TOKEN_ID,MUX_TOKEN_SECRET,OPENAI_API_KEY,DATABASE_URL,S3_ENDPOINT,S3_REGION,S3_BUCKET,S3_ACCESS_KEY_ID,S3_SECRET_ACCESS_KEY&envDescription=Required%20credentials%20for%20Mux%2C%20AI%20providers%2C%20database%2C%20and%20S3%20storage&envLink=https%3A%2F%2Fgithub.com%2Fmuxinc%2Fmux-ai-vercel-workflows%23environment-variables&project-name=mux-ai-workflows&repository-name=mux-ai-workflows)

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
npm run remotion:render:local default-composition

# Optionally specify an output path
npm run remotion:render:local default-composition out/foo.mp4
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

# Database (PostgreSQL with pgvector) — required to store/search the Mux catalog metadata
DATABASE_URL=
```

### Database setup + importing your Mux catalog

This project stores your Mux catalog metadata in Postgres and generates **pgvector embeddings** for semantic search.
The database schema and migrations are managed with **Drizzle** (see `db/schema.ts` and `db/migrations/`), and the `db:*` scripts use **Drizzle Kit**.

#### 1) Configure your database connection

Create a `.env.local` file (this is what both Drizzle and the import script load):

```bash
# Database (PostgreSQL + pgvector)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DB_NAME"

# Mux (used by the import script)
MUX_TOKEN_ID="..."
MUX_TOKEN_SECRET="..."

# Embeddings (used by the import script)
OPENAI_API_KEY="..."
```

> Your Postgres must support `pgvector`. The first migration will run `CREATE EXTENSION IF NOT EXISTS vector;`.

#### 2) Run database migrations

Apply the migrations in `db/migrations/` (creates tables + indexes and enables pgvector):

```bash
npm run db:migrate
```

#### 3) Import Mux assets (and generate embeddings)

This fetches all **ready** Mux assets with playback IDs, upserts rows into `videos`, and writes embedding rows into `video_chunks`.

```bash
npm run import-mux-assets
```

To embed subtitles from a specific captions track language, pass `--language` (defaults to `en`). This should match the language of an **existing** captions track on the source Mux asset — it does **not** translate captions:

```bash
npm run import-mux-assets -- --language en
```

#### 4) Understand the database scripts

- **`npm run db:generate`**: Generates new migration files from `db/schema.ts` (use this after changing the schema).
- **`npm run db:migrate`**: Applies migrations to the database defined by `DATABASE_URL`.
- **`npm run db:studio`**: Opens Drizzle Studio to inspect tables/rows locally (also uses `DATABASE_URL`).

## Media Detail Page Structure

The media detail page (`/media/[slug]`) is organized into co-located feature folders:

```
app/media/[slug]/
├── media-content.tsx
├── page.tsx
├── localization/
│   ├── actions.ts      (captions & audio translation)
│   ├── constants.ts
│   └── ui.tsx
├── player/
│   ├── context.ts
│   ├── provider.tsx
│   ├── ui.tsx
│   └── use-player.ts
├── social-clips/
│   ├── actions.ts      (clip creation & Remotion Lambda rendering)
│   ├── constants.ts
│   ├── preview.tsx     (client-side Remotion Player preview)
│   └── ui.tsx
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

- [`pgvector`](https://github.com/pgvector/pgvector) — vector embeddings and similarity search for Postgres
