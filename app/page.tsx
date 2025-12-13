import Link from "next/link";

import { Footer } from "@/app/components/footer";

function DemuxedLogo() {
  return (
    <div className="flex flex-col items-center gap-2">
      <h1
        className="text-5xl font-extrabold tracking-[0.3em] md:text-7xl"
        style={{ fontFamily: "var(--font-syne)" }}
      >
        DEMU
        <span className="inline-block -rotate-12 scale-110">X</span>
        ED
      </h1>
      <p
        className="text-sm tracking-[0.4em] text-foreground-muted md:text-base"
        style={{ fontFamily: "var(--font-space-mono)" }}
      >
        STUDIO
      </p>
    </div>
  );
}

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
    <div className="card-brutal flex h-full min-w-0 flex-col p-8">
      {/* Header: Level + Badge stacked - fixed height for alignment */}
      <div className="mb-8 flex h-[52px] flex-col gap-3">
        <span
          className="text-[10px] font-bold tracking-[0.2em] text-foreground-muted"
          style={{ fontFamily: "var(--font-space-mono)" }}
        >
          {level}
        </span>
        <span className={`badge ${badgeClass} shrink-0 self-start`}>
          {badge}
        </span>
      </div>

      {/* Title - fixed height for alignment */}
      <h3 className="mb-5 h-[56px] text-xl font-bold leading-tight">
        {title}
      </h3>

      {/* Description - flex-1 pushes footer to bottom */}
      <p className="mb-8 flex-1 text-sm leading-[1.6] text-foreground-muted">
        {description}
      </p>

      {/* Footer: Example - fixed height for alignment */}
      <div
        className="flex h-[72px] shrink-0 flex-col border-t-2 border-border pt-5 text-[11px] leading-[1.7] text-foreground-muted"
        style={{ fontFamily: "var(--font-space-mono)" }}
      >
        <span className="mb-1 font-bold text-foreground">Example:</span>
        <code className="block break-words text-foreground-muted">
          {example}
        </code>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 md:py-24">
        <div className="flex w-full max-w-4xl flex-col items-center gap-12">
          {/* Logo */}
          <DemuxedLogo />

          {/* Value Statement */}
          <p className="max-w-xl text-center text-lg leading-relaxed text-foreground-muted md:text-xl">
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
              Vercel Workflow DevKit
            </a>
            . Three integration levels, one reference architecture.
          </p>

          {/* Primary CTA with cursor overlay */}
          <Link href="/media" className="btn-primary group relative">
            Browse talks
          </Link>

          {/* Three Level Cards */}
          <section className="mt-8 w-full">
            <h2
              className="mb-6 text-center text-xs font-bold tracking-[0.3em] text-foreground-muted"
              style={{ fontFamily: "var(--font-space-mono)" }}
            >
              THREE INTEGRATION LEVELS
            </h2>
            <div className="grid grid-rows-1 gap-6 md:grid-cols-3">
              <LevelCard
                level="LEVEL 1"
                badge="SYNC CALL"
                badgeClass="badge-sync"
                title="Direct Function Calls"
                description="Simply call @mux/ai primitives and workflows directly from server-side code with minimal workflow infrastructure."
                example="getSummaryAndTags()"
              />
              <LevelCard
                level="LEVEL 2"
                badge="ASYNC WORKFLOW"
                badgeClass="badge-async"
                title="Leverage Async Workflows"
                description="Invoke @mux/ai primitives and workflows within a Vercel Workflow for reliability and automatic retry semantics with progress tracking."
                example="translateCaptions / translateAudio"
              />
              <LevelCard
                level="LEVEL 3"
                badge="CUSTOM WORKFLOW"
                badgeClass="badge-custom"
                title="Multi-Step Orchestration"
                description="Compose multiple @mux/ai primitives and workflows with external tools like Remotion to build complex video processing pipelines."
                example="Automated social clip pipeline"
              />
            </div>
          </section>

          {/* User Journey Flow */}
          <div
            className="mt-6 flex flex-col items-center gap-2 text-xs text-foreground-muted md:flex-row md:gap-3"
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            <span>Pick a talk</span>
            {/* Arrow: down on mobile, right on desktop */}
            <svg className="h-4 w-4 rotate-90 md:rotate-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span>see Level 1 results</span>
            <svg className="h-4 w-4 rotate-90 md:rotate-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span>trigger Level 2 workflows</span>
            <svg className="h-4 w-4 rotate-90 md:rotate-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            <span>build Level 3 pipelines</span>
          </div>
        </div>
      </main>

      <Footer variant="full" />
    </div>
  );
}
