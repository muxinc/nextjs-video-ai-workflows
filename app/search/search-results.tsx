"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";

import type { VideoChunkResult } from "@/db/search";

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function getThumbnailUrl(playbackId: string, time?: number): string {
  const timeParam = time ? `&time=${Math.floor(time)}` : "";
  return `https://image.mux.com/${playbackId}/thumbnail.webp?width=320&height=180&fit_mode=smartcrop${timeParam}`;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// SearchResult Component
// ─────────────────────────────────────────────────────────────────────────────

function SearchResult({ result }: { result: VideoChunkResult }) {
  const hasTimestamp = result.start_time !== null;
  const timestampParam = hasTimestamp ? `?t=${Math.floor(result.start_time!)}` : "";

  return (
    <Link
      href={`/media/${result.mux_asset_id}${timestampParam}`}
      className="group block"
    >
      <article className="card-brutal relative flex gap-4 overflow-visible p-4 transition-transform duration-100 group-hover:-translate-x-1 group-hover:-translate-y-1 group-hover:shadow-[6px_6px_0_var(--border)]">
        {/* Thumbnail */}
        <div className="relative aspect-video w-40 flex-shrink-0 overflow-hidden bg-background-dark">
          {result.playback_id ?
              (
                <Image
                  src={getThumbnailUrl(result.playback_id, result.start_time ?? undefined)}
                  alt={result.title || "Video thumbnail"}
                  fill
                  sizes="160px"
                  className="object-cover"
                />
              ) :
              (
                <div className="flex h-full items-center justify-center">
                  <span className="text-xs text-foreground-muted">No preview</span>
                </div>
              )}
          {/* Timestamp badge */}
          {hasTimestamp && (
            <div
              className="absolute bottom-1 right-1 bg-background-dark/90 px-1.5 py-0.5 text-[10px] font-bold text-white"
              style={{ fontFamily: "var(--font-space-mono)" }}
            >
              {formatTime(result.start_time!)}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex min-w-0 flex-1 flex-col gap-2 pb-12">
          {/* Title */}
          <h3 className="line-clamp-1 font-bold leading-tight group-hover:text-accent">
            {result.title || `Video ${result.video_id.slice(0, 8)}`}
          </h3>

          {/* Summary */}
          {result.summary && (
            <p className="line-clamp-2 text-sm text-foreground-muted">
              {result.summary}
            </p>
          )}

          {/* Tags */}
          {result.parent_video_tags && result.parent_video_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {result.parent_video_tags.slice(0, 3).map(tag => (
                <span
                  key={tag}
                  className="border border-border bg-surface-elevated px-1.5 py-0.5 text-[10px] text-foreground-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* View CTA (visual affordance; card link handles navigation) */}
        <div className="pointer-events-none absolute bottom-4 right-4">
          <div
            className="inline-flex items-center gap-2 border-3 border-border bg-accent px-4 py-2 text-xs font-extrabold uppercase tracking-[0.1em] text-foreground shadow-[4px_4px_0_var(--border)] transition-transform duration-100 group-hover:-translate-x-0.5 group-hover:-translate-y-0.5 group-hover:shadow-[6px_6px_0_var(--border)]"
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            View talk
            <svg
              className="block h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
              aria-hidden="true"
            >
              <path strokeLinecap="square" strokeLinejoin="miter" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </article>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SearchResults Component
// ─────────────────────────────────────────────────────────────────────────────

interface SearchResultsProps {
  query: string;
  results: VideoChunkResult[];
}

export function SearchResults({ query, results }: SearchResultsProps) {
  const shouldReduceMotion = useReducedMotion();

  const containerVariants = {
    hidden: {},
    show: {
      transition: shouldReduceMotion ?
        undefined :
          {
            delayChildren: 0.03,
            staggerChildren: 0.05,
          },
    },
  } as const;

  const itemVariants = {
    hidden: shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 },
    show: shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 },
  } as const;

  return (
    <motion.div
      // Remount on query change so the entrance animation replays for new results.
      key={query || "no-query"}
      className="flex flex-col gap-4"
      initial={shouldReduceMotion ? false : "hidden"}
      animate="show"
      variants={containerVariants}
    >
      {results.map(result => (
        <motion.div
          key={result.chunk_id}
          variants={itemVariants}
          transition={shouldReduceMotion ?
            undefined :
              { type: "spring", stiffness: 520, damping: 40, mass: 0.7 }}
        >
          <SearchResult result={result} />
        </motion.div>
      ))}
    </motion.div>
  );
}
