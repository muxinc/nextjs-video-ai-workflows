import { loadFont } from "@remotion/google-fonts/Anton";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

const { fontFamily } = loadFont();

export function MyComposition() {
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
    <AbsoluteFill
      style={{
        backgroundColor: "#000",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <span
        style={{
          color: "#fff",
          fontWeight: "bold",
          fontSize: 120,
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
