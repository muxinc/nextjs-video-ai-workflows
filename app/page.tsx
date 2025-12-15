import Link from "next/link";

import { Footer } from "@/app/components/footer";
import { Header } from "@/app/components/header";

function LayerCard({
  layer,
  badge,
  badgeClass,
  title,
  description,
  example,
}: {
  layer: string;
  badge: string;
  badgeClass: string;
  title: string;
  description: string;
  example: string;
}) {
  return (
    <div className="card-brutal flex h-full min-w-0 flex-col overflow-hidden">
      <div className="panel-section-header" style={{ fontFamily: "var(--font-space-mono)" }}>
        <div className="flex items-center gap-3">
          <span className={`badge ${badgeClass}`}>
            {badge}
          </span>
          <span className="text-[10px] font-bold tracking-[0.2em] text-foreground-muted">
            {layer}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-6">
        <h3 className="mb-3 text-xl font-extrabold leading-tight" style={{ fontFamily: "var(--font-syne)" }}>
          {title}
        </h3>

        <p className="mb-6 flex-1 text-sm leading-[1.7] text-foreground-muted">
          {description}
        </p>

        <div
          className="border-t-2 border-border pt-4 text-[11px] leading-[1.8] text-foreground-muted"
          style={{ fontFamily: "var(--font-space-mono)" }}
        >
          <span className="font-bold text-foreground">Example:</span>
          {" "}
          <code className="break-words">{example}</code>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header currentPath="/" />

      <main className="flex-1 px-6 py-12 md:py-16">
        <div className="mx-auto max-w-6xl space-y-12">
          {/* Hero Panel */}
          <section className="panel-brutal overflow-hidden" aria-labelledby="landing-hero">
            <div className="grid gap-10 p-8 md:grid-cols-[1.2fr_0.8fr] md:items-start">
              <div className="space-y-6">
                <div className="space-y-3">
                  <p
                    className="text-xs font-bold uppercase tracking-[0.3em] text-foreground-muted"
                    style={{ fontFamily: "var(--font-space-mono)" }}
                  >
                    VIDEO AI INFRASTRUCTURE
                  </p>
                  <h1
                    className="text-4xl font-extrabold tracking-tight md:text-5xl"
                    style={{ fontFamily: "var(--font-syne)" }}
                  >
                    Launch durable AI workflows for video.
                  </h1>
                </div>

                <p className="max-w-2xl text-lg leading-relaxed text-foreground-muted md:text-xl">
                  Ship video intelligence that holds up at scale with
                  {" "}
                  <a
                    href="https://github.com/muxinc/ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-foreground underline decoration-accent decoration-2 underline-offset-2 transition-colors hover:text-accent"
                  >
                    @mux/ai
                  </a>
                  {" "}
                  and the
                  {" "}
                  <a
                    href="https://github.com/vercel/workflow"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-foreground underline decoration-accent decoration-2 underline-offset-2 transition-colors hover:text-accent"
                  >
                    vercel Workflow DevKit
                  </a>
                  . Three integration layers. One consistent developer experience.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link href="/media" className="btn-action group inline-flex items-center justify-center">
                    Browse videos
                    <span className="arrow-icon ml-2">↗</span>
                  </Link>

                  <a
                    href="https://github.com/muxinc/nextjs-video-ai-workflows"
                    target="_blank"
                    rel="noreferrer"
                    className="btn-outlined inline-flex items-center justify-center"
                    style={{ fontFamily: "var(--font-space-mono)" }}
                  >
                    View repo
                  </a>
                </div>
              </div>

              {/* Quick Start */}
              <div className="space-y-4">
                <div className="card-flat overflow-hidden">
                  <div className="panel-brutal-header bg-background-dark text-white" style={{ fontFamily: "var(--font-space-mono)" }}>
                    Reference pipeline
                  </div>
                  <div className="p-5">
                    <ul className="space-y-3 text-sm text-foreground-muted">
                      <li className="flex items-start gap-3">
                        <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 border border-border bg-accent" />
                        Start with a real video from your Mux account.
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 border border-border bg-[#ffb202]" />
                        Generate a summary and tags from the storyboard and transcript.
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 border border-border bg-[#1c65be]" />
                        Localize content with translated captions and dubbed audio tracks.
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 border border-border bg-[#22903d]" />
                        Create distributable social clips that can reach broader audiences.
                      </li>
                    </ul>
                  </div>
                </div>

                <div className="border-3 border-border p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div
                        className="text-xs font-bold uppercase tracking-[0.2em] text-foreground-muted"
                        style={{ fontFamily: "var(--font-space-mono)" }}
                      >
                        Lightbulb moment
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-foreground-muted">
                        You&apos;re not just &quot;running AI.&quot;
                        {" "}
                        You&apos;re building reliable pipelines where every step is observable and retryable, right alongside the videos they transform.
                      </p>
                    </div>

                    <div className="flex bg-yellow-400 h-10 w-10 shrink-0 items-center justify-center border-2 border-border">
                      <svg className="h-5 w-5 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                        <path strokeLinecap="square" strokeLinejoin="miter" d="M12 2a7 7 0 00-4 12.74V18a2 2 0 002 2h4a2 2 0 002-2v-3.26A7 7 0 0012 2z" />
                        <path strokeLinecap="square" strokeLinejoin="miter" d="M10 22h4" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Three Layer Cards */}
          <section aria-labelledby="landing-layers">
            <div
              className="section-header-brutal stripes-dark text-white"
              id="landing-layers"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              THREE INTEGRATION LAYERS
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-3">
              <LayerCard
                layer="LAYER 1"
                badge="Primitives"
                badgeClass="badge-sync"
                title="Call primitives directly"
                description="Low-level building blocks for video intelligence, from fetching transcripts to generating storyboards you can compose into pipelines later."
                example="fetchTranscriptForAsset"
              />
              <LayerCard
                layer="LAYER 2"
                badge="Workflows"
                badgeClass="badge-async"
                title="Run workflows durably"
                description="@mux/ai ships ready-made workflows for video intelligence. Run them on Vercel Workflows for retries, progress tracking, and resumable execution."
                example="translateCaptions"
              />
              <LayerCard
                layer="LAYER 3"
                badge="Connectors"
                badgeClass="badge-custom"
                title="Compose with connectors"
                description="Connect primitives and workflows to external tools like Eleven labs and Remotion to render, publish, and generate new media outputs."
                example="Localized social clip automation"
              />
            </div>
          </section>
        </div>
      </main>

      <Footer variant="full" />
    </div>
  );
}
