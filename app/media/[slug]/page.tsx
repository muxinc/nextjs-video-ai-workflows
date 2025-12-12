import Link from "next/link";
import { notFound } from "next/navigation";

import { Footer } from "@/app/components/footer";
import { Header } from "@/app/components/header";
import {
  findTextTrack,
  getAsset,
  getReadyTextTracks,
  getTrackVtt,
} from "@/app/lib/mux";
import type { MuxAsset } from "@/app/lib/mux";

import { Level1SummaryAndTags } from "./level-1-summary";
import { MediaPlayerWithTranscript } from "./media-player-with-transcript";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface MediaDetailPageProps {
  params: Promise<{ slug: string }>;
}

interface ParsedVttCue {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function getPlaybackId(asset: MuxAsset): string | undefined {
  const playbackIds = asset.playback_ids || [];
  const publicId = playbackIds.find(pid => pid.policy === "public");
  return publicId?.id || playbackIds[0]?.id;
}

function getAssetTitle(asset: MuxAsset): string {
  const passthrough = asset.passthrough;
  if (passthrough) {
    try {
      const parsed = JSON.parse(passthrough);
      if (parsed.title)
        return parsed.title;
    } catch {
      if (passthrough.length > 0 && passthrough.length < 200) {
        return passthrough;
      }
    }
  }
  return `Talk ${asset.id.slice(0, 8)}`;
}

function formatDuration(seconds?: number): string {
  if (!seconds)
    return "";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Parses VTT timestamp to seconds.
 * Format: "00:00:00.000" or "00:00.000"
 */
function parseVttTime(timeStr: string): number {
  const parts = timeStr.split(":");
  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return (
      Number.parseInt(hours, 10) * 3600 +
      Number.parseInt(minutes, 10) * 60 +
      Number.parseFloat(seconds)
    );
  } else if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return Number.parseInt(minutes, 10) * 60 + Number.parseFloat(seconds);
  }
  return 0;
}

/**
 * Parses VTT content into structured cues.
 */
function parseVtt(vttContent: string): ParsedVttCue[] {
  const cues: ParsedVttCue[] = [];
  const lines = vttContent.split("\n");

  let i = 0;
  let cueIndex = 0;

  // Skip header
  while (i < lines.length && !lines[i].includes("-->")) {
    i++;
  }

  while (i < lines.length) {
    const line = lines[i].trim();

    // Look for timestamp line
    if (line.includes("-->")) {
      const [startStr, endStr] = line.split("-->").map(s => s.trim());
      const startTime = parseVttTime(startStr);
      const endTime = parseVttTime(endStr);

      // Collect text lines until empty line or next timestamp
      const textLines: string[] = [];
      i++;
      while (i < lines.length && lines[i].trim() !== "" && !lines[i].includes("-->")) {
        textLines.push(lines[i].trim());
        i++;
      }

      if (textLines.length > 0) {
        cues.push({
          id: `cue-${cueIndex++}`,
          startTime,
          endTime,
          text: textLines.join(" "),
        });
      }
    } else {
      i++;
    }
  }

  return cues;
}

// ─────────────────────────────────────────────────────────────────────────────
// Level Section Components
// ─────────────────────────────────────────────────────────────────────────────

function LevelSection({
  level,
  title,
  badge,
  badgeClass,
  description,
  children,
}: {
  level: number;
  title: string;
  badge: string;
  badgeClass: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="card-brutal p-6">
      {/* Level header */}
      <div className="mb-4 flex items-center gap-3">
        <span className={`badge ${badgeClass}`}>{badge}</span>
        <span
          className="text-xs text-foreground-muted"
          style={{ fontFamily: "var(--font-space-mono)" }}
        >
          LEVEL
          {" "}
          {level}
        </span>
      </div>

      {/* Title and description */}
      <h3
        className="mb-2 text-xl font-bold"
        style={{ fontFamily: "var(--font-syne)" }}
      >
        {title}
      </h3>
      <p className="mb-6 text-sm text-foreground-muted">{description}</p>

      {/* Content */}
      {children || (
        <div className="flex items-center gap-2 border-2 border-dashed border-border/50 bg-surface-elevated/50 px-4 py-8 text-center">
          <span className="mx-auto text-sm text-foreground-muted">
            Coming soon — this section will be implemented next
          </span>
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default async function MediaDetailPage({ params }: MediaDetailPageProps) {
  const { slug } = await params;

  // For now, slug is the asset ID
  // TODO: Replace with proper slug lookup when database is available
  let asset: MuxAsset;
  try {
    asset = await getAsset(slug);
  } catch {
    notFound();
  }

  // Get playback ID for the player
  const playbackId = getPlaybackId(asset);
  if (!playbackId) {
    notFound();
  }

  // Get asset metadata
  const title = getAssetTitle(asset);
  const duration = formatDuration(asset.duration);

  // Get text tracks for transcript
  const textTracks = getReadyTextTracks(asset);
  const primaryTextTrack = findTextTrack(asset, "en") || textTracks[0];

  // Fetch transcript if available
  let transcriptCues: ParsedVttCue[] = [];
  if (primaryTextTrack?.id) {
    try {
      const vttContent = await getTrackVtt(playbackId, primaryTextTrack.id);
      transcriptCues = parseVtt(vttContent);
    } catch {
      // Transcript not available - that's okay
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header currentPath="/media" />

      <main className="flex-1 px-6 py-12">
        <div className="mx-auto max-w-7xl">
          {/* Page Header */}
          <div className="mb-8">
            <Link
              href="/media"
              className="mb-4 inline-flex items-center gap-2 text-sm text-foreground-muted transition-colors hover:text-foreground"
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
              Back to talks
            </Link>

            <h1
              className="mb-2 text-3xl font-extrabold tracking-tight md:text-4xl"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              {title}
            </h1>

            {duration && (
              <p
                className="text-sm text-foreground-muted"
                style={{ fontFamily: "var(--font-space-mono)" }}
              >
                Duration:
                {" "}
                {duration}
              </p>
            )}
          </div>

          {/* Player + Transcript Row */}
          <div className="mb-8">
            <MediaPlayerWithTranscript
              playbackId={playbackId}
              title={title}
              transcriptCues={transcriptCues}
              accentColor="#ff6101"
            />
          </div>

          {/* Level Sections: Two-column on desktop */}
          <div className="grid items-start gap-8 lg:grid-cols-2 xl:grid-cols-3">
            {/* Level 1: Sync Call */}
            <LevelSection
              level={1}
              title="Generate Summary & Tags"
              badge="SYNC CALL"
              badgeClass="badge-sync"
              description="Simply call @mux/ai directly from server-side code with minimal workflow infrastructure. Extracts title, summary, and tags from storyboard and transcript."
            >
              <Level1SummaryAndTags assetId={asset.id} />
            </LevelSection>

            {/* Level 2: Basic Async Workflows */}
            <LevelSection
              level={2}
              title="Translate Captions & Audio"
              badge="ASYNC WORKFLOW"
              badgeClass="badge-async"
              description="Invoke @mux/ai primitives and workflows within a Vercel Workflow to add translated captions or dubbed audio tracks."
            />

            {/* Level 3: Custom Workflow */}
            <LevelSection
              level={3}
              title="Create Social Clip"
              badge="CUSTOM WORKFLOW"
              badgeClass="badge-custom"
              description="Compose multiple @mux/ai primitives and workflows with external tools like Remotion to build complex video processing pipelines. Create shareable clips with translated captions and dubbed audio."
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
