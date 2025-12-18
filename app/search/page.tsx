import { Footer } from "@/app/components/footer";
import { Header } from "@/app/components/header";
import { recordMetric } from "@/app/lib/metrics";
import { SearchRateLimitError, searchVideoChunks } from "@/db/search";
import type { VideoChunkResult } from "@/db/search";

import { SearchResults } from "./search-results";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

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
      // Record search metric
      void recordMetric("semantic-search-nav", { query });

      results = await searchVideoChunks(query, 20);
    } catch (e) {
      if (e instanceof SearchRateLimitError) {
        error = e.message;
      } else {
        console.error("Search error:", e);
        error = "An error occurred while searching. Please try again.";
      }
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
                      <SearchResults query={query} results={results} />
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
