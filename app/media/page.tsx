import Image from "next/image";
import Link from "next/link";

import { Footer } from "@/app/components/footer";
import { Header } from "@/app/components/header";
import { listAssets, type MuxAsset } from "@/app/lib/mux";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ITEMS_PER_PAGE = 6;

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface TalkCardProps {
  asset: MuxAsset;
}

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
}

interface MediaPageProps {
  searchParams: Promise<{ page?: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function getPlaybackId(asset: MuxAsset): string | undefined {
  const playbackIds = asset.playback_ids || [];
  const publicId = playbackIds.find(pid => pid.policy === "public");
  return publicId?.id || playbackIds[0]?.id;
}

function getThumbnailUrl(playbackId: string): string {
  return `https://image.mux.com/${playbackId}/thumbnail.webp?width=640&height=360&fit_mode=smartcrop`;
}

function getAssetTitle(asset: MuxAsset): string {
  // TODO: Replace with AI-generated title from Level 1 when available
  // For now, use passthrough metadata or fallback to a formatted ID
  const passthrough = asset.passthrough;
  if (passthrough) {
    try {
      const parsed = JSON.parse(passthrough);
      if (parsed.title) return parsed.title;
    } catch {
      // passthrough is a plain string, use it as title
      if (passthrough.length > 0 && passthrough.length < 200) {
        return passthrough;
      }
    }
  }
  return `Talk ${asset.id.slice(0, 8)}`;
}

function getAssetSlug(asset: MuxAsset): string {
  // Use the asset ID as the slug for now
  // TODO: Replace with proper slug from database when available
  return asset.id;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(createdAt?: number): string {
  if (!createdAt) return "";
  // Mux returns created_at as Unix timestamp in seconds
  const date = new Date(createdAt * 1000);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short" });
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

function TalkCard({ asset }: TalkCardProps) {
  const playbackId = getPlaybackId(asset);
  const title = getAssetTitle(asset);
  const slug = getAssetSlug(asset);
  const duration = formatDuration(asset.duration);
  const dateStr = formatDate(asset.created_at);

  // TODO: Add AI-generated tags from Level 1 when available
  const tags: string[] = [];

  return (
    <Link href={`/media/${slug}`} className="group block">
      <article className="card-brutal overflow-hidden transition-transform duration-100 group-hover:-translate-x-1 group-hover:-translate-y-1 group-hover:shadow-[8px_8px_0_var(--border)]">
        {/* Thumbnail */}
        <div className="relative aspect-video w-full overflow-hidden bg-background-dark">
          {playbackId ? (
            <Image
              src={getThumbnailUrl(playbackId)}
              alt={title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-foreground-muted">No preview</span>
            </div>
          )}
          {/* Duration badge */}
          {duration && (
            <div
              className="absolute bottom-2 right-2 bg-background-dark/90 px-2 py-1 text-xs font-bold text-white"
              style={{ fontFamily: "var(--font-space-mono)" }}
            >
              {duration}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col gap-3 p-5">
          {/* Title */}
          <h3 className="line-clamp-2 text-lg font-bold leading-tight group-hover:text-accent">
            {title}
          </h3>

          {/* Meta info */}
          {dateStr && (
            <p
              className="text-xs text-foreground-muted"
              style={{ fontFamily: "var(--font-space-mono)" }}
            >
              {dateStr}
            </p>
          )}

          {/* Tags (when AI-generated) */}
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tags.slice(0, 3).map(tag => (
                <span
                  key={tag}
                  className="border border-border bg-surface-elevated px-2 py-0.5 text-xs text-foreground-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* View CTA */}
          <div
            className="mt-2 flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-foreground-muted transition-colors group-hover:text-accent"
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            View talk
            <svg
              className="h-3 w-3 transition-transform group-hover:translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="square" strokeLinejoin="miter" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </article>
    </Link>
  );
}

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
        Showing {startItem}–{endItem} of {totalItems} talk{totalItems !== 1 ? "s" : ""}
      </p>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          {/* Previous button */}
          {currentPage > 1 ? (
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
          ) : (
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

          {/* Page numbers */}
          <div
            className="flex items-center gap-1 px-4 text-sm"
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Link
                key={page}
                href={`/media?page=${page}`}
                className={`flex h-10 w-10 items-center justify-center border-2 border-border transition-colors ${
                  page === currentPage
                    ? "bg-foreground text-surface"
                    : "bg-surface hover:bg-surface-elevated"
                }`}
              >
                {page}
              </Link>
            ))}
          </div>

          {/* Next button */}
          {currentPage < totalPages ? (
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
          ) : (
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

  // Fetch assets from Mux - only show ready assets
  const assetsResponse = await listAssets();
  const allAssets = assetsResponse.data?.filter(asset => asset.status === "ready") || [];

  // Calculate pagination
  const totalItems = allAssets.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const validPage = Math.min(currentPage, Math.max(1, totalPages));

  // Get assets for current page
  const startIndex = (validPage - 1) * ITEMS_PER_PAGE;
  const paginatedAssets = allAssets.slice(startIndex, startIndex + ITEMS_PER_PAGE);

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

          {/* Asset Grid */}
          {paginatedAssets.length > 0 ? (
            <>
              <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
                {paginatedAssets.map(asset => (
                  <TalkCard key={asset.id} asset={asset} />
                ))}
              </div>

              {/* Pagination */}
              <Pagination
                currentPage={validPage}
                totalPages={totalPages}
                totalItems={totalItems}
              />
            </>
          ) : (
            <EmptyState />
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
