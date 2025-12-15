import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";

import { Footer } from "@/app/components/footer";
import { Header } from "@/app/components/header";
import { env } from "@/app/lib/env";
import { getPlaybackIdForAsset } from "@/app/lib/mux";
import { getVideoTitle } from "@/app/media/utils";
import { db, videos } from "@/db";

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

  // Slug is the mux_asset_id - fetch video metadata from database
  const [video] = await db
    .select()
    .from(videos)
    .where(eq(videos.muxAssetId, slug))
    .limit(1);

  if (!video) {
    notFound();
  }

  // Fetch playback ID and policy from Mux
  let playbackId: string;
  let playbackPolicy: "public" | "signed";
  try {
    const result = await getPlaybackIdForAsset(slug);
    playbackId = result.playbackId;
    playbackPolicy = result.policy;
  } catch {
    notFound();
  }

  // Get video metadata
  const title = getVideoTitle(video);

  // Parse transcript from VTT
  const transcriptCues = video.transcriptVtt ?
      parseVtt(video.transcriptVtt) :
      [];

  const hasElevenLabsKey = Boolean(env.ELEVENLABS_API_KEY);
  const hasRemotionLambdaKeys = Boolean(
    env.REMOTION_AWS_ACCESS_KEY_ID && env.REMOTION_AWS_SECRET_ACCESS_KEY,
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Header currentPath="/media" />

      <main className="flex-1 px-4 py-8 md:px-6 md:py-12">
        <div className="mx-auto max-w-7xl">
          {/* Main content */}
          <MediaContent
            playbackId={playbackId}
            playbackPolicy={playbackPolicy}
            muxAssetId={video.muxAssetId}
            title={title}
            transcriptCues={transcriptCues}
            hasElevenLabsKey={hasElevenLabsKey}
            hasRemotionLambdaKeys={hasRemotionLambdaKeys}
          />
        </div>
      </main>

      <Footer />
    </div>
  );
}
