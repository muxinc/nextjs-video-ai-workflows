import { z } from "zod";

import { DEFAULT_COMPOSITION_SCHEMA } from "../default-composition/constants";
import { SOCIAL_CLIP_SCHEMA } from "../social-clip/constants";

// Union of all possible input props schemas
// NOTE: Order matters! More specific schemas (with more required fields) must come first.
// SOCIAL_CLIP_SCHEMA requires playbackId, startTime, endTime, captions - so it won't
// match simple default composition inputs. DEFAULT_COMPOSITION_SCHEMA only requires
// title, so it would greedily match social clip inputs if placed first.
const CompositionInputPropsSchema = z.union([
  SOCIAL_CLIP_SCHEMA,
  DEFAULT_COMPOSITION_SCHEMA,
]);

export const RenderRequest = z.object({
  id: z.string(),
  inputProps: CompositionInputPropsSchema,
});

export const ProgressRequest = z.object({
  bucketName: z.string(),
  id: z.string(),
});

export type ProgressResponse =
  | {
    type: "error";
    message: string;
  } |
  {
    type: "progress";
    progress: number;
  } |
  {
    type: "done";
    url: string;
    size: number;
  };
