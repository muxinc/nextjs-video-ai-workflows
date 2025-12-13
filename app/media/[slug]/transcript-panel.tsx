"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import { searchTranscript } from "./transcript-actions";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TranscriptCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

interface TranscriptPanelProps {
  cues: TranscriptCue[];
  currentTime?: number;
  onSeek?: (time: number) => void;
  muxAssetId?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function TranscriptPanel({ cues, currentTime = 0, onSeek, muxAssetId }: TranscriptPanelProps) {
  const [showJumpButton, setShowJumpButton] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<"up" | "down">("up");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, startSearchTransition] = useTransition();
  const [activeHitIndex, setActiveHitIndex] = useState(-1);
  const [semanticHighlightedCueId, setSemanticHighlightedCueId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cueRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const isAutoScrollingRef = useRef(false);
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastActiveCueIdRef = useRef<string | null>(null);

  // Find the currently active cue based on playback time
  const activeCue = cues.find(
    cue => currentTime >= cue.startTime && currentTime < cue.endTime,
  );

  // Scroll to the active cue
  const scrollToActiveCue = useCallback(() => {
    if (!activeCue || !containerRef.current)
      return;

    const cueElement = cueRefs.current.get(activeCue.id);
    if (!cueElement)
      return;

    isAutoScrollingRef.current = true;

    cueElement.scrollIntoView({
      behavior: "smooth",
      block: "center",
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

    // Determine scroll direction relative to active cue
    if (activeCue && containerRef.current) {
      const cueElement = cueRefs.current.get(activeCue.id);
      if (cueElement) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const cueRect = cueElement.getBoundingClientRect();

        // If the cue is below the visible area, arrow should point down
        // If the cue is above the visible area, arrow should point up
        if (cueRect.top > containerRect.bottom) {
          setScrollDirection("down");
        } else if (cueRect.bottom < containerRect.top) {
          setScrollDirection("up");
        }
      }
    }

    // User has manually scrolled - show the jump button
    setShowJumpButton(true);
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

  const hitCueIds = useMemo(() => {
    if (!normalizedQuery) return [];
    return cues
      .filter(cue => cue.text.toLowerCase().includes(normalizedQuery))
      .map(cue => cue.id);
  }, [cues, normalizedQuery]);

  const hitCueIdSet = useMemo(() => new Set(hitCueIds), [hitCueIds]);

  const activeHitCueId = hitCueIds[activeHitIndex] ?? null;

  // Keep active hit index in sync with query changes
  useEffect(() => {
    if (!normalizedQuery) {
      setActiveHitIndex(-1);
      setSemanticHighlightedCueId(null);
      return;
    }

    // If we have hits and no active hit yet, default to the first.
    // If the active index is out of bounds, clamp it.
    if (hitCueIds.length === 0) {
      setActiveHitIndex(-1);
    } else if (activeHitIndex === -1) {
      setActiveHitIndex(0);
    } else if (activeHitIndex >= hitCueIds.length) {
      setActiveHitIndex(hitCueIds.length - 1);
    }
  }, [activeHitIndex, hitCueIds.length, normalizedQuery]);

  // Clear semantic highlight after a delay
  useEffect(() => {
    if (semanticHighlightedCueId) {
      const timeout = setTimeout(() => {
        setSemanticHighlightedCueId(null);
      }, 3000);
      return () => clearTimeout(timeout);
    }
  }, [semanticHighlightedCueId]);

  // Find the cue that contains or is closest to a given time
  const findCueByTime = useCallback((targetTime: number): TranscriptCue | null => {
    // First, try to find a cue that contains the time
    const containingCue = cues.find(
      cue => targetTime >= cue.startTime && targetTime < cue.endTime,
    );
    if (containingCue) return containingCue;

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
    // Behave like manual scrolling: pause auto-follow and show the jump-to-current CTA
    setShowJumpButton(true);
    isAutoScrollingRef.current = true;

    const cueElement = cueRefs.current.get(targetCue.id);
    if (cueElement) {
      cueElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }

    // Reset auto-scrolling flag
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      isAutoScrollingRef.current = false;
    }, 600);
  }, []);

  const goToHitIndex = useCallback((nextIndex: number) => {
    const targetCueId = hitCueIds[nextIndex];
    const targetCue = cues.find(cue => cue.id === targetCueId);
    if (!targetCue) return;
    setActiveHitIndex(nextIndex);
    scrollToCue(targetCue);
  }, [cues, hitCueIds, scrollToCue]);

  const handlePrevHit = useCallback(() => {
    if (hitCueIds.length === 0) return;
    const nextIndex = activeHitIndex <= 0 ? hitCueIds.length - 1 : activeHitIndex - 1;
    goToHitIndex(nextIndex);
  }, [activeHitIndex, goToHitIndex, hitCueIds.length]);

  const handleNextHit = useCallback(() => {
    if (hitCueIds.length === 0) return;
    const nextIndex = activeHitIndex === -1 || activeHitIndex >= hitCueIds.length - 1 ? 0 : activeHitIndex + 1;
    goToHitIndex(nextIndex);
  }, [activeHitIndex, goToHitIndex, hitCueIds.length]);

  // Handle transcript search
  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!normalizedQuery) return;

    // Prefer literal hits (client-side), fallback to semantic (server) search
    if (hitCueIds.length > 0) {
      handleNextHit();
      return;
    }

    if (!muxAssetId) return;

    startSearchTransition(async () => {
      const result = await searchTranscript(searchQuery, muxAssetId);

      if (result) {
        // Find the cue closest to the result's start time
        const targetCue = findCueByTime(result.startTime);

        if (targetCue) {
          // Temporarily highlight the found cue
          setSemanticHighlightedCueId(targetCue.id);
          scrollToCue(targetCue);
        }
      }
    });
  }, [findCueByTime, handleNextHit, hitCueIds.length, muxAssetId, normalizedQuery, scrollToCue, searchQuery]);

  return (
    <div className="card-brutal relative flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 flex-col gap-3 border-b-3 border-border bg-surface-elevated px-5 py-4">
        <span
          className="text-lg font-bold"
          style={{ fontFamily: "var(--font-syne)" }}
        >
          Transcript
        </span>

        {/* Search input */}
        {muxAssetId && (
          <div className="flex flex-col gap-2">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                }}
                placeholder="Search transcript..."
                className="flex-1 border-2 border-border bg-surface px-3 py-1.5 text-sm placeholder:text-foreground-muted focus:outline-none focus:ring-2 focus:ring-accent"
                style={{ fontFamily: "var(--font-space-mono)" }}
              />
              <button
                type="submit"
                disabled={isSearching || !normalizedQuery}
                className="border-2 border-border bg-accent px-3 py-1.5 text-sm font-bold transition-all hover:shadow-[2px_2px_0_var(--border)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Find next"
                title="Find next"
              >
                {isSearching ? (
                  <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="square" strokeLinejoin="miter" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </button>
              {normalizedQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="border-2 border-border bg-surface px-3 py-1.5 text-sm font-bold transition-all hover:shadow-[2px_2px_0_var(--border)]"
                  aria-label="Clear search"
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </form>

            {/* Hit UI (only when there is a query) */}
            {normalizedQuery && (
              <div className="flex items-center justify-between gap-3 text-xs text-foreground-muted">
                <span style={{ fontFamily: "var(--font-space-mono)" }}>
                  {hitCueIds.length === 0 ?
                    "No hits" :
                    `${hitCueIds.length} hit${hitCueIds.length === 1 ? "" : "s"} • ${Math.max(activeHitIndex, 0) + 1}/${hitCueIds.length}`}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePrevHit}
                    disabled={hitCueIds.length === 0}
                    className="border-2 border-border bg-surface px-2 py-1 font-bold transition-all hover:shadow-[2px_2px_0_var(--border)] disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Previous hit"
                    title="Previous hit"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={handleNextHit}
                    disabled={hitCueIds.length === 0}
                    className="border-2 border-border bg-surface px-2 py-1 font-bold transition-all hover:shadow-[2px_2px_0_var(--border)] disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Next hit"
                    title="Next hit"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Transcript content */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="relative max-h-80 overflow-y-auto bg-surface lg:max-h-96"
      >
        <div className="divide-y divide-border/30">
          {cues.map(cue => (
            <div
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
              className={`group flex cursor-pointer gap-4 px-5 py-3 transition-all hover:bg-surface-elevated ${
                semanticHighlightedCueId === cue.id ?
                  "animate-pulse border-l-4 border-yellow-400 bg-yellow-400/20" :
                activeHitCueId === cue.id ?
                  "border-l-4 border-yellow-400 bg-yellow-400/10" :
                hitCueIdSet.has(cue.id) ?
                  "border-l-4 border-yellow-400/50 bg-yellow-400/5" :
                activeCue?.id === cue.id ?
                  "border-l-4 border-accent bg-surface-elevated" :
                  ""
              }`}
            >
              {/* Timestamp */}
              <span
                className={`shrink-0 text-xs transition-colors group-hover:text-accent ${
                  activeCue?.id === cue.id ?
                    "text-accent" :
                    "text-foreground-muted"
                }`}
                style={{ fontFamily: "var(--font-space-mono)" }}
              >
                {formatTime(cue.startTime)}
              </span>

              {/* Text */}
              <p className="text-sm leading-relaxed text-foreground">
                {cue.text}
              </p>
            </div>
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
      {showJumpButton && activeCue && (
        <button
          type="button"
          onClick={handleJumpToCurrent}
          className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 border-3 border-border bg-accent px-4 py-2 text-sm font-bold text-foreground shadow-[4px_4px_0_var(--border)] transition-all hover:-translate-x-1/2 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--border)]"
        >
          <svg
            className={`h-4 w-4 ${scrollDirection === "down" ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="square"
              strokeLinejoin="miter"
              d="M5 12l7-7 7 7M12 5v14"
            />
          </svg>
          Jump to current
        </button>
      )}
    </div>
  );
}
