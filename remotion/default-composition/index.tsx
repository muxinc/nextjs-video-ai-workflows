import { loadFont } from "@remotion/google-fonts/Anton";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const { fontFamily } = loadFont();

export function DefaultComposition() {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = spring({
    frame,
    fps,
    config: {
      damping: 12,
      stiffness: 100,
    },
  });

  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill className="bg-black flex justify-center items-center">
      <span
        className="text-white font-bold text-[120px]"
        style={{
          fontFamily,
          opacity,
          transform: `scale(${scale})`,
        }}
      >
        hello friend
      </span>
    </AbsoluteFill>
  );
}
