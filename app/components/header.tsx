import Link from "next/link";

import { SearchForm } from "./search-form";

interface HeaderProps {
  /** Current page path for active state highlighting */
  currentPath?: string;
}

export function Header({ currentPath }: HeaderProps) {
  const showSearch = currentPath && currentPath !== "/";

  return (
    <header className="border-b-3 border-border bg-surface px-6 py-4">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        {/* Top row: Logo and nav */}
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3">
            <h1
              className="text-xl font-extrabold tracking-[0.15em]"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              DEMU
              <span className="inline-block -rotate-12 scale-110">X</span>
              ED
            </h1>
            <span
              className="text-[10px] tracking-[0.2em] text-foreground-muted"
              style={{ fontFamily: "var(--font-space-mono)" }}
            >
              STUDIO
            </span>
          </Link>

          {/* Search bar - desktop: inline */}
          {showSearch && (
            <div className="hidden flex-1 justify-center md:flex">
              <SearchForm />
            </div>
          )}

          <nav className="flex items-center gap-4">
            <Link
              href="/media"
              className={`border-2 border-border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_var(--border)] ${
                currentPath === "/media" || currentPath === "/search" ?
                  "bg-foreground text-surface" :
                  "bg-surface text-foreground"
              }`}
              style={{ fontFamily: "var(--font-space-mono)" }}
            >
              Browse
            </Link>
          </nav>
        </div>

        {/* Search bar - mobile: full width below */}
        {showSearch && (
          <div className="md:hidden">
            <SearchForm />
          </div>
        )}
      </div>
    </header>
  );
}
