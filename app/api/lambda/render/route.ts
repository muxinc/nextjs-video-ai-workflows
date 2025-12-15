import { z } from "zod";

import { env } from "@/app/lib/env";
import { executeApi } from "@/app/lib/remotion/api-response";
import {
  DISK,
  RAM,
  REGION,
  SITE_NAME,
  TIMEOUT,
} from "@/remotion/config.mjs";
import { RenderRequest } from "@/remotion/domain/schema";

import type { AwsRegion, RenderMediaOnLambdaOutput } from "@remotion/lambda/client";

const RouteRequestSchema = RenderRequest.extend({
  fileName: z.string().min(1),
});

export const POST = executeApi<RenderMediaOnLambdaOutput, typeof RouteRequestSchema>(
  RouteRequestSchema,
  async (_req, body) => {
    if (!env.REMOTION_AWS_ACCESS_KEY_ID) {
      throw new TypeError(
        "Set up Remotion Lambda to render videos. See the README.md for how to do so.",
      );
    }
    if (!env.REMOTION_AWS_SECRET_ACCESS_KEY) {
      throw new TypeError(
        "The environment variable REMOTION_AWS_SECRET_ACCESS_KEY is missing. Add it to your .env file.",
      );
    }

    const { renderMediaOnLambda, speculateFunctionName } = await import("@remotion/lambda/client");

    const result = await renderMediaOnLambda({
      codec: "h264",
      functionName: speculateFunctionName({
        diskSizeInMb: DISK,
        memorySizeInMb: RAM,
        timeoutInSeconds: TIMEOUT,
      }),
      region: REGION as AwsRegion,
      serveUrl: SITE_NAME,
      composition: body.id,
      inputProps: body.inputProps,
      framesPerLambda: 10,
      downloadBehavior: {
        type: "download",
        fileName: body.fileName,
      },
    });

    return result;
  },
);
