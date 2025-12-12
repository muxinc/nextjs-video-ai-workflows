"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

export function TranscriptPanel({ cues, currentTime = 0, onSeek }: TranscriptPanelProps) {
  const [showJumpButton, setShowJumpButton] = useState(false);
  const [scrollDirection, setScrollDirection] = useState<"up" | "down">("up");
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

  return (
    <div className="card-brutal relative flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="flex shrink-0 items-center border-b-3 border-border bg-surface-elevated px-5 py-4">
        <span
          className="text-lg font-bold"
          style={{ fontFamily: "var(--font-syne)" }}
        >
          Transcript
        </span>
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
              className={`group flex cursor-pointer gap-4 px-5 py-3 transition-colors hover:bg-surface-elevated ${
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
