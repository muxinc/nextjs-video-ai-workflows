import {
  getRenderProgress,
  speculateFunctionName,
} from "@remotion/lambda/client";

import { env } from "@/app/lib/env";
import { executeApi } from "@/app/lib/remotion/api-response";
import { DISK, RAM, REGION, TIMEOUT } from "@/remotion/config.mjs";
import { ProgressRequest } from "@/remotion/domain/schema";
import type { ProgressResponse } from "@/remotion/domain/schema";

import type {
  AwsRegion,
} from "@remotion/lambda/client";

export const POST = executeApi<ProgressResponse, typeof ProgressRequest>(
  ProgressRequest,
  async (req, body) => {
    if (!env.REMOTION_AWS_ACCESS_KEY_ID || !env.REMOTION_AWS_SECRET_ACCESS_KEY) {
      throw new TypeError("Remotion Lambda env keys required");
    }

    const renderProgress = await getRenderProgress({
      bucketName: body.bucketName,
      functionName: speculateFunctionName({
        diskSizeInMb: DISK,
        memorySizeInMb: RAM,
        timeoutInSeconds: TIMEOUT,
      }),
      region: REGION as AwsRegion,
      renderId: body.id,
    });

    if (renderProgress.fatalErrorEncountered) {
      return {
        type: "error",
        message: renderProgress.errors[0].message,
      };
    }

    if (renderProgress.done) {
      return {
        type: "done",
        url: renderProgress.outputFile as string,
        size: renderProgress.outputSizeInBytes as number,
      };
    }

    return {
      type: "progress",
      progress: Math.max(0.03, renderProgress.overallProgress),
    };
  },
);
