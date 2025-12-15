"use client";

import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";
import Link from "next/link";

interface TalkCardProps {
  slug: string;
  title: string;
  playbackId: string | null;
  tags: string[];
}

function getThumbnailUrl(playbackId: string): string {
  return `https://image.mux.com/${playbackId}/thumbnail.webp?width=640&height=360&fit_mode=smartcrop`;
}

export function TalkCard({ slug, title, playbackId, tags }: TalkCardProps) {
  const shouldReduceMotion = useReducedMotion();

  const cardVariants = {
    rest: {
      x: 0,
      y: 0,
      boxShadow: "6px 6px 0 var(--border)",
    },
    hover: {
      x: -4,
      y: -4,
      boxShadow: "8px 8px 0 var(--border)",
    },
  } as const;

  const thumbVariants = {
    rest: { scale: 1 },
    hover: { scale: 1.05 },
  } as const;

  const ctaVariants = {
    rest: {
      scale: 1,
      y: 0,
      boxShadow: "4px 4px 0 var(--border)",
    },
    hover: {
      scale: 1.02,
      y: -2,
      boxShadow: "6px 6px 0 var(--border)",
    },
  } as const;

  return (
    <Link href={`/media/${slug}`} className="block">
      <motion.article
        className="card-brutal relative flex h-full flex-col overflow-visible"
        initial="rest"
        animate="rest"
        whileHover={shouldReduceMotion ? undefined : "hover"}
        whileTap={shouldReduceMotion ? undefined : { scale: 0.99, x: 0, y: 0 }}
        variants={cardVariants}
        transition={{ type: "spring", stiffness: 500, damping: 28 }}
      >
        {/* Thumbnail */}
        <div className="border-b-3 border-border bg-surface p-3">
          <div className="relative aspect-video w-full overflow-hidden border-3 border-border bg-background-dark">
            {playbackId ?
                (
                  <motion.div
                    className="absolute inset-0"
                    variants={thumbVariants}
                    transition={{ type: "spring", stiffness: 450, damping: 30 }}
                  >
                    <Image
                      src={getThumbnailUrl(playbackId)}
                      alt={title}
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      className="object-cover"
                    />
                  </motion.div>
                ) :
                (
                  <div className="flex h-full items-center justify-center">
                    <span className="text-foreground-muted">No preview</span>
                  </div>
                )}
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-4 p-5 pb-14">
          {/* Title */}
          <h3
            className="line-clamp-3 text-2xl font-extrabold leading-tight tracking-tight"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            {title}
          </h3>

          {/* Tags (AI-generated) */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.slice(0, 3).map(tag => (
                <span
                  key={tag}
                  className="border-2 border-border bg-surface px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-foreground"
                  style={{ fontFamily: "var(--font-space-mono)" }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Spacer to push CTA to bottom */}
          <div className="flex-1" />
        </div>

        {/* View CTA Button (offset / overhanging) */}
        <div className="pointer-events-none absolute bottom-0 left-5 -translate-x-1 translate-y-1/2">
          <motion.div
            className="pointer-events-auto inline-flex items-center gap-2 border-3 border-border bg-accent px-6 py-3 text-sm font-extrabold uppercase tracking-[0.1em] text-foreground"
            style={{ fontFamily: "var(--font-space-mono)" }}
            variants={ctaVariants}
            transition={{ type: "spring", stiffness: 450, damping: 26 }}
          >
            View Talk
            <svg
              className="block h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="square" strokeLinejoin="miter" d="M9 5l7 7-7 7" />
            </svg>
          </motion.div>
        </div>
      </motion.article>
    </Link>
  );
}
