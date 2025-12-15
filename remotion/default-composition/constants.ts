import { z } from "zod";

// The default composition id is used when no id is provided in the render request
export const DEFAULT_COMPOSITION_ID = "default-composition";

export const DEFAULT_COMPOSITION_SCHEMA = z.object({
  title: z.string(),
});

export const DEFAULT_COMPOSITION_PROPS: z.infer<typeof DEFAULT_COMPOSITION_SCHEMA> = {
  title: "Hello friend",
};

export const DEFAULT_DURATION_IN_FRAMES = 60;
export const DEFAULT_VIDEO_WIDTH = 1280;
export const DEFAULT_VIDEO_HEIGHT = 720;
export const DEFAULT_VIDEO_FPS = 30;
