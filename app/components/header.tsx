import Link from "next/link";

import { SearchForm } from "./search-form";

interface HeaderProps {
  /** Current page path for active state highlighting */
  currentPath?: string;
}

export function Header({ currentPath }: HeaderProps) {
  const showBrowse = currentPath !== "/";
  const showSearch = currentPath && currentPath !== "/";

  return (
    <header className="border-b-3 border-border bg-surface px-6 py-4">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-5">
        <div className="flex items-start gap-4 md:items-center">
          <Link
            href="/"
            className="flex min-w-0 flex-1 flex-col gap-1 leading-none md:flex-row md:items-baseline md:gap-2"
          >
            <h1
              className="text-xl font-extrabold leading-none tracking-[0.08em]"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              @mux/ai
            </h1>
            <span
              className="text-sm font-bold leading-none tracking-[0.08em]"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              workflows demo
            </span>
          </Link>

          {showBrowse && (
            <nav className="shrink-0 md:hidden">
              <Link
                href="/media"
                className="flex items-center gap-1 border-3 border-border bg-accent px-5 py-2 text-sm font-bold uppercase tracking-wider shadow-[3px_3px_0_var(--border)] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_var(--border)]"
                style={{ fontFamily: "var(--font-space-mono)" }}
              >
                Browse
              </Link>
            </nav>
          )}
        </div>

        {showSearch && (
          <div className="md:flex-1 md:px-2">
            <SearchForm />
          </div>
        )}

        {showBrowse && (
          <nav className="hidden shrink-0 md:block">
            <Link
              href="/media"
              className="flex items-center gap-1 border-3 border-border bg-accent px-5 py-2 text-sm font-bold uppercase tracking-wider shadow-[3px_3px_0_var(--border)] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[5px_5px_0_var(--border)]"
              style={{ fontFamily: "var(--font-space-mono)" }}
            >
              Browse
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
