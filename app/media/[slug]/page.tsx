import { notFound } from "next/navigation";

import { Footer } from "@/app/components/footer";
import { Header } from "@/app/components/header";
import { getPlaybackIdForAsset } from "@/app/lib/mux";
import { createClient } from "@/app/lib/supabase/server";
import type { TranscriptCue } from "@/app/media/types";
import { getVideoTitle } from "@/app/media/utils";

import { MediaContent } from "./media-content";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface MediaDetailPageProps {
  params: Promise<{ slug: string }>;
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
function parseVtt(vttContent: string): TranscriptCue[] {
  const cues: TranscriptCue[] = [];
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
// Page Component
// ─────────────────────────────────────────────────────────────────────────────

export default async function MediaDetailPage({ params }: MediaDetailPageProps) {
  const { slug } = await params;

  // Slug is the mux_asset_id - fetch video metadata from Supabase
  const supabase = await createClient();
  const { data: video } = await supabase
    .from("videos")
    .select()
    .eq("mux_asset_id", slug)
    .single();

  if (!video) {
    notFound();
  }

  // Fetch playback ID from Mux
  let playbackId: string;
  try {
    const result = await getPlaybackIdForAsset(slug);
    playbackId = result.playbackId;
  } catch {
    notFound();
  }

  // Get video metadata
  const title = getVideoTitle(video);

  // Parse transcript from Supabase VTT
  const transcriptCues: TranscriptCue[] = video.transcript_en_vtt ?
      parseVtt(video.transcript_en_vtt) :
      [];

  return (
    <div className="flex min-h-screen flex-col">
      <Header currentPath="/media" />

      <main className="flex-1 px-4 py-8 md:px-6 md:py-12">
        <div className="mx-auto max-w-7xl">
          {/* Main content */}
          <MediaContent
            playbackId={playbackId}
            muxAssetId={video.mux_asset_id}
            title={title}
            transcriptCues={transcriptCues}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
