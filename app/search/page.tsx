import Image from "next/image";
import Link from "next/link";

import { Footer } from "@/app/components/footer";
import { Header } from "@/app/components/header";
import { searchVideoChunks } from "@/app/lib/supabase/search";
import type { VideoChunkResult } from "@/app/lib/supabase/search";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

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
// Components
// ─────────────────────────────────────────────────────────────────────────────

function SearchResult({ result }: { result: VideoChunkResult }) {
  const hasTimestamp = result.start_time !== null;
  const timestampParam = hasTimestamp ? `?t=${Math.floor(result.start_time!)}` : "";

  return (
    <Link
      href={`/media/${result.mux_asset_id}${timestampParam}`}
      className="group block"
    >
      <article className="card-brutal flex gap-4 overflow-hidden p-4 transition-transform duration-100 group-hover:-translate-x-1 group-hover:-translate-y-1 group-hover:shadow-[6px_6px_0_var(--border)]">
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
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {/* Title */}
          <h3 className="line-clamp-1 font-bold leading-tight group-hover:text-accent">
            {result.title || `Video ${result.video_id.slice(0, 8)}`}
          </h3>

          {/* Chunk text (transcript excerpt) */}
          <p className="line-clamp-2 text-sm text-foreground-muted">
            {result.chunk_text}
          </p>

          {/* Topics */}
          {result.parent_video_topics && result.parent_video_topics.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {result.parent_video_topics.slice(0, 3).map(topic => (
                <span
                  key={topic}
                  className="border border-border bg-surface-elevated px-1.5 py-0.5 text-[10px] text-foreground-muted"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}

          {/* Similarity score */}
          <div
            className="mt-auto text-[10px] text-foreground-muted"
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            {(result.similarity_score * 100).toFixed(1)}
            % match
          </div>
        </div>
      </article>
    </Link>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <div className="card-brutal mx-auto max-w-md p-12 text-center">
      <div className="mb-6 text-6xl">🔍</div>
      <h3 className="mb-3 text-xl font-bold">No results found</h3>
      <p className="text-foreground-muted">
        No video chunks matched &quot;
        {query}
        &quot;. Try a different search term.
      </p>
    </div>
  );
}

function NoQuery() {
  return (
    <div className="card-brutal mx-auto max-w-md p-12 text-center">
      <div className="mb-6 text-6xl">💡</div>
      <h3 className="mb-3 text-xl font-bold">Search for anything</h3>
      <p className="text-foreground-muted">
        Use the search bar above to find specific moments in videos using natural language.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const query = params.q?.trim() || "";

  // Perform search if query is provided
  let results: VideoChunkResult[] = [];
  let error: string | null = null;

  if (query) {
    try {
      results = await searchVideoChunks(query, 20);
    } catch (e) {
      console.error("Search error:", e);
      error = "An error occurred while searching. Please try again.";
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header currentPath="/search" />

      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-4xl">
          {/* Page Header */}
          <div className="mb-8">
            <h2
              className="mb-4 text-3xl font-extrabold tracking-tight md:text-4xl"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              {query ? `Results for "${query}"` : "Search Videos"}
            </h2>
            {query && results.length > 0 && (
              <p className="text-foreground-muted">
                Found
                {" "}
                {results.length}
                {" "}
                matching moment
                {results.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          {/* Error state */}
          {error && (
            <div className="mb-8 border-3 border-red-500 bg-red-50 p-4 text-red-700">
              {error}
            </div>
          )}

          {/* Results */}
          {query ?
              (
                results.length > 0 ?
                    (
                      <div className="flex flex-col gap-4">
                        {results.map(result => (
                          <SearchResult key={result.chunk_id} result={result} />
                        ))}
                      </div>
                    ) :
                    !error && <EmptyState query={query} />
              ) :
              (
                <NoQuery />
              )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

