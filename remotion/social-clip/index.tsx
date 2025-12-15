import { loadFont } from "@remotion/google-fonts/SpaceGrotesk";
import { useAudioData, visualizeAudio } from "@remotion/media-utils";
import { Audio, interpolate, useCurrentFrame, useVideoConfig } from "remotion";

import type { AspectRatio, CaptionCue, SocialClipProps } from "./constants";
import { SOCIAL_CLIP_FPS } from "./constants";

const { fontFamily } = loadFont();

// ─────────────────────────────────────────────────────────────────────────────
// Caption Display Component
// ─────────────────────────────────────────────────────────────────────────────

interface CaptionDisplayProps {
  captions: CaptionCue[];
  clipStartTime: number;
  aspectRatio: AspectRatio;
}

function CaptionDisplay({ captions, clipStartTime, aspectRatio }: CaptionDisplayProps) {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Current time in seconds relative to the original video
  const currentTime = clipStartTime + (frame / SOCIAL_CLIP_FPS);

  // Find the active caption
  const activeCue = captions.find(
    cue => currentTime >= cue.startTime && currentTime < cue.endTime,
  );

  if (!activeCue) {
    return null;
  }

  // Calculate animation progress within the cue
  const cueProgress = (currentTime - activeCue.startTime) / (activeCue.endTime - activeCue.startTime);

  // Animate opacity for smooth transitions
  const opacity = interpolate(
    cueProgress,
    [0, 0.05, 0.95, 1],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Subtle scale animation
  const scale = interpolate(
    cueProgress,
    [0, 0.1, 0.9, 1],
    [0.95, 1, 1, 0.98],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Font size based on aspect ratio
  let fontSize: number;
  if (aspectRatio === "portrait") {
    fontSize = Math.min(56, width * 0.052);
  } else if (aspectRatio === "square") {
    fontSize = Math.min(48, width * 0.044);
  } else {
    fontSize = Math.min(42, width * 0.022);
  }

  // Padding based on aspect ratio
  const horizontalPadding = aspectRatio === "portrait" ? 48 : aspectRatio === "square" ? 40 : 80;

  return (
    <div
      className="absolute flex items-center justify-center"
      style={{
        left: horizontalPadding,
        right: horizontalPadding,
        bottom: aspectRatio === "portrait" ? height * 0.25 : height * 0.2,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <div
        className="max-w-full border-3 border-accent bg-black/85"
        style={{
          padding: aspectRatio === "portrait" ? "24px 32px" : "20px 28px",
        }}
      >
        <p
          className="m-0 text-center font-semibold leading-[1.4] text-white"
          style={{
            fontFamily,
            fontSize,
          }}
        >
          {activeCue.text}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Audio Visualizer (audio-driven waveform bars)
// ─────────────────────────────────────────────────────────────────────────────

function getVisualizerConfig(aspectRatio: AspectRatio) {
  return {
    barCount: aspectRatio === "portrait" ? 36 : aspectRatio === "square" ? 32 : 48,
    barWidth: aspectRatio === "portrait" ? 14 : 12,
    maxBarHeight: aspectRatio === "portrait" ? 280 : 200,
    gap: aspectRatio === "portrait" ? 8 : 6,
  };
}

interface VisualizerBarsProps {
  aspectRatio: AspectRatio;
  heightFactors: number[];
}

function VisualizerBars({ aspectRatio, heightFactors }: VisualizerBarsProps) {
  const { width, height } = useVideoConfig();
  const { barCount, barWidth, maxBarHeight, gap } = getVisualizerConfig(aspectRatio);

  const totalWidth = barCount * barWidth + (barCount - 1) * gap;
  const startX = (width - totalWidth) / 2;
  const yPosition = aspectRatio === "portrait" ? height * 0.45 : height * 0.5;

  return (
    <div
      className="absolute flex items-center"
      style={{
        left: startX,
        top: yPosition - maxBarHeight / 2,
        gap,
        height: maxBarHeight,
      }}
    >
      {heightFactors.map((factor, i) => {
        const barHeight = maxBarHeight * Math.min(1, factor);
        return (
          <div
            // Bars are at fixed positions, only heights change - index key is appropriate
            // eslint-disable-next-line react/no-array-index-key
            key={i}
            className="bg-accent"
            style={{
              width: barWidth,
              height: barHeight,
              borderRadius: barWidth / 2,
            }}
          />
        );
      })}
    </div>
  );
}

// FFT requires power-of-2 sample count; we'll downsample to barCount for display
const FFT_SAMPLE_COUNT = 64;

function getCenteredOffset(i: number, barCount: number): number {
  const center = (barCount - 1) / 2;
  return Math.abs(i - center);
}

// Audio-driven visualizer (requires valid audio URL)
function AudioDrivenVisualizer({
  aspectRatio,
  audioUrl,
  audioStartFrame,
}: {
  aspectRatio: AspectRatio;
  audioUrl: string;
  audioStartFrame: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const audioData = useAudioData(audioUrl);
  const { barCount } = getVisualizerConfig(aspectRatio);

  const adjustedFrame = frame + audioStartFrame;

  // Get audio visualization data (requires power-of-2 sample count for FFT)
  let visualization: number[] | null = null;
  if (audioData) {
    visualization = visualizeAudio({
      fps,
      frame: adjustedFrame,
      audioData,
      numberOfSamples: FFT_SAMPLE_COUNT,
    });
  }

  // Generate height factors from audio data or fallback animation
  const heightFactors = Array.from({ length: barCount }).map((_, i) => {
    if (visualization) {
      // Center the most animated (low-frequency) bins by mapping sample 0 -> middle bar,
      // then spreading higher frequency bins outwards symmetrically.
      const center = (barCount - 1) / 2;
      const offset = getCenteredOffset(i, barCount);
      const denominator = Math.max(1, center);
      const sampleIndex = Math.floor((offset / denominator) * (FFT_SAMPLE_COUNT - 1));
      const rawValue = visualization[sampleIndex];
      // Apply aggressive scaling: power curve for punch + high multiplier for impact
      // This really sells the vocal presence with dramatic bar movement
      const amplified = (rawValue ** 0.6) * 6;
      return Math.max(0.08, Math.min(1, amplified));
    }
    // Fallback while audio loads
    const offset = getCenteredOffset(i, barCount);
    const phase = (offset * 0.35) + (frame * 0.15);
    return 0.3 + 0.7 * Math.abs(Math.sin(phase)) * Math.abs(Math.cos(phase * 0.7 + i));
  });

  return <VisualizerBars aspectRatio={aspectRatio} heightFactors={heightFactors} />;
}

// Animated fallback visualizer (no audio required)
function FallbackVisualizer({ aspectRatio }: { aspectRatio: AspectRatio }) {
  const frame = useCurrentFrame();
  const { barCount } = getVisualizerConfig(aspectRatio);

  const heightFactors = Array.from({ length: barCount }).map((_, i) => {
    const offset = getCenteredOffset(i, barCount);
    const phase = (offset * 0.35) + (frame * 0.15);
    return 0.3 + 0.7 * Math.abs(Math.sin(phase)) * Math.abs(Math.cos(phase * 0.7 + i));
  });

  return <VisualizerBars aspectRatio={aspectRatio} heightFactors={heightFactors} />;
}

interface AudioVisualizerProps {
  aspectRatio: AspectRatio;
  audioUrl: string | null;
  audioStartFrame: number;
}

// Main visualizer that chooses between audio-driven and fallback
function AudioVisualizer({ aspectRatio, audioUrl, audioStartFrame }: AudioVisualizerProps) {
  if (audioUrl) {
    return (
      <AudioDrivenVisualizer
        aspectRatio={aspectRatio}
        audioUrl={audioUrl}
        audioStartFrame={audioStartFrame}
      />
    );
  }
  return <FallbackVisualizer aspectRatio={aspectRatio} />;
}

// ─────────────────────────────────────────────────────────────────────────────
// Social Clip Composition
// ─────────────────────────────────────────────────────────────────────────────

interface SocialClipCompositionProps extends SocialClipProps {
  aspectRatio: AspectRatio;
}

export function SocialClipComposition({
  audioUrl,
  startTime,
  title,
  captions,
  aspectRatio,
}: SocialClipCompositionProps) {
  const { width, height } = useVideoConfig();

  // Check if we have a valid audio URL (not empty)
  const hasValidAudio = Boolean(audioUrl && audioUrl.length > 0);
  const resolvedAudioUrl = hasValidAudio ? audioUrl : null;

  // Calculate audio start frame
  const audioStartFrame = Math.floor(startTime * SOCIAL_CLIP_FPS);

  return (
    <div
      className="relative overflow-hidden bg-linear-to-b from-[#0a0a0a] via-[#1a1a1a] to-[#0a0a0a]"
      style={{ width, height }}
    >
      {/* Background pattern */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            radial-gradient(circle at 20% 30%, rgba(255, 97, 1, 0.08) 0%, transparent 50%),
            radial-gradient(circle at 80% 70%, rgba(255, 97, 1, 0.06) 0%, transparent 50%)
          `,
        }}
      />

      {/* Audio - only render with valid audio URL */}
      {resolvedAudioUrl && (
        <Audio
          src={resolvedAudioUrl}
          startFrom={audioStartFrame}
        />
      )}

      {/* Title (if provided) */}
      {title && (
        <div
          className="absolute left-10 right-10 flex justify-center"
          style={{ top: aspectRatio === "portrait" ? 120 : 60 }}
        >
          <div
            className="border-3 border-black bg-accent"
            style={{ padding: aspectRatio === "portrait" ? "16px 28px" : "12px 24px" }}
          >
            <span
              className="font-bold uppercase tracking-wide text-black"
              style={{
                fontFamily,
                fontSize: aspectRatio === "portrait" ? 28 : 24,
              }}
            >
              {title}
            </span>
          </div>
        </div>
      )}

      {/* Audio Visualizer */}
      <AudioVisualizer
        aspectRatio={aspectRatio}
        audioUrl={resolvedAudioUrl}
        audioStartFrame={audioStartFrame}
      />

      {/* Burnt-in Captions */}
      <CaptionDisplay
        captions={captions}
        clipStartTime={startTime}
        aspectRatio={aspectRatio}
      />

      {/* Bottom branding bar */}
      <div
        className="absolute inset-x-0 bottom-0 flex items-center justify-center border-t-3 border-accent bg-black"
        style={{ height: aspectRatio === "portrait" ? 80 : 50 }}
      >
        <span
          className="font-bold uppercase tracking-widest text-accent"
          style={{
            fontFamily,
            fontSize: aspectRatio === "portrait" ? 18 : 14,
          }}
        >
          DEMUXED STUDIO
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Aspect Ratio Specific Compositions
// ─────────────────────────────────────────────────────────────────────────────

export function SocialClipPortrait(props: SocialClipProps) {
  return <SocialClipComposition {...props} aspectRatio="portrait" />;
}

export function SocialClipSquare(props: SocialClipProps) {
  return <SocialClipComposition {...props} aspectRatio="square" />;
}

export function SocialClipLandscape(props: SocialClipProps) {
  return <SocialClipComposition {...props} aspectRatio="landscape" />;
}
