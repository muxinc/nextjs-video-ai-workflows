import Image from "next/image";
import Link from "next/link";

interface FooterProps {
  /** Whether to show the full footer with "Built with" section or minimal */
  variant?: "full" | "minimal";
}

export function Footer({ variant = "minimal" }: FooterProps) {
  if (variant === "full") {
    return (
      <footer className="mt-auto w-full">
        <div className="h-1 w-full bg-accent" />
        <div className="flex flex-col items-center gap-6 bg-background-dark px-6 py-10 text-center">
          <p
            className="text-xs tracking-widest text-foreground-light"
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            Built with
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8">
            {/* Mux Logo */}
            <a
              href="https://www.mux.com/"
              target="_blank"
              rel="noreferrer"
              aria-label="@mux/ai on GitHub"
              className="inline-flex items-center justify-center"
            >
              <Image
                src="/mux-logo-small-white.svg"
                alt="Mux"
                width={80}
                height={24}
                style={{ height: "24px", width: "auto" }}
              />
            </a>
            {/* Vercel Logo */}
            <a
              href="https://github.com/vercel/workflow"
              target="_blank"
              rel="noreferrer"
              aria-label="Vercel Workflow on GitHub"
              className="inline-flex items-center justify-center"
            >
              <Image
                src="/vercel.svg"
                alt="Vercel"
                width={76}
                height={20}
                style={{ height: "20px", width: "auto" }}
              />
            </a>
            {/* GitHub Logo */}
            <a
              href="https://github.com/muxinc/nextjs-video-ai-workflows"
              target="_blank"
              rel="noreferrer"
              aria-label="GitHub repository"
              className="inline-flex items-center justify-center text-white"
            >
              <svg
                className="h-6"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
              </svg>
            </a>
          </div>
          <p
            className="max-w-md text-xs leading-relaxed text-foreground-light/60"
            style={{ fontFamily: "var(--font-space-mono)" }}
          >
            Reference architecture for video intelligence pipelines
          </p>
        </div>
      </footer>
    );
  }

  // Minimal footer
  return (
    <footer className="mt-auto w-full">
      <div className="h-1 w-full bg-accent" />
      <div className="flex flex-col items-center gap-4 bg-background-dark px-6 py-8 text-center">
        <p
          className="text-xs tracking-widest text-foreground-light"
          style={{ fontFamily: "var(--font-space-mono)" }}
        >
          Reference architecture for video intelligence pipelines
        </p>
        <div className="flex items-center gap-6">
          <Link href="/" className="text-xs text-foreground-light/60 hover:text-white">
            Home
          </Link>
          <a
            href="https://github.com/muxinc/nextjs-try-workflows"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-foreground-light/60 hover:text-white"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
