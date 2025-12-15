import { asc, count as drizzleCount } from "drizzle-orm";
import Link from "next/link";

import { Footer } from "@/app/components/footer";
import { Header } from "@/app/components/header";
import { getPlaybackIdForAsset } from "@/app/lib/mux";
import { TalkCard } from "@/app/media/talk-card";
import { getVideoTitle } from "@/app/media/utils";
import { db, videos } from "@/db";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 6;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

interface MediaPageProps {
  searchParams: Promise<{ page?: string }>;
}

/**
 * Generates an array of page numbers with ellipses for smart pagination display.
 * Shows first page, last page, and a window around the current page.
 */
function getPageNumbers(currentPage: number, totalPages: number): (number | "...")[] {
  const delta = 2; // Number of pages to show on each side of current page
  const pages: (number | "...")[] = [];

  // Always show first page
  pages.push(1);

  // Calculate the range around current page
  const rangeStart = Math.max(2, currentPage - delta);
  const rangeEnd = Math.min(totalPages - 1, currentPage + delta);

  // Add ellipsis after first page if needed
  if (rangeStart > 2) {
    pages.push("...");
  }

  // Add pages in the range
  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i);
  }

  // Add ellipsis before last page if needed
  if (rangeEnd < totalPages - 1) {
    pages.push("...");
  }

  // Always show last page (if more than 1 page)
  if (totalPages > 1) {
    pages.push(totalPages);
  }

  return pages;
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

function Pagination({ currentPage, totalPages, totalItems }: PaginationProps) {
  const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
  const endItem = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

  return (
    <div className="mt-12 flex flex-col items-center gap-6 border-t-2 border-border pt-6">
      {/* Page info */}
      <p
        className="text-sm text-foreground-muted"
        style={{ fontFamily: "var(--font-space-mono)" }}
      >
        Showing
        {" "}
        {startItem}
        –
        {endItem}
        {" "}
        of
        {" "}
        {totalItems}
        {" "}
        talk
        {totalItems !== 1 ? "s" : ""}
      </p>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          {/* Previous button */}
          {currentPage > 1 ?
              (
                <Link
                  href={`/media?page=${currentPage - 1}`}
                  className="btn-outlined flex items-center gap-2 px-4 py-2 text-sm"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="square" strokeLinejoin="miter" d="M15 19l-7-7 7-7" />
                  </svg>
                  Prev
                </Link>
              ) :
              (
                <span className="flex cursor-not-allowed items-center gap-2 border-3 border-border bg-surface px-4 py-2 text-sm text-foreground-muted opacity-50">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="square" strokeLinejoin="miter" d="M15 19l-7-7 7-7" />
                  </svg>
                  Prev
                </span>
              )}

          {/* Page numbers with smart truncation */}
          <div
            className="flex items-center gap-1 px-4 text-sm"
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            {getPageNumbers(currentPage, totalPages).map((page, idx) => {
              // Use position-based key: ellipsis can only appear in 2 spots (after first, before last)
              const key = page === "..." ? `ellipsis-${idx < 3 ? "start" : "end"}` : `page-${page}`;
              return page === "..." ?
                  (
                    <span
                      key={key}
                      className="flex h-10 w-10 items-center justify-center text-foreground-muted"
                    >
                      …
                    </span>
                  ) :
                  (
                    <Link
                      key={key}
                      href={`/media?page=${page}`}
                      className={`flex h-10 w-10 items-center justify-center border-2 border-border transition-colors ${
                        page === currentPage ?
                          "bg-foreground text-surface" :
                          "bg-surface hover:bg-surface-elevated"
                      }`}
                    >
                      {page}
                    </Link>
                  );
            })}
          </div>

          {/* Next button */}
          {currentPage < totalPages ?
              (
                <Link
                  href={`/media?page=${currentPage + 1}`}
                  className="btn-outlined flex items-center gap-2 px-4 py-2 text-sm"
                >
                  Next
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="square" strokeLinejoin="miter" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ) :
              (
                <span className="flex cursor-not-allowed items-center gap-2 border-3 border-border bg-surface px-4 py-2 text-sm text-foreground-muted opacity-50">
                  Next
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="square" strokeLinejoin="miter" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              )}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card-brutal mx-auto max-w-md p-12 text-center">
      <div className="mb-6 text-6xl">📼</div>
      <h3 className="mb-3 text-xl font-bold">No talks found</h3>
      <p className="mb-6 text-foreground-muted">
        Make sure your Mux account has video assets with public playback IDs.
      </p>
      <a
        href="https://dashboard.mux.com"
        target="_blank"
        rel="noreferrer"
        className="btn-outlined inline-block"
      >
        Open Mux Dashboard
      </a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default async function MediaPage({ searchParams }: MediaPageProps) {
  // Parse page from search params
  const params = await searchParams;
  const currentPage = Math.max(1, Number.parseInt(params.page || "1", 10) || 1);

  // Calculate offset for server-side pagination
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

  // Fetch paginated videos from database with total count
  const [paginatedVideos, [{ count }]] = await Promise.all([
    db.select().from(videos).orderBy(asc(videos.createdAt)).limit(ITEMS_PER_PAGE).offset(startIndex),
    db.select({ count: drizzleCount() }).from(videos),
  ]);

  const videoList = paginatedVideos ?? [];
  const totalItems = count ?? 0;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const validPage = Math.min(currentPage, Math.max(1, totalPages));

  // Fetch playback IDs from Mux for current page videos only (in parallel)
  const playbackResults = await Promise.all(
    videoList.map(async (video) => {
      try {
        const result = await getPlaybackIdForAsset(video.muxAssetId);
        return result.playbackId;
      } catch {
        return null;
      }
    }),
  );

  // Create a map of muxAssetId -> playbackId for easy lookup
  const playbackIdMap = new Map<string, string | null>();
  videoList.forEach((video, index) => {
    playbackIdMap.set(video.muxAssetId, playbackResults[index]);
  });

  return (
    <div className="flex min-h-screen flex-col">
      <Header currentPath="/media" />

      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-6xl">
          {/* Page Header */}
          <div className="mb-12">
            <h2
              className="mb-4 text-4xl font-extrabold tracking-tight md:text-5xl"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              Browse Talks
            </h2>
            <p className="max-w-2xl text-lg text-foreground-muted">
              Pick a talk to explore sync calls, async workflows, and custom pipelines.
              Each video demonstrates the three integration levels.
            </p>
          </div>

          {/* Video Grid */}
          {videoList.length > 0 ?
              (
                <>
                  <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                    {videoList.map(video => (
                      <TalkCard
                        key={video.id}
                        slug={video.muxAssetId}
                        title={getVideoTitle(video)}
                        playbackId={playbackIdMap.get(video.muxAssetId) ?? null}
                        tags={video.tags ?? []}
                      />
                    ))}
                  </div>

                  {/* Pagination */}
                  <Pagination
                    currentPage={validPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                  />
                </>
              ) :
              (
                <EmptyState />
              )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
