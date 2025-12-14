import { notFound } from "next/navigation";

import { Footer } from "@/app/components/footer";
import { Header } from "@/app/components/header";
import { getPlaybackIdForAsset } from "@/app/lib/mux";
import { createClient } from "@/app/lib/supabase/server";
import { getVideoTitle } from "@/app/media/utils";

import { MediaContent } from "./media-content";
import { parseVtt } from "./transcript/helpers";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface MediaDetailPageProps {
  params: Promise<{ slug: string }>;
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
  const transcriptCues = video.transcript_en_vtt ?
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
