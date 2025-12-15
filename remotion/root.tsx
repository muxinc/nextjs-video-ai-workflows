import React from "react";
import { Composition } from "remotion";

import { DefaultComposition } from "./default-composition";
import { DEFAULT_COMPOSITION_ID, DEFAULT_DURATION_IN_FRAMES, DEFAULT_VIDEO_FPS, DEFAULT_VIDEO_HEIGHT, DEFAULT_VIDEO_WIDTH } from "./default-composition/constants";
import { SocialClipLandscape, SocialClipPortrait, SocialClipSquare } from "./social-clip";
import { ASPECT_RATIO_CONFIG, DEFAULT_SOCIAL_CLIP_PROPS, getDurationInFrames, SOCIAL_CLIP_FPS, SOCIAL_CLIP_SCHEMA } from "./social-clip/constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Default test composition */}
      <Composition
        id={DEFAULT_COMPOSITION_ID}
        component={DefaultComposition}
        durationInFrames={DEFAULT_DURATION_IN_FRAMES}
        fps={DEFAULT_VIDEO_FPS}
        width={DEFAULT_VIDEO_WIDTH}
        height={DEFAULT_VIDEO_HEIGHT}
      />

      {/* Social Clip: Portrait (9:16) */}
      <Composition
        id={ASPECT_RATIO_CONFIG.portrait.id}
        component={SocialClipPortrait}
        durationInFrames={getDurationInFrames(DEFAULT_SOCIAL_CLIP_PROPS.startTime, DEFAULT_SOCIAL_CLIP_PROPS.endTime)}
        fps={SOCIAL_CLIP_FPS}
        width={ASPECT_RATIO_CONFIG.portrait.width}
        height={ASPECT_RATIO_CONFIG.portrait.height}
        schema={SOCIAL_CLIP_SCHEMA}
        defaultProps={DEFAULT_SOCIAL_CLIP_PROPS}
        calculateMetadata={({ props }) => ({
          durationInFrames: getDurationInFrames(props.startTime, props.endTime),
        })}
      />

      {/* Social Clip: Square (1:1) */}
      <Composition
        id={ASPECT_RATIO_CONFIG.square.id}
        component={SocialClipSquare}
        durationInFrames={getDurationInFrames(DEFAULT_SOCIAL_CLIP_PROPS.startTime, DEFAULT_SOCIAL_CLIP_PROPS.endTime)}
        fps={SOCIAL_CLIP_FPS}
        width={ASPECT_RATIO_CONFIG.square.width}
        height={ASPECT_RATIO_CONFIG.square.height}
        schema={SOCIAL_CLIP_SCHEMA}
        defaultProps={DEFAULT_SOCIAL_CLIP_PROPS}
        calculateMetadata={({ props }) => ({
          durationInFrames: getDurationInFrames(props.startTime, props.endTime),
        })}
      />

      {/* Social Clip: Landscape (16:9) */}
      <Composition
        id={ASPECT_RATIO_CONFIG.landscape.id}
        component={SocialClipLandscape}
        durationInFrames={getDurationInFrames(DEFAULT_SOCIAL_CLIP_PROPS.startTime, DEFAULT_SOCIAL_CLIP_PROPS.endTime)}
        fps={SOCIAL_CLIP_FPS}
        width={ASPECT_RATIO_CONFIG.landscape.width}
        height={ASPECT_RATIO_CONFIG.landscape.height}
        schema={SOCIAL_CLIP_SCHEMA}
        defaultProps={DEFAULT_SOCIAL_CLIP_PROPS}
        calculateMetadata={({ props }) => ({
          durationInFrames: getDurationInFrames(props.startTime, props.endTime),
        })}
      />
    </>
  );
};
