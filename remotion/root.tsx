import React from "react";
import { Composition } from "remotion";

import { DefaultComposition } from "./default-composition";
import { DEFAULT_COMPOSITION_ID, DEFAULT_DURATION_IN_FRAMES, DEFAULT_VIDEO_FPS, DEFAULT_VIDEO_HEIGHT, DEFAULT_VIDEO_WIDTH } from "./default-composition/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id={DEFAULT_COMPOSITION_ID}
        component={DefaultComposition}
        durationInFrames={DEFAULT_DURATION_IN_FRAMES}
        fps={DEFAULT_VIDEO_FPS}
        width={DEFAULT_VIDEO_WIDTH}
        height={DEFAULT_VIDEO_HEIGHT}
      />
    </>
  );
};
