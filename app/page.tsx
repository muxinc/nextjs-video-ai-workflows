import Link from "next/link";

import { Footer } from "@/app/components/footer";
import { Header } from "@/app/components/header";

function LevelCard({
  level,
  badge,
  badgeClass,
  title,
  description,
  example,
}: {
  level: string;
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
            {level}
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
            <div className="stripes-accent panel-brutal-header text-foreground">
              <h2 id="landing-hero" style={{ fontFamily: "var(--font-syne)" }}>
                DEMO APP / REFERENCE ARCHITECTURE
              </h2>
            </div>

            <div className="grid gap-10 p-8 md:grid-cols-[1.2fr_0.8fr] md:items-start">
              <div className="space-y-6">
                <div className="space-y-3">
                  <p
                    className="text-xs font-bold uppercase tracking-[0.3em] text-foreground-muted"
                    style={{ fontFamily: "var(--font-space-mono)" }}
                  >
                    Video intelligence pipelines
                  </p>
                  <h1
                    className="text-4xl font-extrabold tracking-tight md:text-5xl"
                    style={{ fontFamily: "var(--font-syne)" }}
                  >
                    Launch durable AI workflows for video.
                  </h1>
                </div>

                <p className="max-w-2xl text-lg leading-relaxed text-foreground-muted md:text-xl">
                  Build video intelligence pipelines with
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
                  . Three integration levels, one consistent UX.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <Link href="/media" className="btn-action group inline-flex items-center justify-center">
                    Browse talks
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
                    QUICK START
                  </div>
                  <div className="p-5">
                    <ul className="space-y-3 text-sm text-foreground-muted">
                      <li className="flex items-start gap-3">
                        <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 border border-border bg-accent" />
                        Pick a talk from our Demuxed library.
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 border border-border bg-[#ffb202]" />
                        Run a Level 1 workflow to generate a summary and tags.
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 border border-border bg-[#1c65be]" />
                        Kick off Level 2 workflows (captions/audio) to translate the captions and dub audio.
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="mt-1 inline-block h-2.5 w-2.5 shrink-0 border border-border bg-[#22903d]" />
                        Compose multi-step pipelines for Level 3 (clips + render) to create a social clip.
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
                        You&apos;re building a durable pipeline where every step is observable, retryable, and easy to iterate on—right next to the video it affects.
                      </p>
                    </div>

                    <div className="flex bg-accent h-10 w-10 shrink-0 items-center justify-center border-2 border-border">
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

          {/* Three Level Cards */}
          <section aria-labelledby="landing-levels">
            <div
              className="section-header-brutal stripes-dark text-white"
              id="landing-levels"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              THREE INTEGRATION LEVELS
            </div>

            <div className="mt-6 grid gap-6 md:grid-cols-3">
              <LevelCard
                level="LEVEL 1"
                badge="SYNC CALL"
                badgeClass="badge-sync"
                title="Direct Function Calls"
                description="Call @mux/ai primitives and workflows directly from server-side code. Simple, fast iteration."
                example="getSummaryAndTags()"
              />
              <LevelCard
                level="LEVEL 2"
                badge="LEVERAGE ASYNC WORKFLOW"
                badgeClass="badge-async"
                title="Leverage Async Workflows"
                description="Wrap primitives in Vercel Workflows for retries, durable execution, and progress tracking."
                example="translateCaptions / translateAudio"
              />
              <LevelCard
                level="LEVEL 3"
                badge="CUSTOM WORKFLOW"
                badgeClass="badge-custom"
                title="Compose Custom Workflows"
                description="Orchestrate multiple steps and external tooling (e.g. Remotion) to produce new media outputs."
                example="Automated social clip creation"
              />
            </div>
          </section>
        </div>
      </main>

      <Footer variant="full" />
    </div>
  );
}
