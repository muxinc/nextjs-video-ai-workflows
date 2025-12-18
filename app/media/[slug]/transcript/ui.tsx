"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { recordMetric } from "@/app/lib/metrics-actions";
import type { TranscriptCue } from "@/app/media/types";
import { formatTime } from "@/app/media/utils";

import { usePlayer } from "../player/use-player";

import { searchTranscript } from "./actions";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SyncedTranscriptProps {
  cues: TranscriptCue[];
  muxAssetId: string;
  title?: string;
}

interface TranscriptPanelProps {
  cues: TranscriptCue[];
  currentTime?: number;
  onSeek?: (time: number) => void;
  muxAssetId?: string;
  title?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// TranscriptPanel - Core transcript UI
// ─────────────────────────────────────────────────────────────────────────────

function TranscriptPanel({ cues, currentTime = 0, onSeek, muxAssetId, title }: TranscriptPanelProps) {
  const [showJumpButton, setShowJumpButton] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<"up" | "down">("up");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, startSearchTransition] = useTransition();
  const [semanticHits, setSemanticHits] = useState<Array<{ cueId: string; chunkText: string }>>([]);
  const [activeHitIndex, setActiveHitIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const cueRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const isAutoScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActiveCueIdRef = useRef<string | null>(null);

  // Find the currently active cue based on playback time
  const activeCue = cues.find(
    cue => currentTime >= cue.startTime && currentTime < cue.endTime,
  );

  // Scroll to the active cue (within container only, avoiding page scroll jacking)
  const scrollToActiveCue = useCallback(() => {
    if (!activeCue || !containerRef.current)
      return;

    const cueElement = cueRefs.current.get(activeCue.id);
    if (!cueElement)
      return;

    const container = containerRef.current;

    // Calculate scroll position to center the cue within the container
    const containerHeight = container.clientHeight;
    const cueOffsetTop = cueElement.offsetTop;
    const cueHeight = cueElement.offsetHeight;

    // Target scroll position: center the cue vertically in the container
    const targetScrollTop = cueOffsetTop - (containerHeight / 2) + (cueHeight / 2);

    isAutoScrollingRef.current = true;

    // Use scrollTo on the container only - this prevents page scroll jacking
    container.scrollTo({
      top: targetScrollTop,
      behavior: "smooth",
    });

    // Reset the auto-scrolling flag after animation completes
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isAutoScrollingRef.current = false;
    }, 600);
  }, [activeCue]);

  // Auto-scroll when active cue changes (only if button is not shown)
  useEffect(() => {
    if (!showJumpButton && activeCue?.id !== lastActiveCueIdRef.current) {
      lastActiveCueIdRef.current = activeCue?.id ?? null;
      scrollToActiveCue();
    }
  }, [activeCue?.id, showJumpButton, scrollToActiveCue]);

  // Handle user scroll - detect when user scrolls away from auto-scroll
  const handleScroll = useCallback(() => {
    // Ignore scroll events triggered by auto-scrolling
    if (isAutoScrollingRef.current)
      return;

    // Check if the active cue is visible in the container
    if (activeCue && containerRef.current) {
      const cueElement = cueRefs.current.get(activeCue.id);
      if (cueElement) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const cueRect = cueElement.getBoundingClientRect();

        // Check if cue is out of view
        const isAboveView = cueRect.bottom < containerRect.top;
        const isBelowView = cueRect.top > containerRect.bottom;
        const isOutOfView = isAboveView || isBelowView;

        if (isOutOfView) {
          // Set scroll direction for the arrow indicator
          setScrollDirection(isBelowView ? "down" : "up");
          setShowJumpButton(true);
        } else {
          // Cue is visible, hide the button
          setShowJumpButton(false);
        }
      }
    }
  }, [activeCue]);

  // Jump back to current cue
  const handleJumpToCurrent = () => {
    // Hide the button immediately
    setShowJumpButton(false);
    // Mark as auto-scrolling to prevent the scroll from re-showing the button
    isAutoScrollingRef.current = true;
    scrollToActiveCue();
  };

  // Click handler for seeking to a specific cue
  const handleCueClick = (cue: TranscriptCue) => {
    setShowJumpButton(false);
    isAutoScrollingRef.current = true;
    if (onSeek) {
      onSeek(cue.startTime);
    }
  };

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Create a set of all hit cue IDs for highlighting
  const hitCueIdSet = new Set(semanticHits.map(hit => hit.cueId));

  // Find the cue that contains or is closest to a given time
  const findCueByTime = useCallback((targetTime: number): TranscriptCue | null => {
    // First, try to find a cue that contains the time
    const containingCue = cues.find(
      cue => targetTime >= cue.startTime && targetTime < cue.endTime,
    );
    if (containingCue)
      return containingCue;

    // Otherwise, find the closest cue by start time
    let closestCue: TranscriptCue | null = null;
    let closestDiff = Infinity;

    for (const cue of cues) {
      const diff = Math.abs(cue.startTime - targetTime);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestCue = cue;
      }
    }

    return closestCue;
  }, [cues]);

  const scrollToCue = useCallback((targetCue: TranscriptCue) => {
    if (!containerRef.current)
      return;

    const cueElement = cueRefs.current.get(targetCue.id);
    if (!cueElement)
      return;

    // Behave like manual scrolling: pause auto-follow and show the jump-to-current CTA
    setShowJumpButton(true);
    isAutoScrollingRef.current = true;

    const container = containerRef.current;

    // Calculate scroll position to center the cue within the container (avoids page scroll jacking)
    const containerHeight = container.clientHeight;
    const cueOffsetTop = cueElement.offsetTop;
    const cueHeight = cueElement.offsetHeight;
    const targetScrollTop = cueOffsetTop - (containerHeight / 2) + (cueHeight / 2);

    container.scrollTo({
      top: targetScrollTop,
      behavior: "smooth",
    });

    // Reset auto-scrolling flag
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isAutoScrollingRef.current = false;
    }, 600);
  }, []);

  // Get the current active hit
  const currentHit = semanticHits[activeHitIndex] ?? null;

  // Navigate to a specific hit index
  const goToHit = useCallback((index: number) => {
    if (semanticHits.length === 0)
      return;
    const hit = semanticHits[index];
    if (!hit)
      return;

    const targetCue = cues.find(cue => cue.id === hit.cueId);
    if (targetCue) {
      setActiveHitIndex(index);
      scrollToCue(targetCue);
    }
  }, [cues, semanticHits, scrollToCue]);

  // Navigate to previous hit
  const handlePrevHit = useCallback(() => {
    if (semanticHits.length === 0)
      return;
    const prevIndex = activeHitIndex <= 0 ? semanticHits.length - 1 : activeHitIndex - 1;
    goToHit(prevIndex);
  }, [activeHitIndex, goToHit, semanticHits.length]);

  // Navigate to next hit
  const handleNextHit = useCallback(() => {
    if (semanticHits.length === 0)
      return;
    const nextIndex = activeHitIndex >= semanticHits.length - 1 ? 0 : activeHitIndex + 1;
    goToHit(nextIndex);
  }, [activeHitIndex, goToHit, semanticHits.length]);

  // Handle transcript search - combines literal and semantic search
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedQuery || !muxAssetId)
      return;

    // Record search metric
    void recordMetric("semantic-search-transcript", { muxAssetId, query: searchQuery });

    startSearchTransition(async () => {
      // 1. Compute literal text matches (cues containing the query)
      const literalHits = cues
        .filter(cue => cue.text.toLowerCase().includes(normalizedQuery))
        .map(cue => ({ cueId: cue.id, type: "literal" as const }));

      // 2. Run semantic search
      const semanticResults = await searchTranscript(searchQuery, muxAssetId);

      // 3. Map semantic results to cues
      const semanticHitsFromSearch = semanticResults
        .filter(result => result.startTime !== null)
        .map((result) => {
          const targetCue = findCueByTime(result.startTime!);
          return targetCue ? { cueId: targetCue.id, type: "semantic" as const } : null;
        })
        .filter((hit): hit is { cueId: string; type: "semantic" } => hit !== null);

      // 4. Combine and deduplicate (literal matches take priority, ordered by transcript position)
      const seenCueIds = new Set<string>();
      const combinedHits: Array<{ cueId: string; type: "literal" | "semantic" }> = [];

      // Add all cues in transcript order, prioritizing literal matches
      for (const cue of cues) {
        const isLiteral = literalHits.some(h => h.cueId === cue.id);
        const isSemantic = semanticHitsFromSearch.some(h => h.cueId === cue.id);

        if (isLiteral && !seenCueIds.has(cue.id)) {
          combinedHits.push({ cueId: cue.id, type: "literal" });
          seenCueIds.add(cue.id);
        } else if (isSemantic && !seenCueIds.has(cue.id)) {
          combinedHits.push({ cueId: cue.id, type: "semantic" });
          seenCueIds.add(cue.id);
        }
      }

      if (combinedHits.length > 0) {
        setSemanticHits(combinedHits.map(h => ({ cueId: h.cueId, chunkText: "" })));
        setActiveHitIndex(0);
        // Scroll to first hit
        const firstCue = cues.find(cue => cue.id === combinedHits[0].cueId);
        if (firstCue) {
          scrollToCue(firstCue);
        }
      } else {
        setSemanticHits([]);
        setActiveHitIndex(0);
      }
    });
  }, [cues, findCueByTime, muxAssetId, normalizedQuery, scrollToCue, searchQuery]);

  return (
    <div className="card-brutal relative flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 flex-col gap-3 border-b-3 border-border bg-surface-elevated px-5 py-4">
        <h2
          className="text-lg font-extrabold uppercase leading-tight tracking-tight"
          style={{ fontFamily: "var(--font-syne)" }}
        >
          {title || "Transcript"}
        </h2>

        {/* Search input */}
        {muxAssetId && (
          <div className="flex flex-col gap-2">
            <form onSubmit={handleSearch} className="flex gap-2">
              <motion.div
                className="relative flex-1"
                initial={false}
                animate={{ scale: normalizedQuery ? 1 : 1 }}
              >
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setSemanticHits([]);
                    setActiveHitIndex(0);
                  }}
                  placeholder="Search transcript..."
                  className="w-full border-2 border-border bg-surface px-3 py-2 text-base placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent sm:py-1.5 sm:text-sm"
                  style={{ fontFamily: "var(--font-space-mono)" }}
                />
              </motion.div>
              <motion.button
                type="submit"
                disabled={isSearching || !normalizedQuery}
                className="border-2 border-border bg-accent px-3 py-2 text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:py-1.5 sm:text-sm"
                aria-label="Find next"
                title="Find next"
                whileHover={{ scale: 1.05, boxShadow: "2px 2px 0 var(--border)" }}
                whileTap={{ scale: 0.95 }}
                transition={{ type: "spring", stiffness: 400, damping: 17 }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  {isSearching ?
                      (
                        <motion.svg
                          key="spinner"
                          className="h-4 w-4 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                          initial={{ opacity: 0, rotate: -90 }}
                          animate={{ opacity: 1, rotate: 0 }}
                          exit={{ opacity: 0, rotate: 90 }}
                          transition={{ duration: 0.15 }}
                        >
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </motion.svg>
                      ) :
                      (
                        <motion.svg
                          key="search"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.15 }}
                        >
                          <path strokeLinecap="square" strokeLinejoin="miter" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </motion.svg>
                      )}
                </AnimatePresence>
              </motion.button>
              <AnimatePresence mode="popLayout">
                {normalizedQuery && (
                  <motion.button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      setSemanticHits([]);
                      setActiveHitIndex(0);
                    }}
                    className="border-2 border-border bg-surface px-3 py-2 text-base font-bold sm:py-1.5 sm:text-sm"
                    aria-label="Clear search"
                    title="Clear search"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    whileHover={{ scale: 1.05, boxShadow: "2px 2px 0 var(--border)" }}
                    whileTap={{ scale: 0.95 }}
                    transition={{ duration: 0.12, ease: "easeOut" }}
                  >
                    ✕
                  </motion.button>
                )}
              </AnimatePresence>
            </form>

            {/* Semantic search results indicator */}
            <AnimatePresence mode="popLayout">
              {semanticHits.length > 0 && (
                <motion.div
                  className="mt-2 flex items-center justify-between gap-3 overflow-hidden text-xs text-foreground-muted"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{
                    height: { duration: 0.15, ease: "easeOut" },
                    opacity: { duration: 0.1 },
                  }}
                >
                  <span style={{ fontFamily: "var(--font-space-mono)" }}>
                    {`${semanticHits.length} match${semanticHits.length === 1 ? "" : "es"} • ${activeHitIndex + 1}/${semanticHits.length}`}
                  </span>

                  <div className="flex items-center gap-2">
                    <motion.button
                      type="button"
                      onClick={handlePrevHit}
                      disabled={semanticHits.length === 0}
                      className="border-2 border-border bg-surface px-2 py-1 font-bold disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Previous hit"
                      title="Previous hit"
                      whileHover={{ scale: 1.05, boxShadow: "2px 2px 0 var(--border)" }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                      Prev
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={handleNextHit}
                      disabled={semanticHits.length === 0}
                      className="border-2 border-border bg-surface px-2 py-1 font-bold disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Next hit"
                      title="Next hit"
                      whileHover={{ scale: 1.05, boxShadow: "2px 2px 0 var(--border)" }}
                      whileTap={{ scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    >
                      Next
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Transcript content - shows ~3 cues */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="relative max-h-[240px] overflow-y-auto bg-surface"
      >
        <div className="divide-y divide-border/30">
          {cues.map(cue => (
            <motion.div
              key={cue.id}
              ref={(el) => {
                if (el) {
                  cueRefs.current.set(cue.id, el);
                } else {
                  cueRefs.current.delete(cue.id);
                }
              }}
              onClick={() => handleCueClick(cue)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleCueClick(cue);
                }
              }}
              className="group relative flex cursor-pointer gap-4 overflow-hidden px-5 py-3"
              initial={false}
              animate={{
                backgroundColor: currentHit?.cueId === cue.id ?
                  "rgba(250, 204, 21, 0.2)" :
                  hitCueIdSet.has(cue.id) ?
                    "rgba(250, 204, 21, 0.08)" :
                    activeCue?.id === cue.id ?
                      "var(--surface-elevated)" :
                      "transparent",
              }}
              whileHover={{ backgroundColor: "var(--surface-elevated)" }}
              transition={{ duration: 0.2 }}
            >
              {/* Animated highlight bar */}
              <motion.div
                className="absolute inset-y-0 left-0 w-1"
                initial={false}
                animate={{
                  scaleY: currentHit?.cueId === cue.id ||
                    hitCueIdSet.has(cue.id) ||
                    activeCue?.id === cue.id ?
                    1 :
                    0,
                  backgroundColor: currentHit?.cueId === cue.id ?
                    "#facc15" :
                    hitCueIdSet.has(cue.id) ?
                      "rgba(250, 204, 21, 0.5)" :
                      activeCue?.id === cue.id ?
                        "var(--accent)" :
                        "transparent",
                  opacity: currentHit?.cueId === cue.id ? [1, 0.5, 1] : 1,
                }}
                transition={{
                  scaleY: { type: "spring", stiffness: 500, damping: 30 },
                  backgroundColor: { duration: 0.2 },
                  opacity: currentHit?.cueId === cue.id ?
                      { duration: 0.8, repeat: Infinity, ease: "easeInOut" } :
                      { duration: 0.2 },
                }}
                style={{ originY: 0.5 }}
              />

              {/* Timestamp */}
              <motion.span
                className="shrink-0 text-xs"
                style={{ fontFamily: "var(--font-space-mono)" }}
                initial={false}
                animate={{
                  color: activeCue?.id === cue.id ? "var(--accent)" : "var(--foreground-muted)",
                }}
                whileHover={{ color: "var(--accent)" }}
                transition={{ duration: 0.15 }}
              >
                {formatTime(cue.startTime)}
              </motion.span>

              {/* Text */}
              <p className="text-sm leading-relaxed text-foreground">
                {cue.text}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Empty state */}
        {cues.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <span className="mb-2 text-2xl">📝</span>
            <p className="text-sm text-foreground-muted">
              No transcript available for this video
            </p>
          </div>
        )}
      </div>

      {/* Jump to current CTA - shown when user has scrolled away */}
      <AnimatePresence>
        {showJumpButton && activeCue && (
          <motion.button
            type="button"
            onClick={handleJumpToCurrent}
            className="absolute bottom-4 left-1/2 z-10 flex items-center gap-2 border-3 border-border bg-accent px-4 py-2 text-sm font-bold text-foreground shadow-[4px_4px_0_var(--border)]"
            initial={{ opacity: 0, y: 20, x: "-50%", scale: 0.9 }}
            animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
            exit={{ opacity: 0, y: 10, x: "-50%", scale: 0.95 }}
            whileHover={{ y: -2, boxShadow: "6px 6px 0 var(--border)" }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 500, damping: 28 }}
          >
            <motion.svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              animate={{ rotate: scrollDirection === "down" ? 180 : 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <path
                strokeLinecap="square"
                strokeLinejoin="miter"
                d="M5 12l7-7 7 7M12 5v14"
              />
            </motion.svg>
            Jump to current
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SyncedTranscript - Player-connected wrapper
// ─────────────────────────────────────────────────────────────────────────────

export function SyncedTranscript({ cues, muxAssetId, title }: SyncedTranscriptProps) {
  const { currentTime, seekTo } = usePlayer();

  if (cues.length === 0) {
    return null;
  }

  return (
    <TranscriptPanel
      cues={cues}
      currentTime={currentTime}
      onSeek={seekTo}
      muxAssetId={muxAssetId}
      title={title}
    />
  );
}
